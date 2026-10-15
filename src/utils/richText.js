/**
 * Texto enriquecido (descripciones de tareas y comentarios).
 *
 * El panel guarda **HTML sencillo** en los campos de texto (descripción de una
 * tarea, cuerpo de un comentario) para que el equipo pueda usar negritas,
 * cursivas, listas con viñetas o numeradas, enlaces y citas. La fuente de
 * verdad sigue siendo un `string`: la API no cambia de forma (ver
 * `docs/API-TASKS.md`).
 *
 * Estas utilidades son puras (no tocan el DOM) y hacen tres cosas:
 *
 *  1. **Sanear** el HTML antes de pintarlo (`sanitizeHtml`): lista blanca de
 *     etiquetas y atributos, sin `on*`, sin `style`, sin `iframe`/`script`.
 *     Así, aunque el contenido venga de la API (o de un pegado con basura de
 *     Word/Google Docs), el panel nunca ejecuta nada.
 *  2. **Convertir** entre HTML y texto plano (`htmlToText`, `plainTextToHtml`)
 *     para buscadores, resúmenes y vistas de una sola línea.
 *  3. **Resaltar @menciones** dentro del HTML (`highlightMentionsInHtml`).
 *
 * Los textos antiguos (comentarios guardados como texto plano) siguen
 * funcionando: `looksLikeHtml` decide si hay que sanear o solo escapar.
 */
import { escapeRegExp, findMentionSpans } from "./mentions.js";

/* ------------------------------------------------------------------ */
/* Etiquetas permitidas                                                */
/* ------------------------------------------------------------------ */

/** Etiquetas que se conservan al sanear (todo lo demás se descarta). */
export const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "pre",
  "code",
  "hr",
  "div",
  "span",
  "sub",
  "sup",
]);

/** Etiquetas sin cierre. */
export const VOID_TAGS = new Set(["br", "hr"]);

/**
 * Etiquetas peligrosas: no solo se descarta la etiqueta, también su contenido
 * (`<script>alert(1)</script>` no debe dejar "alert(1)" en el texto).
 */
export const SKIPPED_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
]);

/**
 * Equivalencias para dejar el HTML guardado consistente:
 * los editores visuales producen `div` en cada salto de línea y `b`/`i`
 * en los botones de negrita y cursiva.
 */
const TAG_ALIASES = {
  div: "p",
  b: "strong",
  i: "em",
  strike: "s",
  del: "s",
  ins: "u",
  font: "span",
};

/** Etiquetas cuyo contenido se muestra como bloque (añaden salto de línea). */
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "pre",
  "li",
  "ul",
  "ol",
  "hr",
]);

/**
 * Cierres implícitos del HTML (igual que hace el navegador):
 * al abrir `<li>` se cierra el `<li>` anterior, y un párrafo/lista cierra el
 * `<p>` que siguiera abierto.
 */
const IMPLIED_CLOSES = {
  li: ["li", "p"],
  p: ["p", "li"],
  ul: ["p", "li"],
  ol: ["p", "li"],
  blockquote: ["p"],
  pre: ["p"],
  h1: ["p"],
  h2: ["p"],
  h3: ["p"],
  h4: ["p"],
  hr: ["p"],
};

/** Etiquetas que se permiten abrir junto a un enlace. */
const ATTRIBUTES_BY_TAG = { a: new Set(["href", "title"]) };

/** Protocolos y rutas admitidos en `href` (fuera de esto se quita el enlace). */
const SAFE_HREF = /^(?:https?:|mailto:|tel:|\/|#|\.{1,2}\/)/i;

/** Detección de etiquetas conocidas: decide si un valor es HTML o texto. */
const HTML_HINT =
  /<\/?(?:p|div|br|strong|b|em|i|u|s|del|ins|ul|ol|li|a|h[1-6]|blockquote|pre|code|span|sub|sup|hr)\b/i;

/** Un token `<etiqueta ...>` completo (para separar el HTML del texto). */
const TAG_TOKEN = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\/?>$/;

/* ------------------------------------------------------------------ */
/* Utilidades básicas                                                  */
/* ------------------------------------------------------------------ */

/** ¿El valor parece HTML (trae etiquetas) o es texto plano? */
export const looksLikeHtml = (value) => HTML_HINT.test(String(value ?? ""));

/**
 * Escapa un nodo de texto para incrustarlo en HTML **sin** romper las
 * entidades que ya vienen escapadas (`&amp;`, `&#39;`, …).
 */
export const escapeText = (value) =>
  String(value ?? "")
    .replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Escapa el valor de un atributo HTML. */
const escapeAttribute = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Entidades habituales al pasar de HTML a texto. */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  bull: "•",
};

/** Convierte entidades HTML en su carácter (solo las conocidas). */
export const decodeEntities = (value) =>
  String(value ?? "").replace(
    /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g,
    (match, entity) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
      }
      const named = NAMED_ENTITIES[entity.toLowerCase()];
      return named === undefined ? match : named;
    }
  );

