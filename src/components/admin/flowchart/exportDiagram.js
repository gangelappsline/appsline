import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
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
  const width = Math.max(200, Math.ceil(bounds.width + padding * 2));
  const height = Math.max(150, Math.ceil(bounds.height + padding * 2));
  const viewport = getViewportForBounds(bounds, width, height, 0.1, 4, padding);

  const options = {
    backgroundColor: background,
    width,
    height,
    pixelRatio: format === "png" ? scale : 1,
    cacheBust: true,
    // Fuera quedan los controles de tamaño y los conectores: solo el dibujo.
    filter: (node) => {
      const cls = typeof node.className === "string" ? node.className : "";
      return !/react-flow__(resize-control|handle)|react-flow__minimap|react-flow__controls/.test(cls);
    },
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };

  const dataUrl = format === "svg" ? await toSvg(viewportEl, options) : await toPng(viewportEl, options);
  return dataUrlToBlob(dataUrl);
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
