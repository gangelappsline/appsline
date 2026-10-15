import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pruebas de la bandeja de notificaciones (`src/utils/notificationInbox.js`).
 *
 * Es la pieza que hace que un aviso push **no se pierda** cuando el *toast*
 * desaparece: se guarda en `localStorage` y se consulta desde la campana del
 * encabezado. Aquí se comprueba, sin navegador, que:
 *  - el aviso se guarda y sobrevive a una recarga,
 *  - un reenvío del mismo mensaje no se duplica (ni vuelve a contar como nuevo),
 *  - "marcar como leído" es lo único que apaga el contador,
 *  - dos cuentas en el mismo navegador no se mezclan.
 */
import {
  INBOX_LIMIT,
  addInboxEntry,
  clearInbox,
  formatInboxTime,
  inboxKey,
  inboxKind,
  markAllRead,
  markEntryRead,
  notificationFromPayload,
  readInbox,
  removeInboxEntry,
  subscribeToInbox,
  unreadCount,
} from "../../src/utils/notificationInbox.js";

/* ------------------------------------------------------------------ */
/* Entorno mínimo: localStorage + window en memoria                   */
/* ------------------------------------------------------------------ */

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

const installBrowserStubs = () => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = new EventTarget();
  return globalThis.localStorage;
};

/** Rellena la bandeja hasta `count` avisos con marcas de tiempo crecientes. */
const seed = (userId, count) => {
  const base = Date.now() - count * 1000;
  for (let i = 0; i < count; i += 1) {
    addInboxEntry(userId, {
      title: `Aviso ${i}`,
      body: "cuerpo",
      received_at: base + i * 1000,
    });
  }
};

/* ------------------------------------------------------------------ */
/* Guardado y lectura                                                 */
/* ------------------------------------------------------------------ */

test("guarda una notificación push y la recupera al releer la bandeja", () => {
  installBrowserStubs();

  const { entry, added } = addInboxEntry(7, {
    title: "Nueva tarea asignada",
    body: "Revisar el sitio de Acme",
    url: "/admin/tasks?task=3",
    tag: "task-3",
    type: "task",
  });

  assert.equal(added, true);
  assert.equal(entry.title, "Nueva tarea asignada");
  assert.equal(entry.body, "Revisar el sitio de Acme");
  assert.equal(entry.url, "/admin/tasks?task=3");
  assert.equal(entry.kind, "task");
  assert.equal(entry.read, false);

  const list = readInbox(7);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, entry.id);
  assert.equal(list[0].read, false);
  assert.equal(unreadCount(list), 1);
});

test("la bandeja sobrevive a una recarga (se relee de localStorage)", () => {
  const storage = installBrowserStubs();
  addInboxEntry(1, { title: "Proyecto actualizado", body: "Cambió de estado" });

  // Simula una recarga: la lista se reconstruye desde lo persistido.
  const persisted = storage.getItem(inboxKey(1));
  assert.ok(persisted && persisted.includes("Proyecto actualizado"));
  assert.equal(readInbox(1).length, 1);
});

test("el payload crudo de FCM (notification + data) también se entiende", () => {
  installBrowserStubs();

  const entry = notificationFromPayload({
    notification: { title: "Comentario nuevo", body: "Ana comentó en Acme" },
    data: { url: "/admin/projects/12", tag: "project-12", type: "project" },
  });

  assert.equal(entry.title, "Comentario nuevo");
  assert.equal(entry.body, "Ana comentó en Acme");
  assert.equal(entry.url, "/admin/projects/12");
  assert.equal(entry.kind, "project");
});

test("normaliza textos largos y avisos sin título", () => {
  installBrowserStubs();

  const entry = notificationFromPayload({
    title: "",
    body: "x".repeat(900),
  });

  assert.equal(entry.title, "Nueva notificación");
  assert.ok(entry.body.length <= 400, "el cuerpo se recorta");
});

/* ------------------------------------------------------------------ */
/* Duplicados y reenvíos                                              */
/* ------------------------------------------------------------------ */

test("un reenvío del mismo aviso (mismo id) no se duplica ni revive como nuevo", () => {
  installBrowserStubs();

  addInboxEntry(3, {
    id: "notice-42",
    title: "Tarea por vencer",
    body: "Vence mañana",
  });
  markAllRead(3);
  assert.equal(unreadCount(readInbox(3)), 0);

  const { added, list } = addInboxEntry(3, {
    id: "notice-42",
    title: "Tarea por vencer",
    body: "Vence mañana",
  });

  assert.equal(added, false, "ya estaba guardado");
  assert.equal(list.length, 1, "no se duplica");
  assert.equal(list[0].read, true, "sigue leído");
  assert.equal(unreadCount(list), 0);
});

test("el mismo tag dentro de la ventana de renotify reemplaza al aviso anterior", () => {
  installBrowserStubs();

  const now = Date.now();
  addInboxEntry(5, { title: "Proyecto actualizado", tag: "project-9", received_at: now });
  const { added, list } = addInboxEntry(5, {
    title: "Proyecto actualizado",
    body: "Ahora está en curso",
    tag: "project-9",
    received_at: now + 5_000,
  });

  assert.equal(added, false);
  assert.equal(list.length, 1, "el tag agrupa el mismo evento");
  assert.equal(list[0].body, "Ahora está en curso");
});

test("dos avisos distintos se acumulan (más recientes primero)", () => {
  installBrowserStubs();

  const now = Date.now();
  addInboxEntry(2, { title: "Primero", received_at: now - 60_000 });
  addInboxEntry(2, { title: "Segundo", received_at: now });

  const titles = readInbox(2).map((item) => item.title);
  assert.deepEqual(titles, ["Segundo", "Primero"]);
});

