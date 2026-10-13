/**
 * Utilidades para las @menciones dentro de los comentarios de tareas.
 *
 * El texto del comentario es la fuente de verdad (viaja tal cual al backend);
 * estas funciones solo lo interpretan: qué "@consulta" se está escribiendo y
 * qué nombres quedaron mencionados para resaltarlos o para saber a quién
 * notificar. Se usan desde `MentionComposer` y desde la lista de comentarios.
 */

/** Compara sin acentos ni mayúsculas ("Pérez" ~ "perez"). Mantiene la longitud. */
export const foldText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Normaliza candidatos a `{ id, name, ...resto }` y descarta entradas inútiles. */
export const normalizePeople = (people = []) =>
  (Array.isArray(people) ? people : [])
    .map((person) => ({
      ...person,
      id: person?.id,
      name: String(
        person?.name || person?.full_name || person?.username || person?.email || ""
      ).trim(),
    }))
    .filter(
      (person) =>
        person.id !== undefined && person.id !== null && person.id !== "" && person.name
    );

/** ¿La persona coincide con lo escrito después de la arroba? (todas las palabras) */
export const matchesMentionQuery = (person, query = "") => {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = foldText(`${person.name} ${person.email || ""}`);
  return words.every((word) => haystack.includes(word));
};

/**
 * Relevancia de una coincidencia: primero quien empieza con lo escrito,
 * después quien lo tiene al inicio de alguna palabra y al final el resto
 * ("@an" -> "Ana Torres" antes que "Juan Pérez").
 */
const matchScore = (person, query = "") => {
  const q = foldText(query).trim();
  if (!q) return 0;
  const name = foldText(person.name);
  if (name.startsWith(q)) return 0;
  if (name.split(/\s+/).some((word) => word.startsWith(q))) return 1;
  return 2;
};

/**
 * Sugerencias para la "@consulta" actual, ordenadas por relevancia
 * (vacío = todo el personal, hasta `limit`). Omite al usuario que está
 * escribiendo (`excludeId`), igual que Instagram.
 */
export const suggestPeople = (people = [], query = "", { excludeId = null, limit = 8 } = {}) =>
  normalizePeople(people)
    .filter((person) => String(person.id) !== String(excludeId ?? ""))
    .filter((person) => matchesMentionQuery(person, query))
    .map((person, index) => ({ person, index, score: matchScore(person, query) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.person);

/**
 * Detecta la "@consulta" que se está escribiendo justo antes del cursor.
 * @returns {{start:number,end:number,query:string}|null}
 */
export const mentionQueryAt = (value, caret) => {
  const text = String(value ?? "");
  const before = text.slice(0, caret ?? text.length);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  // La arroba debe abrir palabra: "@ana" sí, "correo@ana" no.
  if (at > 0 && !/\s|\(/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  // La búsqueda termina al primer espacio o arroba; tampoco es un texto infinito.
  if (query.length > 40 || /[\s@]/.test(query)) return null;
  return { start: at, end: at + 1 + query.length, query };
};

/**
 * Tramos `@Nombre` presentes en un texto ya guardado.
 * Primero busca los nombres conocidos (los más largos primero para no cortar
 * "@Juan Pérez" en "@Juan") y después un patrón genérico, de modo que también
 * se resalten menciones de personas que no vienen en la lista.
 * @returns {Array<{start:number,end:number,name:string}>}
 */
export const findMentionSpans = (value, people = []) => {
  const text = String(value ?? "");
  const folded = foldText(text);
  const spans = [];
  const overlaps = (start, end) =>
    spans.some((span) => start < span.end && end > span.start);

  const names = normalizePeople(people)
    .map((person) => person.name)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    const token = foldText(`@${name}`);
    let from = 0;
    for (;;) {
      const at = folded.indexOf(token, from);
      if (at === -1) break;
      const end = at + token.length;
      if (!overlaps(at, end)) spans.push({ start: at, end, name });
      from = at + 1;
    }
  }

  for (const match of text.matchAll(/@([\p{L}\p{N}][\p{L}\p{N}._-]*)/gu)) {
    const start = match.index;
    const end = start + match[0].length;
    if (!overlaps(start, end)) spans.push({ start, end, name: match[1] });
  }

  return spans.sort((a, b) => a.start - b.start);
};

/**
 * Personas de `people` que están mencionadas con "@" en un texto.
 * Es la fuente de verdad al guardar: funciona igual si el nombre se eligió en
 * el autocompletado, si se escribió a mano o si se pegó el comentario.
 * @returns {Array<object>} personas (con su id) sin repetir
 */
export const peopleMentionedIn = (value, people = []) => {
  const directory = normalizePeople(people);
  const found = findMentionSpans(value, people)
    .map((span) => directory.find((person) => foldText(person.name) === foldText(span.name)))
    .filter(Boolean);
  return found.filter(
    (person, index) =>
      found.findIndex((other) => String(other.id) === String(person.id)) === index
  );
};

/** Escapa un texto para usarlo dentro de un `RegExp`. */
export const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Quita la primera mención de `name` del texto (para el botón "x" de las fichas). */
export const removeMentionFromText = (value, name = "") => {
  if (!name) return String(value ?? "");
  return String(value ?? "")
    .replace(new RegExp(`@${escapeRegExp(name)}\\s?`, "i"), "")
    .replace(/[ \t]{2,}/g, " ")
    .trimStart();
};

/** ¿El texto todavía contiene la mención de `name`? (para descartar fichas borradas) */
export const textMentions = (value, name = "") =>
  Boolean(name) && foldText(value).includes(foldText(`@${name}`));
