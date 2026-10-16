/**
 * Previsualización de archivos del panel: clasificación y parsers puros.
 *
 * Este módulo no toca el DOM ni la red (por eso vive separado de
 * `utils/files.js`, que sí depende de la URL de la API) y está cubierto por
 * `tests/unit/file-preview.test.mjs`. La descarga y el renderizado viven en
 * `pages/admin/project/FilePreview.jsx`, que carga los parsers pesados
 * (mammoth, read-excel-file, jszip) bajo demanda con `import()` dinámico.
 *
 * Qué se puede previsualizar sin salir del panel:
 *   imagen  -> <img> del navegador            (sin descargar el archivo vía fetch)
 *   pdf     -> visor nativo (<iframe>)        (sin descargar el archivo vía fetch)
 *   docx    -> HTML convertido en el navegador (mammoth)
 *   xlsx    -> tablas por hoja en el navegador (read-excel-file)
 *   pptx    -> texto e imágenes por diapositiva (jszip; vista simplificada)
 *   csv/tsv -> tabla
 *   txt/md/log -> texto plano
 *
 * Los formatos binarios antiguos (.doc, .xls, .ppt) y los de otros programas
 * (.odt, .ods, .odp) no tienen parser en el navegador: la vista previa ofrece
 * descargarlos o abrirlos con el visor en línea de Office cuando la URL es
 * pública (ver `officeViewerUrl`).
 */

/** Peso máximo para parsear un archivo en el navegador (20 MB). */
export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

/** Caracteres máximos que se pintan de un archivo de texto. */
export const TEXT_PREVIEW_MAX_CHARS = 120_000;

/** Filas/columnas máximas que se pintan de una hoja de cálculo o CSV. */
export const SHEET_PREVIEW_MAX_ROWS = 200;
export const SHEET_PREVIEW_MAX_COLS = 32;

const TEXT_EXTENSIONS = new Set(["txt", "text", "log", "md", "markdown"]);
const DELIMITED_EXTENSIONS = new Set(["csv", "tsv"]);

/** Extensiones de Office (modernas y antiguas) que entiende el visor en línea. */
const OFFICE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
]);

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jfif",
  "png",
  "apng",
  "gif",
  "webp",
  "avif",
  "bmp",
  "svg",
  "ico",
  "tif",
  "tiff",
]);

