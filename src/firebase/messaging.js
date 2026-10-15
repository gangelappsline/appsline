/**
 * Capa de Firebase Cloud Messaging (Web) para el navegador.
 *
 * Responsabilidades:
 *  1. Detectar si el navegador puede recibir push (HTTPS + Notification + SW + PushManager).
 *  2. Pedir el permiso al usuario y registrar el service worker
 *     (`public/firebase-messaging-sw.js`).
 *  3. Obtener / revocar el token FCM del dispositivo (`getToken`, `deleteToken`).
 *  4. Reenviar a la app los mensajes que llegan con la pestaña abierta
 *     (el service worker hace `postMessage` y aquí se emite un evento de window).
 *
 * El SDK de Firebase se carga bajo demanda (`import()` dinámico) para no
 * engordar el bundle de la parte pública del sitio: solo se descarga cuando
 * un usuario logueado activa o usa las notificaciones.
 */
import {
  MESSAGING_SW_PATH,
  firebaseConfig,
  hasVapidKey,
  isFirebaseConfigured,
  missingFirebaseKeys,
  vapidKey,
} from "./config.js";

/** Evento de `window` con el detalle de cada push recibido en primer plano. */
export const PUSH_MESSAGE_EVENT = "appsline:push-message";

/** Identificador que usa el service worker al escribir a las pestañas. */
export const SW_MESSAGE_SOURCE = "appsline-push";

/** Mensajes en español para cada código de error del push. */
export const PUSH_ERROR_MESSAGES = {
  unsupported: "Este navegador no soporta notificaciones push.",
  "insecure-context":
    "Las notificaciones push requieren HTTPS (o localhost durante el desarrollo).",
  "not-configured":
    "Falta configurar Firebase en el proyecto (variables VITE_FIREBASE_*).",
  "missing-vapid-key":
    "Falta la clave VAPID (VITE_FIREBASE_VAPID_KEY) para registrar el navegador.",
  "permission-denied":
    "El navegador bloqueó las notificaciones. Habilítalas en la configuración del sitio.",
  "permission-dismissed": "No se otorgó el permiso de notificaciones.",
  "sw-failed": "No se pudo registrar el service worker de notificaciones.",
  "token-failed": "No se pudo obtener el token de notificaciones del dispositivo.",
};

/** Error tipado del push: `err.code` sirve para reaccionar en la interfaz. */
export class PushError extends Error {
  constructor(code, message, cause) {
    super(message || PUSH_ERROR_MESSAGES[code] || "Error de notificaciones push.");
    this.name = "PushError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/* ------------------------------------------------------------------ */
/* Detección del entorno                                              */
/* ------------------------------------------------------------------ */

/** Permiso actual del navegador: "granted" | "denied" | "default" | "unsupported". */
export const getPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
};

/** ¿El navegador soporta el stack completo de Web Push? */
export const isPushSupported = () => {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  return true;
};

/**
 * Motivo por el que las notificaciones no se pueden activar, o `null` si todo
 * está listo. La interfaz usa este código para explicar qué hacer.
 */
export const getPushBlocker = () => {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure-context";
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (!isFirebaseConfigured) return "not-configured";
  if (!hasVapidKey) return "missing-vapid-key";
  if (Notification.permission === "denied") return "permission-denied";
  return null;
};

/** Variables de entorno que faltan (para mostrarlas en Configuración). */
export const missingFirebaseEnv = () => missingFirebaseKeys;

/* ------------------------------------------------------------------ */
/* SDK de Firebase (import dinámico + memoización)                    */
/* ------------------------------------------------------------------ */

let messagingPromise = null;
let tokenPromise = null;

/** Permite volver a intentar después de un error (permiso, red, etc.). */
const resetCaches = () => {
  messagingPromise = null;
  tokenPromise = null;
};

/** Inicializa la app de Firebase (una sola vez) y devuelve `Messaging`. */
const getMessagingInstance = async () => {
  if (!isFirebaseConfigured) throw new PushError("not-configured");
  if (!isPushSupported()) throw new PushError("unsupported");

  if (!messagingPromise) {
    messagingPromise = (async () => {
      const [appModule, messagingModule] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
      ]);
      const { initializeApp, getApp, getApps } = appModule;
      const { getMessaging } = messagingModule;

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return getMessaging(app);
    })().catch((err) => {
      messagingPromise = null;
      throw err;
    });
  }

  return messagingPromise;
};

