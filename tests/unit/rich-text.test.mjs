import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pruebas del texto enriquecido de tareas y comentarios
 * (`src/utils/richText.js`). Es la pieza que decide qué se guarda como HTML,
 * qué se descarta por seguridad y cómo se convierte a texto plano para los
 * buscadores, los resúmenes y los avisos del push.
 *
 * Son funciones puras: corren en Node sin navegador.
 */
import {
  decodeEntities,
  escapeText,
  highlightMentionsInHtml,
  htmlToText,
  isEmptyRichText,
  looksLikeHtml,
  plainTextToHtml,
  removeMentionFromHtml,
  richTextLength,
  richTextPreview,
  sanitizeHtml,
  toRichHtml,
  tokenizeHtml,
} from "../../src/utils/richText.js";

const PEOPLE = [
  { id: 1, name: "Ana García" },
  { id: 2, name: "Luis Pérez" },
];

test("distingue texto plano de HTML", () => {
  assert.equal(looksLikeHtml("Hola equipo"), false);
  assert.equal(looksLikeHtml("<p>Hola equipo</p>"), true);
  assert.equal(looksLikeHtml("<ul><li>uno</li></ul>"), true);
  assert.equal(looksLikeHtml("precio < 5 y > 3"), false);
});

test("el saneado elimina etiquetas y atributos peligrosos", () => {
  assert.equal(sanitizeHtml("<script>alert(1)</script>Hola"), "Hola");
  assert.equal(
    sanitizeHtml('<p onclick="robar()">Hola</p>'),
    "<p>Hola</p>"
  );
  assert.equal(
    sanitizeHtml('<iframe src="https://mal.example"></iframe>Texto'),
    "Texto"
  );
  assert.equal(sanitizeHtml('<p style="color:red">Hola</p>'), "<p>Hola</p>");
  assert.equal(sanitizeHtml("<div>Hola</div>"), "<p>Hola</p>");
});

test("los enlaces solo sobreviven con protocolos seguros", () => {
  assert.equal(
    sanitizeHtml('<a href="https://appsline.com.mx">Web</a>'),
    '<a href="https://appsline.com.mx">Web</a>'
  );
  assert.equal(
    sanitizeHtml('<a href="/admin/projects/12">Proyecto</a>'),
    '<a href="/admin/projects/12">Proyecto</a>'
  );
  assert.equal(
    sanitizeHtml('<a href="javascript:alert(1)">Golpe</a>'),
    "<a>Golpe</a>"
  );
  assert.equal(
    sanitizeHtml('<a href="https://x.dev" onclick="x()">x</a>'),
    '<a href="https://x.dev">x</a>'
  );
});

test("el saneado cierra lo que quede abierto y conserva listas", () => {
  assert.equal(sanitizeHtml("<strong>sin cerrar"), "<strong>sin cerrar</strong>");
  assert.equal(
    sanitizeHtml("<ul><li>uno<li>dos</ul>"),
    "<ul><li>uno</li><li>dos</li></ul>"
  );
  assert.equal(sanitizeHtml("<p>negrita <b>sí</b></p>"), "<p>negrita <strong>sí</strong></p>");
});

test("HTML a texto plano: párrafos, listas y entidades", () => {
  assert.equal(htmlToText("<p>uno</p><p>dos</p>"), "uno\ndos");
  assert.equal(htmlToText("<ul><li>uno</li><li>dos</li></ul>"), "• uno\n• dos");
  assert.equal(htmlToText("<ol><li>uno</li><li>dos</li></ol>"), "1. uno\n2. dos");
  assert.equal(htmlToText("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(htmlToText("línea<br>siguiente"), "línea\nsiguiente");
  assert.equal(htmlToText("<blockquote>cita</blockquote>"), "cita");
  assert.equal(decodeEntities("&#39;ok&#39; &nbsp;"), "'ok' \u00a0");
});

test("texto plano a HTML escapa y respeta los saltos", () => {
  assert.equal(plainTextToHtml("a\nb"), "a<br>b");
  assert.equal(plainTextToHtml("<b>no es html</b>"), "&lt;b&gt;no es html&lt;/b&gt;");
  assert.equal(escapeText("Tom & Jerry"), "Tom &amp; Jerry");
  assert.equal(escapeText("ya escapado &amp;"), "ya escapado &amp;");
});

test("toRichHtml acepta texto antiguo y es idempotente con HTML", () => {
  assert.equal(toRichHtml("Hola\n\nEquipo"), "Hola<br><br>Equipo");
  assert.equal(toRichHtml("<p><b>Hola</b></p>"), "<p><strong>Hola</strong></p>");
  assert.equal(toRichHtml(toRichHtml("<p><b>Hola</b></p>")), "<p><strong>Hola</strong></p>");
  assert.equal(toRichHtml("   "), "");
});

test("detecta campos vacíos y genera resúmenes", () => {
  assert.equal(isEmptyRichText("<p><br></p>"), true);
  assert.equal(isEmptyRichText("<p>&nbsp;</p>"), true);
  assert.equal(isEmptyRichText("<p>algo</p>"), false);
  assert.equal(richTextLength("<p>Hola</p>"), 4);
  assert.equal(richTextPreview("<p>Hola equipo</p>", 6), "Hola…");
  assert.equal(richTextPreview("<p>Corto</p>", 20), "Corto");
});

test("resalta las @menciones del HTML sin romper el formato", () => {
  const html = highlightMentionsInHtml(
    "<p>Hola <strong>@Ana García</strong>, revisa con @Luis Pérez</p>",
    PEOPLE
  );
  assert.match(html, /<span class="rich-mention">@Ana García<\/span>/);
  assert.match(html, /<span class="rich-mention">@Luis Pérez<\/span>/);
  assert.match(html, /<strong>/);
});

test("quita una mención conservando el resto del formato", () => {
  const html = removeMentionFromHtml(
    "<p>Hola <strong>@Ana García</strong>, gracias</p>",
    "Ana García"
  );
  assert.equal(html, "<p>Hola, gracias</p>");
});

test("el tokenizador no se rompe con signos sueltos", () => {
  const tokens = tokenizeHtml("precio < 5 > 3");
  assert.equal(tokens.every((token) => token.type === "text"), true);
  assert.equal(
    tokens.map((token) => token.value).join(""),
    "precio < 5 > 3"
  );
});
