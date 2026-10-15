/**
 * Bandeja de notificaciones del panel (historial persistente en el navegador).
 *
 * Problema que resuelve: un aviso push aparece como *toast* unos segundos y, si
 * el usuario no estaba mirando la pantalla, se pierde para siempre. Aquí cada
 * notificación recibida con la sesión iniciada se guarda en `localStorage`, de
 * modo que se puede volver a consultar desde la campana 🔔 del encabezado.
 *
 * Decisiones:
 *  - **Una bandeja por usuario** (`appsline.notifications.<id>`): dos cuentas en
 *    el mismo navegador no se ven los avisos entre sí.
 *  - Cada aviso guarda `read` / `readAt`. El contador de la pestaña
 *    (`document.title` + favicon) y la insignia de la campana se calculan desde
 *    aquí, así que el "sin leer" sobrevive a una recarga y no se pierde cuando
 *    el *toast* desaparece.
 *  - **Sin DOM ni React**: son funciones puras para poder probarlas con
 *    `node --test` (ver `tests/unit/notification-inbox.test.mjs`).
 *  - Si `localStorage` no está disponible (modo privado, SSR, cuota llena) se
 *    usa memoria: el centro de notificaciones sigue funcionando mientras dure la
 *    sesión, solo que sin persistir.
 */

/** Prefijo de la clave por usuario: `appsline.notifications.<userId>`. */
export const INBOX_STORAGE_PREFIX = "appsline.notifications";

/** Máximo de avisos guardados por usuario (los más recientes mandan). */
export const INBOX_LIMIT = 100;

/** Evento de `window` que avisa a la app (y a las otras pestañas) de un cambio. */
export const INBOX_EVENT = "appsline:notifications";

/**
 * Ventana en la que un aviso con el mismo `tag` **reemplaza** al anterior en
 * lugar de acumularse: es el mismo comportamiento que el de la notificación del
 * sistema (`renotify`), y evita duplicados si FCM reentrega el mensaje.
 */
export const INBOX_TAG_WINDOW_MS = 5 * 60 * 1000;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Respaldo en memoria cuando `localStorage` no está disponible. */
const memory = new Map();

/* ------------------------------------------------------------------ */
/* Almacenamiento                                                     */
/* ------------------------------------------------------------------ */

/** `appsline.notifications.<userId>` (o `.anon` si no hay sesión). */
export const inboxKey = (userId) =>
  `${INBOX_STORAGE_PREFIX}.${userId === null || userId === undefined || userId === ""
    ? "anon"
    : String(userId)}`;

const getStorage = () => {
  try {
    const store =
      typeof globalThis !== "undefined" ? globalThis.localStorage : null;
    if (store && typeof store.getItem === "function") return store;
  } catch {
    /* acceso bloqueado (modo privado, iframe restringido...) */
  }
  return null;
};