/** Nombre del archivo del service worker (debe coincidir con `public/`). */
const SW_SCRIPT_NAME = "firebase-messaging-sw.js";

/**
 * Scope alternativo cuando la raíz ya está ocupada por otro service worker
 * (por ejemplo una PWA): solo puede existir **un** service worker por scope.
 * Es el mismo scope que usa el SDK de Firebase por defecto.
 */
const FALLBACK_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

/** ¿La registración corresponde a nuestro service worker? */
const isOurRegistration = (registration) =>
  Boolean(registration) &&
  [registration.active, registration.installing, registration.waiting].some(
    (worker) => (worker?.scriptURL || "").includes(SW_SCRIPT_NAME)
  );

/** Espera a que la registración tenga un service worker activo (máx. 10 s). */
const waitForActive = (registration) =>
  new Promise((resolve) => {
    if (registration.active) return resolve(registration);
    const worker = registration.installing || registration.waiting;
    if (!worker) return resolve(registration);
    const timeout = setTimeout(() => resolve(registration), 10000);
    worker.addEventListener("statechange", () => {
      if (registration.active) {
        clearTimeout(timeout);
        resolve(registration);
      }
    });
  });

/** Registra (o recupera) el service worker que recibe los push. */
export const registerMessagingServiceWorker = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new PushError("unsupported");
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration(
      MESSAGING_SW_PATH
    );
    if (isOurRegistration(existing)) return existing;

    // Si otro service worker controla la raíz, se registra el nuestro en el
    // scope reservado para no pisarlo.
    const rootRegistration = await navigator.serviceWorker.getRegistration("/");
    const scope =
      rootRegistration && !isOurRegistration(rootRegistration)
        ? FALLBACK_SW_SCOPE
        : "/";

    const registration = await navigator.serviceWorker.register(
      MESSAGING_SW_PATH,
      { scope }
    );
    return waitForActive(registration);
  } catch (err) {
    throw new PushError("sw-failed", null, err);
  }
};

/** Pide el permiso de notificaciones (debe dispararse desde un clic del usuario). */
export const requestPushPermission = async () => {
  if (!("Notification" in window)) throw new PushError("unsupported");
  try {
    return await Notification.requestPermission();
  } catch (err) {
    throw new PushError("permission-dismissed", null, err);
  }
};

/**
 * Devuelve el token FCM del dispositivo.
 *
 * @param {{ requestPermission?: boolean }} options
 *   `requestPermission: true` muestra el diálogo del navegador (úsalo solo
 *   desde un clic). En `false` (sincronización silenciosa al iniciar sesión)
 *   devuelve `""` si el permiso todavía no fue concedido.
 */
export const fetchPushToken = async ({ requestPermission = false } = {}) => {
  if (!isFirebaseConfigured) throw new PushError("not-configured");
  if (!hasVapidKey) throw new PushError("missing-vapid-key");
  if (!isPushSupported()) throw new PushError("unsupported");

  let permission = getPermission();
  if (permission === "denied") throw new PushError("permission-denied");
  if (permission === "default") {
    if (!requestPermission) return "";
    permission = await requestPushPermission();
  }
  if (permission !== "granted") throw new PushError("permission-dismissed");

  if (!tokenPromise) {
    tokenPromise = (async () => {
      const [registration, messaging] = await Promise.all([
        registerMessagingServiceWorker(),
        getMessagingInstance(),
      ]);
      const { getToken } = await import("firebase/messaging");
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      // En desarrollo se imprime el token completo: sirve para enviar un mensaje
      // de prueba desde la consola de Firebase (Cloud Messaging → Enviar mensaje
      // de prueba). En producción no se registra nada.
      if (import.meta.env?.DEV) {
        console.debug("[push] token FCM de este dispositivo:", token);
      }
      return token;
    })().catch((err) => {
      tokenPromise = null;
      throw normalizeFirebaseError(err);
    });
  }

  try {
    return await tokenPromise;
  } catch (err) {
    throw err instanceof PushError ? err : normalizeFirebaseError(err);
  }
};

