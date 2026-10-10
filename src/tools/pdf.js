import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extrae el texto de un PDF en el navegador (sin subirlo a ningún servidor).
 *
 * Devuelve un arreglo de páginas; cada página es un arreglo de párrafos,
 * reconstruidos a partir de la posición vertical de los fragmentos de texto.
 */
export async function extractPdfPages(file, onProgress) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines = [];
    let lastY = null;
    let current = "";

    content.items.forEach((item) => {
      if (!("str" in item)) return;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      current += item.str;
      if (item.hasEOL) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      lastY = y;
    });
    if (current.trim()) lines.push(current.trim());

    // Une líneas en párrafos: una línea que no termina en puntuación continúa.
    const paragraphs = [];
    let paragraph = "";
    lines.forEach((line) => {
      paragraph = paragraph ? `${paragraph} ${line}` : line;
      if (/[.!?:;]$/.test(line) || line.length < 45) {
        paragraphs.push(paragraph.trim());
        paragraph = "";
      }
    });
    if (paragraph.trim()) paragraphs.push(paragraph.trim());

    pages.push(paragraphs);
    onProgress?.(Math.round((pageNumber / pdf.numPages) * 100), pageNumber, pdf.numPages);
  }

  return { pages, numPages: pdf.numPages };
}

export const pagesToPlainText = (pages) =>
  pages.map((paragraphs) => paragraphs.join("\n")).join("\n\n");
