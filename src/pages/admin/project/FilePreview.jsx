/* eslint-disable react/prop-types */
/**
 * Cuerpo de la vista previa de un archivo del proyecto.
 *
 * Todo se procesa en el navegador, sin subir nada a servicios externos:
 * las imágenes y los PDF los pinta el propio navegador, y DOCX / XLSX /
 * PPTX / CSV / TXT se descargan y se convierten aquí con parsers que se
 * cargan bajo demanda (`import()` dinámico), así que no pesan en el panel
 * hasta que alguien previsualiza ese tipo de archivo.
 *
 * Si la descarga falla (p. ej. el servidor de archivos no manda cabeceras
 * CORS para `/storage`), si el archivo es demasiado grande o si el formato
 * no tiene parser (.doc, .xls, .ppt antiguos), se ofrece el respaldo:
 * abrir/descargar el original y, para documentos de Office con URL pública,
 * el visor en línea de Microsoft.
 */
import { useEffect, useRef, useState } from "react";
import { FiDownload, FiFile, FiGlobe, FiLoader } from "react-icons/fi";
import { getToken } from "../../../services/session";
import { cx } from "../../../utils/format";
import {
  PREVIEW_MAX_BYTES,
  SHEET_PREVIEW_MAX_COLS,
  SHEET_PREVIEW_MAX_ROWS,
  TEXT_PREVIEW_MAX_CHARS,
  extractSlideParagraphs,
  isOfficeExtension,
  isPreviewTooLarge,
  officeViewerUrl,
  parseDelimitedText,
  previewKindOf,
  sortSlidePaths,
} from "../../../utils/filePreview";
import { formatBytes } from "../../../utils/files";
import { FileIcon } from "./FileViews";

const IMAGE_MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  emf: "image/emf",
  wmf: "image/wmf",
};

/* ------------------------------------------------------------------ */
/* Carga y conversión (parsers bajo demanda)                           */
/* ------------------------------------------------------------------ */

const fetchBlob = async (url, signal) => {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (error) {
    if (signal?.aborted) throw error;
    // Segundo intento con el token de la sesión, por si el archivo se sirve
    // desde la API (ruta protegida) y no como archivo público de /storage.
    const token = getToken();
    if (!token) throw error;
    const response = await fetch(url, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  }
};

/** Quita del HTML de un DOCX todo lo ejecutable o ajeno al documento. */
const sanitizeDocxHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll("script, style, iframe, object, embed, form, input, button, link, meta, svg, math")
    .forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style") element.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^\s*(javascript|vbscript):/i.test(attr.value)) {
        element.removeAttribute(attr.name);
      }
    });
    if (element.tagName === "IMG") {
      const src = element.getAttribute("src") || "";
      if (!/^(data:image\/|https?:\/\/|blob:)/i.test(src)) element.removeAttribute("src");
      element.removeAttribute("width");
      element.removeAttribute("height");
    }
    if (element.tagName === "A") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noreferrer");
    }
  });
  return doc.body.innerHTML;
};

const loadDocxHtml = async (blob) => {
  const mammoth = await import("mammoth");
  const convert = mammoth.convertToHtml || mammoth.default?.convertToHtml;
  const { value } = await convert({ arrayBuffer: await blob.arrayBuffer() });
  return sanitizeDocxHtml(value);
};

const loadSheets = async (blob) => {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(blob);
  return (sheets || []).map((sheet) => ({
    name: sheet.sheet || "Hoja",
    rows: (sheet.data || []).slice(0, SHEET_PREVIEW_MAX_ROWS),
    truncated: (sheet.data || []).length > SHEET_PREVIEW_MAX_ROWS,
  }));
};

/** Resuelve una ruta de relación ("../media/image1.png") dentro del ZIP. */
const resolveZipPath = (baseDir, target) => {
  const parts = `${baseDir}/${target}`.split("/");
  const resolved = [];
  parts.forEach((part) => {
    if (part === "..") resolved.pop();
    else if (part && part !== ".") resolved.push(part);
  });
  return resolved.join("/");
};

const loadSlides = async (blob, createObjectUrl) => {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slidePaths = sortSlidePaths(
    Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
  );

  const slides = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path).async("string");
    const paragraphs = extractSlideParagraphs(xml);

    // Imágenes de la diapositiva, en el orden en que aparecen.
    const images = [];
    const relsFile = zip.file(path.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels");
    if (relsFile) {
      const relsXml = await relsFile.async("string");
      const targets = {};
      for (const tag of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /\bId="([^"]+)"/.exec(tag[0])?.[1];
        const target = /\bTarget="([^"]+)"/.exec(tag[0])?.[1];
        if (id && target) targets[id] = target;
      }
      for (const blip of xml.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) {
        const target = targets[blip[1]];
        if (!target) continue;
        const media = zip.file(resolveZipPath("ppt/slides", target));
        if (!media) continue;
        const ext = target.split(".").pop()?.toLowerCase();
        const data = await media.async("blob");
        images.push(
          createObjectUrl(new Blob([data], { type: IMAGE_MIME_BY_EXT[ext] || "image/png" }))
        );
      }
    }
    slides.push({ paragraphs, images });
  }
  return slides;
};