/** Extensión en minúsculas a partir de un nombre o ruta ("notas.TXT" -> "txt"). */
const extensionFromName = (name = "") => {
  const clean = String(name || "").split(/[?#]/)[0];
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match ? match[1].toLowerCase() : "";
};

/**
 * Tipo de vista previa para un archivo normalizado (o cualquier objeto con
 * `extension`/`name`/`mime`/`kind`). Devuelve `null` si no se puede
 * previsualizar dentro del panel.
 *
 * La extensión manda sobre el `kind`: un .txt y un .docx comparten kind
 * ("doc") pero se previsualizan de forma muy distinta.
 */
export const previewKindOf = (file) => {
  if (!file) return null;
  const ext = String(file.extension || "").toLowerCase() || extensionFromName(file.name);
  const mime = String(file.mime || "").toLowerCase();
  const kind = file.kind;

  if (kind === "image" || IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/")) return "image";
  if (kind === "pdf" || ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (DELIMITED_EXTENSIONS.has(ext)) return "csv";
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith("text/plain")) return "text";
  return null;
};

/** ¿La extensión es de un documento de Office (apto para el visor en línea)? */
export const isOfficeExtension = (extension = "") =>
  OFFICE_EXTENSIONS.has(String(extension || "").toLowerCase());

/**
 * URL del visor en línea de Microsoft Office para un archivo, o `null` si el
 * visor no podría abrirlo: el servicio necesita descargar el archivo desde
 * internet, así que solo sirve con URLs http(s) públicas (nada de localhost,
 * IPs privadas, `data:` o `blob:`).
 */
export const officeViewerUrl = (rawUrl) => {
  const raw = String(rawUrl || "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(raw)}`;
};

/**
 * Clave del icono "real" por tipo de archivo (los colores y el glifo viven en
 * `FileViews.jsx`). A diferencia del `kind`, distingue .docx de .txt y .csv
 * de .xlsx para poder pintar el icono de Word, Excel, PowerPoint, etc.
 */
export const badgeKindOf = (file) => {
  if (!file) return "generic";
  const ext = String(file.extension || "").toLowerCase() || extensionFromName(file.name);
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf", "pages"].includes(ext)) return "word";
  if (["xls", "xlsx", "ods", "numbers"].includes(ext)) return "excel";
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return "powerpoint";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  switch (file.kind) {
    case "pdf":
      return "pdf";
    case "doc":
      return "word";
    case "sheet":
      return "excel";
    case "slide":
      return "powerpoint";
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "archive":
      return "archive";
    case "code":
      return "code";
    default:
      return "generic";
  }
};

/** ¿El archivo supera el límite para parsearlo en el navegador? */
export const isPreviewTooLarge = (size) => Number(size) > 0 && Number(size) > PREVIEW_MAX_BYTES;

/* ------------------------------------------------------------------ */
/* CSV / TSV                                                           */
/* ------------------------------------------------------------------ */

/**
 * Convierte texto delimitado (CSV/TSV) en filas de celdas de texto.
 * Respeta comillas dobles (con `""` como comilla escapada), comas dentro de
 * celdas entrecomilladas y saltos de línea dentro de una celda. Recorta el
 * resultado a `maxRows`/`maxCols` para no pintar archivos enormes.
 */
export const parseDelimitedText = (
  text,
  { delimiter = ",", maxRows = SHEET_PREVIEW_MAX_ROWS, maxCols = SHEET_PREVIEW_MAX_COLS } = {}
) => {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row.slice(0, maxCols));
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) pushCell();
    else if (char === "\n") {
      pushRow();
      if (rows.length >= maxRows) return { rows, truncated: true };
    } else if (char !== "\r") cell += char;
  }
  if (cell !== "" || row.length > 0) pushRow();

  // Sin filas útiles (archivo vacío o solo saltos de línea).
  const useful = rows.filter((cells) => cells.some((value) => String(value).trim() !== ""));
  return { rows: useful.slice(0, maxRows), truncated: useful.length > maxRows };
};

/* ------------------------------------------------------------------ */
/* PPTX (texto de las diapositivas)                                    */
/* ------------------------------------------------------------------ */

/** Decodifica las entidades XML básicas (`&amp;`, `&lt;`, `&#233;`...). */
export const decodeXmlEntities = (value = "") =>
  String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * Párrafos de texto de una diapositiva PPTX a partir de su XML
 * (`ppt/slides/slideN.xml`): un texto por cada `<a:p>`, uniendo los
 * fragmentos `<a:t>` que lo forman. Las diapositivas de PowerPoint guardan
 * el texto así; el diseño (posiciones, fuentes) no se reproduce.
 */
export const extractSlideParagraphs = (xml = "") => {
  const source = String(xml || "");
  const paragraphs = [];
  const paragraphPattern = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
  let match;
  while ((match = paragraphPattern.exec(source)) !== null) {
    const text = Array.from(match[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
      .map((part) => decodeXmlEntities(part[1]))
      .join("")
      .trim();
    if (text) paragraphs.push(text);
  }
  if (paragraphs.length > 0) return paragraphs;
  // Diapositiva sin párrafos reconocibles: cualquier fragmento de texto sirve.
  return Array.from(source.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
    .map((part) => decodeXmlEntities(part[1]).trim())
    .filter(Boolean);
};

/** Número de una ruta de diapositiva ("ppt/slides/slide12.xml" -> 12). */
export const slideNumberOf = (path = "") => {
  const match = /slide(\d+)\.xml$/i.exec(String(path || ""));
  return match ? Number(match[1]) : 0;
};

/** Ordena las rutas de diapositivas por su número (slide2 antes que slide10). */
export const sortSlidePaths = (paths = []) =>
  [...paths].sort((a, b) => slideNumberOf(a) - slideNumberOf(b));
