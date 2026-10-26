import { getNodesBounds } from "@xyflow/react";
import { serializeDiagram } from "../../../utils/diagrams";

/** Nombre de archivo seguro a partir del nombre del diagrama. */
export const safeFileName = (name = "diagrama") =>
  (String(name).trim() || "diagrama")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "diagrama";

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Escala (zoom) aplicada al viewport, sin depender de `DOMMatrixReadOnly`. */
const readZoom = (element) => {
  const transform = getComputedStyle(element)?.transform || "";
  if (!transform || transform === "none") return 1;
  const matrix = transform.match(/^matrix\(([^)]+)\)/);
  if (matrix) return Math.abs(Number(matrix[1].split(",")[0])) || 1;
  if (typeof DOMMatrixReadOnly === "function") return Math.abs(new DOMMatrixReadOnly(transform).a) || 1;
  if (typeof DOMMatrix === "function") return Math.abs(new DOMMatrix(transform).a) || 1;
  const scale = transform.match(/scale\(([^)]+)\)/);
  return scale ? Math.abs(Number(scale[1])) || 1 : 1;
};

export const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return res.blob();
};

/** JSON portable del diagrama (se puede volver a importar). */
export const diagramToJsonBlob = (diagram) =>
  new Blob(
    [JSON.stringify({ app: "appsline-flowchart", exported_at: new Date().toISOString(), ...serializeDiagram(diagram) }, null, 2)],
    { type: "application/json" },
  );

/**
 * Renderiza el lienzo a imagen (PNG o SVG) recortado a los nodos.
 *
 * @param {HTMLElement} container Elemento raíz de `.react-flow`.
 * @param {Array} nodes Nodos actuales (para calcular el recorte).
 * @param {object} options `format` ("png"|"svg"), `background`, `scale`, `padding`
 * @returns {Promise<Blob>}
 */
export async function renderDiagramImage(container, nodes, { format = "png", background = "#ffffff", scale = 2, padding = 40 } = {}) {
  const viewportEl = container?.querySelector?.(".react-flow__viewport");
  if (!viewportEl) throw new Error("No se encontró el lienzo del diagrama");
  if (!nodes.length) throw new Error("El diagrama está vacío");

  const { toPng, toSvg } = await import("html-to-image");

  const bounds = getNodesBounds(nodes);
  const include = (box) => {
    const right = Math.max(bounds.x + bounds.width, box.x + box.width);
    const bottom = Math.max(bounds.y + bounds.height, box.y + box.height);
    bounds.x = Math.min(bounds.x, box.x);
    bounds.y = Math.min(bounds.y, box.y);
    bounds.width = right - bounds.x;
    bounds.height = bottom - bounds.y;
  };
  // También exportar las vueltas exteriores y sus etiquetas, sin recortarlas.
  viewportEl.querySelectorAll(".react-flow__edge-path").forEach((path) => include(path.getBBox()));
  const origin = viewportEl.getBoundingClientRect();
  const zoom = readZoom(viewportEl);
  viewportEl.querySelectorAll("[data-flow-edge-label]").forEach((label) => {
    const rect = label.getBoundingClientRect();
    include({ x: (rect.left - origin.left) / zoom, y: (rect.top - origin.top) / zoom, width: rect.width / zoom, height: rect.height / zoom });
  });
  const width = Math.max(200, Math.ceil(bounds.width + padding * 2));
  const height = Math.max(150, Math.ceil(bounds.height + padding * 2));
  // El PNG/SVG usa las unidades reales del lienzo; el zoom de pantalla no
  // debe reducir el dibujo ni interpretar «40 px» como un porcentaje enorme.
  const viewport = { x: padding - bounds.x, y: padding - bounds.y, zoom: 1 };
  await Promise.all(Array.from(viewportEl.querySelectorAll("img")).map((image) => image.decode()));

  const options = {
    backgroundColor: background,
    width,
    height,
    pixelRatio: format === "png" ? scale : 1,
    cacheBust: false,
    skipFonts: true,
    // Fuera quedan los controles de tamaño, los conectores y el chrome del
    // editor (nombre de pantalla, pines, candado, guías, «Probar desde aquí»).
    filter: (node) => {
      if (node?.dataset?.export === "hide") return false;
      const cls = typeof node?.className === "string" ? node.className : "";
      return !/react-flow__(resize-control|handle)|react-flow__minimap|react-flow__controls/.test(cls);
    },
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };

  // El resaltado de selección (azul) tampoco es parte del diseño: se apaga un
  // instante mientras se captura y se restaura después.
  const cleaned = Array.from(viewportEl.querySelectorAll("[data-export-clean]")).map((el) => {
    const previous = { boxShadow: el.style.boxShadow, outline: el.style.outline, outlineOffset: el.style.outlineOffset };
    el.style.boxShadow = "none";
    el.style.outline = "none";
    el.style.outlineOffset = "0px";
    return { el, previous };
  });

  try {
    const dataUrl = format === "svg" ? await toSvg(viewportEl, options) : await toPng(viewportEl, options);
    return dataUrlToBlob(dataUrl);
  } finally {
    cleaned.forEach(({ el, previous }) => {
      el.style.boxShadow = previous.boxShadow;
      el.style.outline = previous.outline;
      el.style.outlineOffset = previous.outlineOffset;
    });
  }
}

/** Lee un JSON exportado (o un diagrama crudo) desde un archivo. */
export const readDiagramFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error("El archivo no es un JSON válido"));
      }
    };
    reader.readAsText(file);
  });