/* ------------------------------------------------------------------ */
/* Piezas de presentación                                              */
/* ------------------------------------------------------------------ */

const Loading = () => (
  <div className="flex flex-col items-center gap-2 py-12 text-center">
    <FiLoader className="animate-spin text-2xl text-brand-500" />
    <p className="text-sm font-medium text-slate-600">Preparando la vista previa…</p>
    <p className="text-xs text-slate-400">El archivo se procesa en tu navegador, sin subirlo a ningún servicio.</p>
  </div>
);

/** Respaldo cuando no hay vista previa: icono grande, motivo y salidas. */
export const PreviewFallback = ({ file, title, message }) => {
  const [showOfficeViewer, setShowOfficeViewer] = useState(false);
  const viewerUrl =
    file && isOfficeExtension(file.extension) ? officeViewerUrl(file.url) : null;

  if (showOfficeViewer && viewerUrl) {
    return (
      <div>
        <iframe
          src={viewerUrl}
          title={file.name}
          className="h-[60vh] w-full rounded-xl border border-slate-200 bg-slate-50"
        />
        <p className="mt-2 text-center text-xs text-slate-400">
          Visor en línea de Microsoft Office. El archivo se abre desde su URL pública.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <FileIcon file={file} large />
      <p className="mt-1 text-sm font-medium text-slate-600">{title}</p>
      <p className="max-w-md text-xs leading-5 text-slate-400">{message}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {file?.url && (
          <a href={file.url} target="_blank" rel="noreferrer" className="btn-secondary">
            <FiDownload /> Abrir o descargar original
          </a>
        )}
        {viewerUrl && (
          <button type="button" onClick={() => setShowOfficeViewer(true)} className="btn-secondary">
            <FiGlobe /> Ver con el visor de Office
          </button>
        )}
      </div>
    </div>
  );
};

const formatCell = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("es-MX");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return value.toLocaleString("es-MX", { maximumFractionDigits: 4 });
  return String(value);
};