/** Revoca el token FCM de este dispositivo (al desactivar las notificaciones). */
export const deletePushToken = async () => {
  const messaging = await getMessagingInstance();
  const { deleteToken } = await import("firebase/messaging");
  try {
    await deleteToken(messaging);
  } catch {
    // Si ya no existía (o el permiso se revocó), no es un error real.
  } finally {
    resetCaches();
  }
};

/** Traduce los errores del SDK a códigos propios con mensaje en español. */
const normalizeFirebaseError = (err) => {
  if (err instanceof PushError) return err;
  const code = err?.code || "";
  if (code.includes("permission-blocked")) return new PushError("permission-denied", null, err);
  if (code.includes("permission")) return new PushError("permission-dismissed", null, err);
  if (code.includes("token-subscribe")) {
    return new PushError("token-failed", null, err);
  }
  if (code.includes("service-worker")) return new PushError("sw-failed", null, err);
  if (code.includes("unsupported")) return new PushError("unsupported", null, err);
  return new PushError("token-failed", err?.message || undefined, err);
};

/* ------------------------------------------------------------------ */
/* Mensajes con la pestaña abierta                                    */
/* ------------------------------------------------------------------ */

let bridgeInstalled = false;

/**
 * El service worker hace `postMessage` por cada push recibido; aquí se
 * reemite como evento de `window` para que cualquier componente escuche.
 */
const installServiceWorkerBridge = () => {
  if (bridgeInstalled) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  bridgeInstalled = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== SW_MESSAGE_SOURCE) return;
    window.dispatchEvent(
      new CustomEvent(PUSH_MESSAGE_EVENT, { detail: data.payload || {} })
    );
  });
};

/**
 * Escucha los push recibidos con el sitio abierto.
 * @param {(payload: object) => void} handler
 * @returns {() => void} función para dejar de escuchar
 */
export const subscribeToPushMessages = (handler) => {
  installServiceWorkerBridge();
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(PUSH_MESSAGE_EVENT, listener);
  return () => window.removeEventListener(PUSH_MESSAGE_EVENT, listener);
};

/* ------------------------------------------------------------------ */
/* Diagnóstico (Configuración > Preferencias > Diagnóstico de push)    */
/* ------------------------------------------------------------------ */

/**
 * Estado del service worker de este sitio: si está registrado, en qué scope,
 * con qué archivo y si hay alguno activo. Es la primera pieza que falla cuando
 * las notificaciones "no llegan", así que el panel la muestra tal cual.
 */
export const messagingServiceWorkerStatus = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { supported: false, registrations: [], ours: null };
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  const list = registrations.map((registration) => ({
    scope: registration.scope,
    scriptURL:
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      "",
    active: Boolean(registration.active),
    installing: Boolean(registration.installing),
    waiting: Boolean(registration.waiting),
  }));
  const ours = list.find((item) => item.scriptURL.includes(SW_SCRIPT_NAME)) || null;
  return { supported: true, registrations: list, ours };
};

/**
 * Comprueba que `/firebase-messaging-sw.js` se sirva de verdad como archivo
 * JavaScript. Es el fallo típico en producción: el hosting devuelve el
 * `index.html` de la SPA (con `text/html`) y el navegador nunca registra el
 * service worker de FCM.
 */