/**
 * Divide un HTML en tokens: etiquetas (`type: "tag"`) y texto
 * (`type: "text"`). Un `<` suelto sin `>` se queda como texto, así que
 * un comentario del tipo "precio < 5" no se pierde.
 */
export const tokenizeHtml = (value) =>
  String(value ?? "")
    .split(/(<[^>]*>)/)
    .filter((piece) => piece !== "")
    .map((piece) => {
      const match = TAG_TOKEN.exec(piece);
      if (!match) return { type: "text", value: piece };
      return {
        type: "tag",
        // El texto original permite reconstruir el HTML al resaltar menciones.
        value: piece,
        closing: match[1] === "/",
        name: match[2].toLowerCase(),
        attributes: match[3] || "",
      };
    });

/** Lee los atributos `nombre="valor"` de una etiqueta. */
const readAttributes = (raw) => {
  const found = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = pattern.exec(raw))) {
    found[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return found;
};

/** Etiqueta final con equivalencias aplicadas (`<div>` -> `<p>`). */
const normalizeTagName = (name) => TAG_ALIASES[name] || name;

/* ------------------------------------------------------------------ */
/* Saneado                                                             */
/* ------------------------------------------------------------------ */

/**
 * Deja solo el HTML permitido, bien cerrado y sin atributos peligrosos.
 *
 * - Lista blanca de etiquetas (ver `ALLOWED_TAGS`).
 * - En `<a>` solo sobreviven `href`/`title`, y únicamente con protocolos
 *   seguros (`http`, `https`, `mailto`, `tel`) o rutas relativas.
 * - Se cierran automáticamente las etiquetas que queden abiertas.
 *
 * @example sanitizeHtml('<p>Hola <script>x</script><b>equipo</b>')
 *   // '<p>Hola equipo<strong>equipo</strong></p>'
 */
export const sanitizeHtml = (value) => {
  const output = [];
  const stack = [];
  /** Nombre de la etiqueta peligrosa cuya contenido se está descartando. */
  let skipping = null;

  const closeDownTo = (name) => {
    const index = stack.lastIndexOf(name);
    if (index === -1) return "";
    let html = "";
    for (let i = stack.length - 1; i >= index; i -= 1) html += `</${stack[i]}>`;
    stack.length = index;
    return html;
  };

  for (const token of tokenizeHtml(value)) {
    if (skipping) {
      if (token.type === "tag" && token.closing && token.name === skipping) skipping = null;
      continue;
    }

    if (token.type === "text") {
      output.push(escapeText(token.value));
      continue;
    }

    if (!token.closing && SKIPPED_CONTENT_TAGS.has(token.name)) {
      skipping = token.name;
      continue;
    }
    if (token.closing && SKIPPED_CONTENT_TAGS.has(token.name)) continue;

    const name = normalizeTagName(token.name);
    if (!ALLOWED_TAGS.has(name)) continue;

    if (token.closing) {
      if (VOID_TAGS.has(name)) continue;
      output.push(closeDownTo(name));
      continue;
    }

    if (VOID_TAGS.has(name)) {
      output.push(`<${name}>`);
      continue;
    }

    // Cierra la etiqueta que quedaría abierta e incompatible (li, p…).
    const implied = IMPLIED_CLOSES[name];
    const top = stack[stack.length - 1];
    if (implied && top && implied.includes(top)) output.push(closeDownTo(top));

    const allowedAttributes = ATTRIBUTES_BY_TAG[name];
    let attributes = "";
    if (allowedAttributes) {
      const parsed = readAttributes(token.attributes);
      for (const [key, raw] of Object.entries(parsed)) {
        if (!allowedAttributes.has(key)) continue;
        if (key === "href" && !SAFE_HREF.test(raw.trim())) continue;
        const value = raw.trim();
        if (!value) continue;
        attributes += ` ${key}="${escapeAttribute(value)}"`;
      }
    }

    output.push(`<${name}${attributes}>`);
    stack.push(name);
  }

  // Cierra lo que el usuario dejara abierto (`<strong>sin cerrar`).
  while (stack.length) output.push(`</${stack.pop()}>`);

  return output.join("");
};

/* ------------------------------------------------------------------ */
/* HTML <-> texto                                                      */
/* ------------------------------------------------------------------ */

/**
 * Convierte a texto plano: ideal para buscadores, resúmenes y avisos.
 * Los bloques y las listas se separan con saltos de línea y las viñetas se
 * escriben con `•` o `1.` para que el texto suelto siga siendo legible.
 */
export const htmlToText = (value) => {
  const pieces = [];
  /** Listas abiertas: `{ ordered, count }` para numerar `1. 2. 3.`. */
  const lists = [];

  const endsWithNewline = () => {
    const last = pieces[pieces.length - 1];
    return !last || last.endsWith("\n");
  };
  const pushNewline = () => {
    if (!endsWithNewline()) pieces.push("\n");
  };
  const pushBreak = () => {
    pieces.push("\n");
  };

  for (const token of tokenizeHtml(value)) {
    if (token.type === "text") {
      pieces.push(decodeEntities(token.value));
      continue;
    }

    const name = normalizeTagName(token.name);

    if (name === "br" || name === "hr") {
      pushBreak();
      continue;
    }

    if (token.closing) {
      if (name === "ul" || name === "ol") lists.pop();
      if (BLOCK_TAGS.has(name)) pushNewline();
      continue;
    }

    if (name === "ul" || name === "ol") {
      pushNewline();
      lists.push({ ordered: name === "ol", count: 0 });
      continue;
    }

    if (name === "li") {
      pushNewline();
      const list = lists[lists.length - 1] || { ordered: false, count: 0 };
      list.count += 1;
      const explicit = Number(token.attributes.match(/value\s*=\s*"?(\d+)/)?.[1]);
      if (Number.isFinite(explicit)) list.count = explicit;
      pieces.push(list.ordered ? `${list.count}. ` : "• ");
      continue;
    }

    if (BLOCK_TAGS.has(name)) pushNewline();
  }

  return pieces
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u00a0/g, " ")
    .trim();
};

/** Texto plano -> HTML: escapa y convierte los saltos en `<br>`. */
export const plainTextToHtml = (value) =>
  escapeText(String(value ?? "").replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");

/**
 * Valor listo para pintar o para cargar en el editor: sanea si es HTML y
 * escapa si es texto plano.
 */
export const toRichHtml = (value) => {
  const raw = String(value ?? "");
  if (!raw.replace(/\u00a0/g, " ").trim()) return "";
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : plainTextToHtml(raw);
};

/** Texto plano de un valor que puede ser HTML o texto plano. */
export const richTextToPlain = (value) => htmlToText(value);

/** ¿El campo está vacío? (ignora espacios y párrafos vacíos). */
export const isEmptyRichText = (value) => richTextToPlain(value) === "";

/** Longitud del texto visible (sin etiquetas). */
export const richTextLength = (value) => richTextToPlain(value).length;

/** Primer `limit` caracteres del texto visible (resúmenes y notificaciones). */
export const richTextPreview = (value, limit = 140) => {
  const text = richTextToPlain(value);
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
};

/* ------------------------------------------------------------------ */
/* @Menciones dentro del HTML                                          */
/* ------------------------------------------------------------------ */

/** Envuelve las @menciones de un fragmento de texto ya escapado. */
const wrapMentions = (text, people) => {
  const spans = findMentionSpans(text, people);
  if (!spans.length) return text;

  let output = "";
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    output += text.slice(cursor, span.start);
    output += `<span class="rich-mention">${text.slice(span.start, span.end)}</span>`;
    cursor = span.end;
  }
  output += text.slice(cursor);
  return output;
};

/**
 * HTML saneado con las @menciones resaltadas (`<span class="rich-mention">`).
 * Es lo que pinta el componente `<RichText />`.
 */
export const highlightMentionsInHtml = (value, people = []) => {
  const html = toRichHtml(value);
  if (!html) return "";
  // Sin menciones se evita el recorrido completo.
  if (!html.includes("@")) return html;

  return tokenizeHtml(html)
    .map((token) =>
      token.type === "text" ? wrapMentions(token.value, people) : token.value
    )
    .join("");
};

/** Etiquetas en línea que quedan vacías al quitar una mención. */
const EMPTY_INLINE_TAG = /<(strong|b|em|i|u|s|span|a)>\s*<\/\1>/g;

/** Limpia las etiquetas que se quedan sin contenido (`<strong></strong>`). */
const pruneEmptyInlineTags = (html) => {
  let current = html;
  for (let i = 0; i < 3; i += 1) {
    const next = current.replace(EMPTY_INLINE_TAG, "");
    if (next === current) break;
    current = next;
  }
  return current;
};

/**
 * Quita la primera mención de `name` conservando el formato del resto.
 * Se usa en el botón "×" de las fichas de personas mencionadas.
 */
export const removeMentionFromHtml = (value, name = "") => {
  if (!name) return toRichHtml(value);
  const pattern = new RegExp(`@${escapeRegExp(name)}\\s?`, "i");
  let removed = false;

  const html = tokenizeHtml(toRichHtml(value))
    .map((token) => {
      if (token.type !== "text" || removed || !pattern.test(token.value)) return token.value;
      removed = true;
      return token.value.replace(pattern, "");
    })
    .join("");

  // Al quitar la mención quedan restos: " ," o espacios dobles.
  return pruneEmptyInlineTags(html)
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
};
