import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/**
 * Pruebas del service worker de push (`public/firebase-messaging-sw.js`).
 *
 * No se puede ejercitar FCM real desde Node, así que el archivo se carga en un
 * `node:vm` con un service worker simulado: se verifica la parte con más
 * riesgo de romperse, es decir, cómo se interpreta el payload que envía la API
 * HTTP v1 de Firebase Cloud Messaging.
 */

const SW_PATH = fileURLToPath(
  new URL("../../public/firebase-messaging-sw.js", import.meta.url)
);

const ORIGIN = "https://panel.appsline.com.mx";

/** Carga el service worker en un contexto simulado. */
const loadWorker = () => {
  const listeners = new Map();
  const notifications = [];
  const uncaught = [];

  const focusedClient = {
    url: `${ORIGIN}/admin/dashboard`,
    focused: true,
    navigated: [],
    focusCount: 0,
    postMessage: (message) => uncaught.push(message),
    navigate: async (url) => {
      focusedClient.navigated.push(url);
      focusedClient.url = url;
    },
    focus: async () => {
      focusedClient.focusCount += 1;
    },
  };

  const opened = [];

  const sandbox = {
    console,
    URL,
    Date,
    Boolean,
    JSON,
    Promise,
    setTimeout,
    clearTimeout,
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: () => {},
    location: { origin: ORIGIN },
    registration: {
      showNotification: async (title, options) => {
        notifications.push({ title, options });
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [focusedClient],
      openWindow: async (url) => {
        opened.push(url);
      },
    },
  };
  // En un service worker `self` es el propio ámbito global.
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(readFileSync(SW_PATH, "utf8"), sandbox, {
    filename: "firebase-messaging-sw.js",
  });

  return { listeners, notifications, uncaught, focusedClient, opened };
};

/** Ejecuta el listener de un evento y espera sus `waitUntil`. */
const dispatch = async (worker, type, event) => {
  const handler = worker.listeners.get(type);
  assert.ok(handler, `el service worker no escucha "${type}"`);
  const pending = [];
  handler({ ...event, waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
};

/** Mensaje con carga útil JSON, como lo entrega el navegador. */
const pushEvent = (payload) => ({
  data: {
    json: () => payload,
    text: () => JSON.stringify(payload),
  },
});

test("registra los listeners del ciclo de vida y del push", () => {
  const worker = loadWorker();
  for (const type of [
    "install",
    "activate",
    "push",
    "notificationclick",
    "pushsubscriptionchange",
  ]) {
    assert.ok(worker.listeners.has(type), `falta el listener "${type}"`);
  }
});

test("muestra la notificación de un mensaje con `notification` y abre data.url", async () => {
  const worker = loadWorker();
  await dispatch(
    worker,
    "push",
    pushEvent({
      notification: { title: "Nueva tarea", body: "Revisar el portal" },
      data: { url: "/admin/projects/7", task_id: "12" },
    })
  );

  assert.equal(worker.notifications.length, 1);
  const [notification] = worker.notifications;
  assert.equal(notification.title, "Nueva tarea");
  assert.equal(notification.options.body, "Revisar el portal");
  assert.equal(notification.options.data.url, "/admin/projects/7");
  assert.equal(notification.options.data.task_id, "12");
  assert.equal(notification.options.icon, "/web-app-manifest-192x192.png");
  assert.equal(notification.options.badge, "/favicon-96x96.png");
});

test("acepta mensajes solo con `data` (sin bloque notification)", async () => {
  const worker = loadWorker();
  await dispatch(
    worker,
    "push",
    pushEvent({ data: { title: "Comentario nuevo", body: "Ana respondió", url: "/admin/tasks" } })
  );

  assert.equal(worker.notifications[0].title, "Comentario nuevo");
  assert.equal(worker.notifications[0].options.body, "Ana respondió");
  assert.equal(worker.notifications[0].options.data.url, "/admin/tasks");
});

test("usa click_action / fcm_options.link como destino y un default razonable", async () => {
  const worker = loadWorker();

  await dispatch(
    worker,
    "push",
    pushEvent({ notification: { title: "A", click_action: "/admin/calendar" } })
  );
  assert.equal(worker.notifications[0].options.data.url, "/admin/calendar");

  await dispatch(
    worker,
    "push",
    pushEvent({ data: { body: "sin url" }, webpush: { fcm_options: { link: "/admin/reports" } } })
  );
  assert.equal(worker.notifications[1].options.data.url, "/admin/reports");

  await dispatch(worker, "push", pushEvent({ data: { body: "vacío" } }));
  assert.equal(worker.notifications[2].options.data.url, "/admin/dashboard");
  assert.equal(worker.notifications[2].title, "Appsline");
});

test("no se rompe con payloads vacíos o de texto plano", async () => {
  const worker = loadWorker();

  await dispatch(worker, "push", { data: null });
  assert.equal(worker.notifications[0].title, "Appsline");
  assert.equal(worker.notifications[0].options.body, "");

  await dispatch(worker, "push", {
    data: {
      json: () => {
        throw new Error("no es JSON");
      },
      text: () => "mensaje de texto",
    },
  });
  assert.equal(worker.notifications[1].options.body, "mensaje de texto");
});

test("avisa a las pestañas abiertas para mostrar el aviso dentro del panel", async () => {
  const worker = loadWorker();
  await dispatch(
    worker,
    "push",
    pushEvent({ notification: { title: "Tarea asignada", body: "Proyecto Acme" }, data: { url: "/admin/tasks/9" } })
  );

  assert.equal(worker.uncaught.length, 1);
  const [message] = worker.uncaught;
  assert.equal(message.source, "appsline-push");
  assert.equal(message.payload.title, "Tarea asignada");
  assert.equal(message.payload.body, "Proyecto Acme");
  assert.equal(message.payload.url, "/admin/tasks/9");
});

test("al hacer clic navega y enfoca la pestaña abierta", async () => {
  const worker = loadWorker();
  await dispatch(worker, "notificationclick", {
    notification: {
      close: () => {},
      data: { url: "/admin/projects/3" },
    },
  });

  assert.deepEqual(worker.focusedClient.navigated, [`${ORIGIN}/admin/projects/3`]);
  assert.equal(worker.focusedClient.focusCount, 1);
  assert.equal(worker.opened.length, 0);
});

test("al renovarse la suscripción avisa al panel para re-registrar el token", async () => {
  const worker = loadWorker();
  await dispatch(worker, "pushsubscriptionchange", {});

  assert.equal(worker.uncaught.length, 1);
  assert.equal(worker.uncaught[0].source, "appsline-push");
  assert.equal(worker.uncaught[0].payload.type, "subscription-change");
});