export const inspectMessagingServiceWorkerFile = async () => {
  try {
    const response = await fetch(`${MESSAGING_SW_PATH}?diag=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "text/javascript,*/*" },
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "";
    return {
      ok: response.ok,
      status: response.status,
      contentType,
      isJavaScript: /javascript|ecmascript/i.test(contentType),
      includesServiceWorker: body.includes("showNotification"),
      bytes: body.length,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      isJavaScript: false,
      includesServiceWorker: false,
      bytes: 0,
      error: err?.message || "No se pudo descargar el service worker.",
    };
  }
};

/**
 * Simula un push **sin** Firebase: le manda el payload al service worker, que
 * lo trata igual que uno real (notificación del sistema + aviso dentro del
 * panel). Sirve para separar "el navegador no muestra notificaciones" de
 * "la API no está enviando nada".
 */
export const simulatePushThroughServiceWorker = async (payload = {}) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new PushError("unsupported");
  }
  const registration =
    (await navigator.serviceWorker.getRegistration(MESSAGING_SW_PATH)) ||
    (await navigator.serviceWorker.getRegistration("/"));
  const worker =
    registration?.active || registration?.waiting || registration?.installing;
  if (!worker) throw new PushError("sw-failed");
  worker.postMessage({
    source: SW_MESSAGE_SOURCE,
    type: "simulate-push",
    payload: {
      notification: {
        title: payload.title || "Prueba de Appsline",
        body:
          payload.body ||
          "Si ves esta notificación, el navegador y el service worker funcionan.",
      },
      data: { url: payload.url || "/admin/settings", ...(payload.data || {}) },
    },
  });
  return true;
};

/**
 * Intenta leer la información que el navegador incrusta en el token de FCM
 * (base64url con un JSON dentro: `projectId`, `appId`, `fid`…).
 *
 * No siempre es posible (el formato depende del navegador), así que devuelve
 * `null` cuando no se puede decodificar: el panel lo muestra como "no
 * disponible" y compara lo que sí alcanza a leer.
 */
export const decodeFcmToken = (token = "") => {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  if (typeof atob !== "function") return null;
  try {
    const json = JSON.parse(atob(padded));
    if (!json || typeof json !== "object") return null;
    return {
      projectId: json.projectId || json.project_id || null,
      appId: json.appId || json.applicationId || null,
      senderId: json.senderId || json.sender_id || null,
      fid: json.fid || json.installationId || null,
      raw: json,
    };
  } catch {
    return null;
  }
};

/** Token recortado para pintarlo sin exponerlo completo (`fZx…9Kd`). */
export const maskToken = (token = "", visible = 6) => {
  const raw = String(token || "");
  if (raw.length <= visible * 2 + 1) return raw;
  return `${raw.slice(0, visible)}…${raw.slice(-visible)}`;
};

/**
 * Muestra una notificación local (sin pasar por FCM).
 * Se usa como confirmación al activar y como respaldo del "enviar prueba"
 * cuando la API todavía no expone el endpoint correspondiente.
 */
export const showLocalNotification = async ({ title, body = "", url = "/admin/dashboard", icon }) => {
  const registration = await registerMessagingServiceWorker();
  if (getPermission() !== "granted") return false;
  await registration.showNotification(title, {
    body,
    icon: icon || "/web-app-manifest-192x192.png",
    badge: "/favicon-96x96.png",
    data: { url },
  });
  return true;
};

/* ------------------------------------------------------------------ */
/* Re-export de ayudas de aviso (sonido + indicador de pestaña)        */
/* ------------------------------------------------------------------ */
export {
  playNotificationSound,
  playNotificationBeep,
  playSound,
  playBeep,
  beepWithWebAudio,
  setTabIndicator,
  setTabBadge,
  setAppBadge,
  setNotificationBadge,
  updateTabIndicator,
  clearTabIndicator,
  clearTabBadge,
  clearAppBadge,
  clearNotificationBadge,
  formatTabTitle,
  drawFaviconBadge,
} from "../utils/notificationAlert.js";
