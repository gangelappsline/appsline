import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pruebas de la previsualización de archivos (`src/utils/filePreview.js`).
 *
 * Se protege la parte pura (sin DOM ni red): qué formatos se pueden
 * previsualizar, qué icono les toca, el parser de CSV, la extracción de
 * texto de las diapositivas PPTX y cuándo el visor en línea de Office es
 * una salida válida (solo URLs públicas).
 */
import {
  badgeKindOf,
  decodeXmlEntities,
  extractSlideParagraphs,
  isPreviewTooLarge,
  officeViewerUrl,
  parseDelimitedText,
  previewKindOf,
  slideNumberOf,
  sortSlidePaths,
} from "../../src/utils/filePreview.js";

test("clasifica los formatos previsualizables y deja fuera los antiguos", () => {
  assert.equal(previewKindOf({ extension: "docx", kind: "doc" }), "docx");
  assert.equal(previewKindOf({ extension: "xlsx", kind: "sheet" }), "xlsx");
  assert.equal(previewKindOf({ extension: "pptx", kind: "slide" }), "pptx");
  assert.equal(previewKindOf({ extension: "pdf", kind: "pdf" }), "pdf");
  assert.equal(previewKindOf({ extension: "txt", kind: "doc" }), "text");
  assert.equal(previewKindOf({ extension: "md", kind: "doc" }), "text");
  assert.equal(previewKindOf({ extension: "csv", kind: "sheet" }), "csv");
  assert.equal(previewKindOf({ extension: "png", kind: "image" }), "image");
  assert.equal(previewKindOf({ name: "notas.TXT" }), "text");
  // Sin parser en el navegador: formatos binarios antiguos y desconocidos.
  assert.equal(previewKindOf({ extension: "doc", kind: "doc" }), null);
  assert.equal(previewKindOf({ extension: "xls", kind: "sheet" }), null);
  assert.equal(previewKindOf({ extension: "ppt", kind: "slide" }), null);
  assert.equal(previewKindOf({ extension: "zip", kind: "archive" }), null);
  assert.equal(previewKindOf(null), null);
});

test("elige el icono real por extensión antes que por tipo genérico", () => {
  assert.equal(badgeKindOf({ extension: "docx", kind: "doc" }), "word");
  assert.equal(badgeKindOf({ extension: "txt", kind: "doc" }), "text");
  assert.equal(badgeKindOf({ extension: "xlsx", kind: "sheet" }), "excel");
  assert.equal(badgeKindOf({ extension: "csv", kind: "sheet" }), "csv");
  assert.equal(badgeKindOf({ extension: "pptx", kind: "slide" }), "powerpoint");
  assert.equal(badgeKindOf({ extension: "pdf", kind: "pdf" }), "pdf");
  assert.equal(badgeKindOf({ extension: "zip", kind: "archive" }), "archive");
  assert.equal(badgeKindOf({ kind: "doc" }), "word");
  assert.equal(badgeKindOf({}), "generic");
});

test("el visor de Office solo acepta URLs públicas", () => {
  assert.equal(
    officeViewerUrl("https://api.appsline.com.mx/storage/files/contrato.docx"),
    "https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fapi.appsline.com.mx%2Fstorage%2Ffiles%2Fcontrato.docx"
  );
  assert.equal(officeViewerUrl("http://localhost:8000/files/a.docx"), null);
  assert.equal(officeViewerUrl("http://127.0.0.1:8000/files/a.docx"), null);
  assert.equal(officeViewerUrl("http://192.168.1.20/files/a.docx"), null);
  assert.equal(officeViewerUrl("blob:https://panel.appsline.com.mx/123"), null);
  assert.equal(officeViewerUrl(""), null);
});

test("respeta el límite de tamaño de la vista previa", () => {
  assert.equal(isPreviewTooLarge(1024), false);
  assert.equal(isPreviewTooLarge(21 * 1024 * 1024), true);
  assert.equal(isPreviewTooLarge(0), false);
  assert.equal(isPreviewTooLarge(undefined), false);
});

test("parsea CSV con comillas, comas internas y saltos de línea", () => {
  const { rows, truncated } = parseDelimitedText(
    'Nombre,Nota\r\n"García, Ana","dijo ""hola""\ny siguió"\r\nLuis,10'
  );
  assert.equal(truncated, false);
  assert.deepEqual(rows, [
    ["Nombre", "Nota"],
    ["García, Ana", 'dijo "hola"\ny siguió'],
    ["Luis", "10"],
  ]);
});

test("parsea TSV y recorta las filas al máximo", () => {
  const text = Array.from({ length: 20 }, (_, i) => `a${i}\tb${i}`).join("\n");
  const { rows, truncated } = parseDelimitedText(text, { delimiter: "\t", maxRows: 5 });
  assert.equal(rows.length, 5);
  assert.equal(truncated, true);
  assert.deepEqual(rows[0], ["a0", "b0"]);
});

test("extrae los párrafos de una diapositiva PPTX desde su XML", () => {
  const xml = `<p:sld><p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Portada del </a:t></a:r><a:r><a:t>proyecto</a:t></a:r></a:p>
    <a:p><a:r><a:t>Presupuesto &amp; alcance &#8212; 2026</a:t></a:r></a:p>
    <a:p><a:endParaRPr/></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`;
  assert.deepEqual(extractSlideParagraphs(xml), [
    "Portada del proyecto",
    "Presupuesto & alcance — 2026",
  ]);
  assert.deepEqual(extractSlideParagraphs("<p:sld/>"), []);
});

test("decodifica entidades XML y ordena diapositivas por número", () => {
  assert.equal(decodeXmlEntities("&lt;a&gt; &amp; &quot;b&quot; &#233;"), '<a> & "b" é');
  assert.equal(slideNumberOf("ppt/slides/slide12.xml"), 12);
  assert.deepEqual(
    sortSlidePaths(["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]),
    ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide10.xml"]
  );
});