const readRaw = (key) => {
  const store = getStorage();
  let raw = null;
  if (store) {
    try {
      raw = store.getItem(key);
    } catch {
      raw = null;
    }
  } else {
    raw = memory.has(key) ? memory.get(key) : null;
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRaw = (key, list) => {
  const store = getStorage();
  if (!store) {
    memory.set(key, JSON.stringify(list));
    return list;
  }
  try {
    store.setItem(key, JSON.stringify(list));
  } catch {
    // Cuota llena o modo privado: al menos se conserva durante la sesión.
    memory.set(key, JSON.stringify(list));
  }
  return list;
};

/**
 * Avisa a la app de que la bandeja cambió (misma pestaña) y, vía evento
 * `storage`, a las demás pestañas abiertas del panel.
 */
const emitInboxChange = (userId, detail = {}) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  try {
    window.dispatchEvent(
      new CustomEvent(INBOX_EVENT, {
        detail: { key: inboxKey(userId), userId: userId ?? null, ...detail },
      })
    );
  } catch {
    /* entorno sin CustomEvent: la siguiente lectura traerá el estado */
  }
};

/* ------------------------------------------------------------------ */
/* Normalización                                                      */
/* ------------------------------------------------------------------ */

/** Texto de una línea, sin HTML de sobra y con tope de longitud. */
const text = (value, max = 300) => {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

/** Hash corto y estable: sirve para identificar avisos sin id propio. */
const shortHash = (value) => {
  const raw = String(value);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const KIND_PATTERNS = [
  [/task|tarea/i, "task"],
  [/project|proyecto/i, "project"],
  [/client|cliente/i, "client"],
  [/report|reporte/i, "report"],
  [/comment|comentario|message|mensaje|chat|mention|mencion/i, "message"],
];

/**
 * Categoría del aviso (solo para elegir el icono y el tono en la interfaz).
 * Se deduce del `type` que manda la API y, si no hay, del `tag`, la URL o el
 * título. Nunca falla: sin coincidencias devuelve `"system"`.
 */
export const inboxKind = (source = {}) => {
  const explicit = text(source.type || source.kind || source.category, 60);
  const candidates = [explicit, source.tag, source.url, source.title];
  for (const candidate of candidates) {
    const value = text(candidate, 200);
    if (!value) continue;
    for (const [pattern, kind] of KIND_PATTERNS) {
      if (pattern.test(value)) return kind;
    }
    // El `type` explícito manda: si no coincide con ninguna categoría conocida,
    // no se sigue buscando en el resto de campos.
    if (value === explicit) return "system";
  }
  return "system";
};

/**
 * Convierte lo que llega del push (payload crudo de FCM **o** el que reenvía el
 * service worker, ya aplanado) en un aviso de la bandeja.
 */
export const notificationFromPayload = (payload = {}) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const data =
    source.data && typeof source.data === "object" ? source.data : {};
  const notification =
    source.notification && typeof source.notification === "object"
      ? source.notification
      : {};

  const title =
    text(source.title || notification.title || data.title, 120) ||
    "Nueva notificación";
  const body = text(source.body || notification.body || data.body, 400);
  const url = text(
    source.url || data.url || data.link || data.click_action || "",
    500
  );
  const tag = text(source.tag || data.tag || notification.tag || "", 80);
  const createdAt =
    Number(
      source.received_at ||
        data.received_at ||
        source.created_at ||
        data.created_at
    ) || Date.now();
  const explicitId =
    source.id ||
    data.notification_id ||
    data.notificationId ||
    data.id ||
    "";
  const id =
    text(explicitId, 120) ||
    `n-${createdAt}-${shortHash(`${title}|${body}|${tag}`)}`;

  return {
    id,
    title,
    body,
    url,
    tag,
    kind: inboxKind({
      type: source.kind || source.type || data.kind || data.type || data.category,
      tag,
      url,
      title,
    }),
    createdAt,
    read: false,
    readAt: null,
  };
};

/** Sanea un aviso leído de `localStorage` (o `null` si no es utilizable). */
export const normalizeInboxEntry = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const title = text(raw.title, 120);
  const body = text(raw.body, 400);
  if (!title && !body) return null;
  const createdAt =
    Number(raw.createdAt ?? raw.received_at ?? raw.receivedAt) || Date.now();
  const readAt = Number(raw.readAt) || null;
  return {
    id: text(raw.id, 120) || `n-${createdAt}-${shortHash(`${title}|${body}`)}`,
    title: title || "Nueva notificación",
    body,
    url: text(raw.url, 500),
    tag: text(raw.tag, 80),
    kind: inboxKind({ type: raw.kind || raw.type, tag: raw.tag, url: raw.url, title }),
    createdAt,
    read: raw.read === true || Boolean(readAt),
    readAt,
  };
};

/** Ordena (más recientes primero) y recorta al límite de la bandeja. */
const tidy = (list) =>
  (Array.isArray(list) ? list : [])
    .map(normalizeInboxEntry)
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, INBOX_LIMIT);

/* ------------------------------------------------------------------ */
/* Lectura / escritura                                                */
/* ------------------------------------------------------------------ */

/** Notificaciones guardadas del usuario (más recientes primero). */
export const readInbox = (userId) => tidy(readRaw(inboxKey(userId)));

/** Guarda la lista completa (saneada) y avisa del cambio. */
export const writeInbox = (userId, list) => {
  const clean = tidy(list);
  writeRaw(inboxKey(userId), clean);
  emitInboxChange(userId, { action: "write", total: clean.length });
  return clean;
};

/** Avisos sin leer de una lista. */
export const unreadCount = (list = []) =>
  (Array.isArray(list) ? list : []).filter((item) => item && item.read !== true)
    .length;

/** Resumen para la cabecera del panel (`{ total, unread, read }`). */
export const inboxSummary = (list = []) => {
  const total = Array.isArray(list) ? list.length : 0;
  const unread = unreadCount(list);
  return { total, unread, read: total - unread, hasUnread: unread > 0 };
};

/**
 * ¿Este aviso reemplaza a otro ya guardado?
 *  1. Mismo `id` → es el mismo aviso reenviado.
 *  2. Mismo `tag` dentro de la ventana de `renotify` → FCM lo envió otra vez.
 */