/** Tabla de solo lectura para XLSX y CSV (primera fila como encabezado). */
const SheetTable = ({ rows, truncated }) => {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-400">La hoja está vacía.</p>;
  }
  const [header, ...body] = rows;
  return (
    <div>
      <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              {header.map((cell, index) => (
                <th
                  key={index}
                  className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600"
                >
                  {formatCell(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {body.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50/70">
                {row.slice(0, SHEET_PREVIEW_MAX_COLS).map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cx(
                      "whitespace-nowrap px-3 py-1.5 text-slate-600",
                      typeof cell === "number" && "text-right tabular-nums"
                    )}
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="mt-2 text-xs text-slate-400">
          Solo se muestran las primeras {SHEET_PREVIEW_MAX_ROWS} filas. Descarga el archivo para verlo completo.
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Vista previa                                                        */
/* ------------------------------------------------------------------ */

const FilePreview = ({ file }) => {
  const kind = previewKindOf(file);
  const [state, setState] = useState({ status: "idle" });
  const [activeSheet, setActiveSheet] = useState(0);
  const [imageBroken, setImageBroken] = useState(false);
  const objectUrls = useRef([]);

  const revokeObjectUrls = () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = [];
  };

  useEffect(() => {
    setActiveSheet(0);
    setImageBroken(false);
    revokeObjectUrls();

    if (!file || !kind || kind === "image" || kind === "pdf") return undefined;
    if (isPreviewTooLarge(file.size)) {
      setState({ status: "tooLarge" });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    (async () => {
      try {
        const blob = await fetchBlob(file.url, controller.signal);
        if (blob.size > PREVIEW_MAX_BYTES) {
          setState({ status: "tooLarge" });
          return;
        }
        if (kind === "text" || kind === "csv") {
          const raw = await blob.text();
          if (kind === "text") {
            setState({
              status: "ready",
              text: raw.slice(0, TEXT_PREVIEW_MAX_CHARS),
              truncated: raw.length > TEXT_PREVIEW_MAX_CHARS,
            });
          } else {
            const { rows, truncated } = parseDelimitedText(raw, {
              delimiter: file.extension === "tsv" ? "\t" : ",",
            });
            setState({ status: "ready", rows, truncated });
          }
        } else if (kind === "docx") {
          setState({ status: "ready", html: await loadDocxHtml(blob) });
        } else if (kind === "xlsx") {
          setState({ status: "ready", sheets: await loadSheets(blob) });
        } else if (kind === "pptx") {
          const slides = await loadSlides(blob, (blobPart) => {
            const url = URL.createObjectURL(blobPart);
            objectUrls.current.push(url);
            return url;
          });
          setState({ status: "ready", slides });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: "error", error });
      }
    })();

    return () => controller.abort();
    // Solo recargar cuando cambia el archivo (su key identifica la versión).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.key, file?.url, kind]);

  useEffect(() => revokeObjectUrls, []);

  if (!file) return null;

  if (!kind) {
    return (
      <PreviewFallback
        file={file}
        title="Este tipo de archivo no se puede previsualizar en el panel"
        message="Los formatos antiguos de Office (.doc, .xls, .ppt) y otros programas no se pueden convertir en el navegador. Puedes abrir el original o probar el visor en línea cuando la URL del archivo es pública."
      />
    );
  }

  if (kind === "image") {
    if (imageBroken) {
      return (
        <PreviewFallback
          file={file}
          title="La imagen no se pudo cargar"
          message="El servidor de archivos no devolvió la imagen. Puedes abrir el original en una pestaña nueva."
        />
      );
    }
    return (
      <img
        src={file.url}
        alt={file.name}
        onError={() => setImageBroken(true)}
        className="mx-auto max-h-[60vh] w-auto rounded-xl border border-slate-200 object-contain"
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={file.url}
        title={file.name}
        className="h-[60vh] w-full rounded-xl border border-slate-200 bg-slate-50"
      />
    );
  }

  if (state.status === "tooLarge") {
    return (
      <PreviewFallback
        file={file}
        title={`El archivo supera los ${formatBytes(PREVIEW_MAX_BYTES)} de la vista previa`}
        message="Convertirlo en el navegador podría congelar la pestaña. Ábrelo o descárgalo para verlo completo; los documentos de Office con URL pública también se pueden ver con el visor en línea."
      />
    );
  }

  if (state.status === "error") {
    return (
      <PreviewFallback
        file={file}
        title="No se pudo preparar la vista previa"
        message="Es posible que el servidor de archivos no permita leerlo desde el panel (CORS) o que el archivo esté dañado. Puedes abrir el original; si es un documento de Office con URL pública, el visor en línea no necesita esa lectura."
      />
    );
  }

  if (state.status !== "ready") return <Loading />;

  if (kind === "text") {
    return (
      <div>
        <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-mono text-xs leading-5 text-slate-700">
          {state.text || "(archivo vacío)"}
        </pre>
        {state.truncated && (
          <p className="mt-2 text-xs text-slate-400">
            Solo se muestra el principio del archivo. Descárgalo para verlo completo.
          </p>
        )}
      </div>
    );
  }

  if (kind === "csv") return <SheetTable rows={state.rows} truncated={state.truncated} />;

  if (kind === "docx") {
    return (
      <div
        className={cx(
          "max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white px-6 py-5",
          "text-[13.5px] leading-6 text-slate-700",
          "[&_p]:mb-3 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900",
          "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900",
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1",
          "[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12.5px]",
          "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2.5 [&_td]:py-1.5",
          "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left",
          "[&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg",
          "[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline",
          "[&_strong]:font-semibold [&_strong]:text-slate-800"
        )}
        // El HTML viene de mammoth y pasa por sanitizeDocxHtml (sin scripts ni on*).
        dangerouslySetInnerHTML={{ __html: state.html || "<p>(documento vacío)</p>" }}
      />
    );
  }

  if (kind === "xlsx") {
    const sheets = state.sheets || [];
    const sheet = sheets[Math.min(activeSheet, Math.max(0, sheets.length - 1))];
    return (
      <div>
        {sheets.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Hojas del libro">
            {sheets.map((row, index) => (
              <button
                key={row.name + index}
                type="button"
                role="tab"
                aria-selected={index === activeSheet}
                onClick={() => setActiveSheet(index)}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
                  index === activeSheet
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {row.name}
              </button>
            ))}
          </div>
        )}
        {sheet ? (
          <SheetTable rows={sheet.rows} truncated={sheet.truncated} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">El libro no tiene hojas legibles.</p>
        )}
      </div>
    );
  }

  if (kind === "pptx") {
    const slides = state.slides || [];
    if (!slides.length) {
      return (
        <PreviewFallback
          file={file}
          title="No se encontraron diapositivas legibles"
          message="La presentación puede estar vacía o usar un formato no compatible. Puedes abrir el archivo original."
        />
      );
    }
    return (
      <div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {slides.map((slide, index) => (
            <section
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              aria-label={`Diapositiva ${index + 1}`}
            >
              <p className="mb-3 inline-flex rounded-full bg-[#fdeee9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d24726]">
                Diapositiva {index + 1}
              </p>
              {slide.images.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {slide.images.map((src, imageIndex) => (
                    <img
                      key={imageIndex}
                      src={src}
                      alt={`Imagen ${imageIndex + 1} de la diapositiva ${index + 1}`}
                      className="max-h-44 w-auto rounded-lg border border-slate-200 object-contain"
                    />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {slide.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={paragraphIndex}
                    className={
                      paragraphIndex === 0
                        ? "text-base font-bold text-slate-800"
                        : "text-[13px] leading-5 text-slate-600"
                    }
                  >
                    {paragraph}
                  </p>
                ))}
                {!slide.paragraphs.length && !slide.images.length && (
                  <p className="text-[13px] italic text-slate-400">(sin texto legible)</p>
                )}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Vista simplificada: se muestra el texto y las imágenes de cada diapositiva, sin el diseño
          original de PowerPoint.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <FiFile className="text-2xl text-slate-300" />
      <p className="text-sm font-medium text-slate-600">Este tipo de archivo no se puede previsualizar</p>
    </div>
  );
};

export default FilePreview;