test(`la bandeja se limita a ${INBOX_LIMIT} avisos (los más recientes mandan)`, () => {
  installBrowserStubs();

  seed(4, INBOX_LIMIT + 5);

  const list = readInbox(4);
  assert.equal(list.length, INBOX_LIMIT);
  assert.equal(list[0].title, `Aviso ${INBOX_LIMIT + 4}`);
  assert.equal(list.at(-1).title, "Aviso 5");
});

/* ------------------------------------------------------------------ */
/* Estado de lectura                                                  */
/* ------------------------------------------------------------------ */

test("marcar como leídas apaga el contador y queda persistido", () => {
  installBrowserStubs();

  addInboxEntry(1, { title: "Uno" });
  addInboxEntry(1, { title: "Dos" });
  assert.equal(unreadCount(readInbox(1)), 2);

  const after = markAllRead(1);
  assert.equal(unreadCount(after), 0);
  assert.equal(unreadCount(readInbox(1)), 0, "se relee igual: ya está guardado");
  assert.ok(after.every((item) => item.readAt > 0));
});

test("una notificación se puede marcar como leída por id", () => {
  installBrowserStubs();

  const { entry } = addInboxEntry(1, { title: "Solo esta" });
  addInboxEntry(1, { title: "Y esta otra" });

  markEntryRead(1, entry.id);
  const list = readInbox(1);
  assert.equal(list.find((item) => item.id === entry.id).read, true);
  assert.equal(unreadCount(list), 1);
});

test("se pueden quitar y vaciar notificaciones", () => {
  installBrowserStubs();

  const first = addInboxEntry(1, { title: "Primera" }).entry;
  addInboxEntry(1, { title: "Segunda" });

  assert.equal(removeInboxEntry(1, first.id).length, 1);
  assert.equal(clearInbox(1).length, 0);
  assert.equal(readInbox(1).length, 0);
});

/* ------------------------------------------------------------------ */
/* Aislamiento por usuario y sincronización                           */
/* ------------------------------------------------------------------ */

test("cada usuario tiene su propia bandeja", () => {
  installBrowserStubs();

  addInboxEntry("ana@example.test", { title: "De Ana" });
  addInboxEntry("luis@example.test", { title: "De Luis" });

  assert.deepEqual(readInbox("ana@example.test").map((n) => n.title), ["De Ana"]);
  assert.deepEqual(readInbox("luis@example.test").map((n) => n.title), ["De Luis"]);
  assert.equal(readInbox(99).length, 0);
  assert.equal(inboxKey("ana@example.test"), "appsline.notifications.ana@example.test");
  assert.equal(inboxKey(null), "appsline.notifications.anon");
});

test("la app se entera de los cambios de la bandeja (y de otras pestañas)", () => {
  installBrowserStubs();

  const seen = [];
  const unsubscribe = subscribeToInbox(1, (list) => seen.push(list.length));

  addInboxEntry(1, { title: "Aviso en esta pestaña" });
  assert.deepEqual(seen, [1], "el evento propio avisa al instante");

  // Otra pestaña escribió el mismo espacio: el evento `storage` la sincroniza.
  const storageEvent = new Event("storage");
  storageEvent.key = inboxKey(1);
  globalThis.localStorage.setItem(
    inboxKey(1),
    JSON.stringify([{ id: "x", title: "Desde otra pestaña", createdAt: Date.now() }])
  );
  globalThis.window.dispatchEvent(storageEvent);
  assert.deepEqual(seen, [1, 1]);

  // Un cambio de otro usuario no despierta a este.
  const otherUser = new Event("storage");
  otherUser.key = inboxKey(2);
  globalThis.window.dispatchEvent(otherUser);
  assert.equal(seen.length, 2);

  unsubscribe();
  addInboxEntry(1, { title: "Después de desuscribir" });
  assert.equal(seen.length, 2, "ya no escucha");
});

test("sin localStorage la bandeja sigue funcionando en memoria", () => {
  globalThis.localStorage = undefined;
  globalThis.window = new EventTarget();

  addInboxEntry("mem", { title: "Solo en memoria" });
  assert.equal(readInbox("mem").length, 1);
  assert.equal(unreadCount(readInbox("mem")), 1);
});

/* ------------------------------------------------------------------ */
/* Presentación                                                       */
/* ------------------------------------------------------------------ */

test("formatInboxTime describe el momento del aviso", () => {
  const now = Date.now();

  assert.equal(formatInboxTime(now, now), "ahora");
  assert.equal(formatInboxTime(now - 12 * 60_000, now), "hace 12 min");
  assert.equal(formatInboxTime(now - 3 * 3_600_000, now), "hace 3 h");
  assert.equal(formatInboxTime(now - 2 * 86_400_000, now), "hace 2 d");
  assert.equal(formatInboxTime(0, now), "");
  assert.match(formatInboxTime(now - 40 * 86_400_000, now), /\d/);
});

test("inboxKind clasifica el aviso para elegir el icono", () => {
  assert.equal(inboxKind({ type: "task_assigned" }), "task");
  assert.equal(inboxKind({ url: "/admin/projects/12" }), "project");
  assert.equal(inboxKind({ title: "Nuevo comentario en Acme" }), "message");
  assert.equal(inboxKind({ type: "lo-que-sea" }), "system");
  assert.equal(inboxKind({}), "system");
});