const findReplacementIndex = (list, candidate) => {
  const byId = list.findIndex((item) => item.id === candidate.id);
  if (byId >= 0) return byId;
  if (!candidate.tag) return -1;
  return list.findIndex(
    (item) =>
      item.tag &&
      item.tag === candidate.tag &&
      Math.abs(item.createdAt - candidate.createdAt) <= INBOX_TAG_WINDOW_MS
  );
};

/**
 * Guarda un aviso recibido por push.
 *
 * @returns {{ entry: object, added: boolean, list: object[] }}
 *   `added: false` significa que ya estaba guardado (reenvío), así que quien
 *   llame **no** debería volver a sonar ni mostrar el *toast*.
 */
export const addInboxEntry = (userId, payload = {}) => {
  const candidate = notificationFromPayload(payload);
  const current = readInbox(userId);
  const index = findReplacementIndex(current, candidate);

  if (index >= 0) {
    const previous = current[index];
    const merged = {
      ...candidate,
      // Un reenvío no revive como "sin leer" algo que el usuario ya había visto.
      read: previous.read,
      readAt: previous.readAt,
    };
    const next = [...current];
    next[index] = merged;
    return { entry: merged, added: false, list: writeInbox(userId, next) };
  }

  return {
    entry: candidate,
    added: true,
    list: writeInbox(userId, [candidate, ...current]),
  };
};

/** Marca **todas** las notificaciones como leídas (clic en la campana). */
export const markAllRead = (userId) => {
  const now = Date.now();
  const list = readInbox(userId).map((item) =>
    item.read ? item : { ...item, read: true, readAt: now }
  );
  return writeInbox(userId, list);
};

/** Marca una notificación como leída (clic en el aviso o en la del sistema). */
export const markEntryRead = (userId, id) => {
  const target = text(id, 120);
  if (!target) return readInbox(userId);
  const now = Date.now();
  const list = readInbox(userId).map((item) =>
    item.id === target && !item.read ? { ...item, read: true, readAt: now } : item
  );
  return writeInbox(userId, list);
};

/** Quita un aviso de la bandeja. */
export const removeInboxEntry = (userId, id) => {
  const target = text(id, 120);
  const list = readInbox(userId).filter((item) => item.id !== target);
  return writeInbox(userId, list);
};

/** Vacía la bandeja del usuario. */
export const clearInbox = (userId) => writeInbox(userId, []);

/* ------------------------------------------------------------------ */
/* Suscripción a cambios (incluidas las otras pestañas)               */
/* ------------------------------------------------------------------ */

/**
 * Escucha los cambios de la bandeja del usuario.
 *
 * @param {string|number|null} userId
 * @param {(list: object[]) => void} handler recibe la lista ya releída
 * @returns {() => void} deja de escuchar
 */
export const subscribeToInbox = (userId, handler) => {
  if (typeof handler !== "function") return () => {};
  if (typeof window === "undefined") return () => {};

  const key = inboxKey(userId);

  const onLocal = (event) => {
    const detail = event?.detail || {};
    if (detail.key && detail.key !== key) return;
    handler(readInbox(userId));
  };
  // Otra pestaña del mismo navegador escribió la bandeja.
  const onStorage = (event) => {
    const changedKey = event?.key || "";
    if (changedKey && changedKey !== key) return;
    handler(readInbox(userId));
  };

  window.addEventListener(INBOX_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(INBOX_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
};

/* ------------------------------------------------------------------ */
/* Presentación                                                       */
/* ------------------------------------------------------------------ */

/** Hora corta para la lista: "ahora", "hace 12 min", "hace 3 h", "12 ene". */
export const formatInboxTime = (createdAt, now = Date.now()) => {
  const ts = Number(createdAt) || 0;
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return "ahora";
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) return `hace ${Math.floor(diff / DAY)} d`;
  try {
    const date = new Date(ts);
    const label = date
      .toLocaleDateString("es-MX", { day: "numeric", month: "short" })
      .replace(".", "");
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return sameYear ? label : `${label} ${date.getFullYear()}`;
  } catch {
    return new Date(ts).toLocaleDateString?.() || "";
  }
};

export default {
  INBOX_STORAGE_PREFIX,
  INBOX_LIMIT,
  INBOX_EVENT,
  inboxKey,
  inboxKind,
  notificationFromPayload,
  normalizeInboxEntry,
  readInbox,
  writeInbox,
  unreadCount,
  inboxSummary,
  addInboxEntry,
  markAllRead,
  markEntryRead,
  removeInboxEntry,
  clearInbox,
  subscribeToInbox,
  formatInboxTime,
};
