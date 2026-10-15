/* eslint-env serviceworker */
/**
 * Service worker de notificaciones push de Appsline (Firebase Cloud Messaging).
 *
 * Vive en `public/` para que Vite lo sirva y lo copie tal cual a la raíz del
 * sitio (`/firebase-messaging-sw.js`): un service worker solo controla las
 * rutas que están por debajo de su propia URL.
 *
 * ¿Por qué no incluye el SDK de Firebase? FCM entrega los mensajes web como
 * Web Push estándar (el payload JSON de la API HTTP v1). Este archivo:
 *   1. muestra la notificación del sistema,
 *   2. avisa a las pestañas abiertas (`postMessage`) para que el panel muestre
 *      el aviso y lo guarde en la bandeja de notificaciones (ver
 *      `src/utils/notificationInbox.js`): así no se pierde cuando el *toast*
 *      desaparece,
 *   3. abre la ruta indicada (por ejemplo `/admin/projects/12`) al hacer clic y
 *      avisa de qué aviso se abrió, para marcarlo como leído.
 * Así el proyecto no depende de ningún CDN y funciona igual en desarrollo.
 *
 * El token FCM del dispositivo se obtiene en la app con `firebase/messaging`
 * (ver `src/firebase/messaging.js`).
 */

const DEFAULT_TITLE = "Appsline";
const DEFAULT_URL = "/admin/dashboard";
const DEFAULT_ICON = "/web-app-manifest-192x192.png";
const DEFAULT_BADGE = "/favicon-96x96.png";

/** Marca que usa el service worker al hablar con las pestañas abiertas. */
const MESSAGE_SOURCE = "appsline-push";

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                      */
/* ------------------------------------------------------------------ */

// Toma el control cuanto antes para no perder notificaciones tras un deploy.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ------------------------------------------------------------------ */
/* Utilidades                                                         */
/* ------------------------------------------------------------------ */

/** Lee el payload del push sin romperse si viene vacío o como texto plano. */
const readPayload = (event) => {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    try {
      return { notification: { body: event.data.text() } };
    } catch {
      return {};
    }
  }
};

/**
 * Ruta a abrir al hacer clic, en orden de prioridad:
 * `data.url` (lo que envía la API) > `click_action` > `fcm_options.link`.
 * Se aceptan rutas relativas (`/admin/projects/12`) o absolutas.
 */
const resolveUrl = (payload, data, notification) =>
  data.url ||
  data.link ||
  data.click_action ||
  notification.click_action ||
  payload.fcm_options?.link ||
  payload.webpush?.fcm_options?.link ||
  DEFAULT_URL;

/** Envía el aviso a todas las pestañas abiertas del sitio. */
const broadcast = async (payload) => {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  windows.forEach((client) => {
    client.postMessage({ source: MESSAGE_SOURCE, payload });
  });
};

/* ------------------------------------------------------------------ */
/* Push                                                               */
/* ------------------------------------------------------------------ */

/**
 * Muestra la notificación de un payload de FCM.
 *
 * Se comparte entre el evento `push` (mensaje real de Firebase) y el mensaje
 * `simulate-push` que envía el panel desde Diagnóstico de notificaciones, para
 * que la prueba recorra exactamente el mismo camino que un push real.
 */
const showPush = async (payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || DEFAULT_TITLE;
  const body = notification.body || data.body || "";
  const url = resolveUrl(payload, data, notification);

  const options = {
    body,
    icon: notification.icon || data.icon || DEFAULT_ICON,
    badge: notification.badge || DEFAULT_BADGE,
    // Un mismo `tag` reemplaza la notificación anterior en lugar de acumular,
    // pero `renotify: true` hace que el navegador vuelva a avisar (sonido/popup)
    // aunque se reemplace: así la notificación se ve aunque la pestaña esté
    // en segundo plano o el usuario no esté mirando la pantalla.
    tag: data.tag || notification.tag || "appsline",
    renotify: data.renotify !== false,
    requireInteraction: Boolean(data.require_interaction),
    silent: false,
    data: { ...data, url, received_at: Date.now() },
  };

  // Siempre se muestra la notificación del sistema (requisito de Chrome para el
  // push y forma de enterarse con la pestaña cerrada o en segundo plano).
  try {
    await self.registration.showNotification(title, options);
  } catch (err) {
    // Si las opciones ricas fallan (algunos navegadores son estrictos), se
    // reintenta con el mínimo indispensable para no perder la notificación.
    try {
      await self.registration.showNotification(title, { body, icon: DEFAULT_ICON });
    } catch {
      // Último recurso: nada más que hacer, pero no se rompe el push.
    }
  }
  // Y se refleja dentro de la app cuando hay alguna pestaña abierta.
  try {
    await broadcast({ title, body, url, ...data });
  } catch {
    // Las pestañas pueden no estar disponibles; la notificación del sistema ya se mostró.
  }
};

self.addEventListener("push", (event) => {
  event.waitUntil(showPush(readPayload(event)));
});

/**
 * Mensaje de las páginas del propio sitio (origen idéntico). Se usa **solo**
 * para el diagnóstico: probar que el service worker muestra la notificación y
 * avisa al panel, sin depender de Firebase.
 */
self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.source !== MESSAGE_SOURCE || message.type !== "simulate-push") return;
  event.waitUntil(showPush(message.payload || {}));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || DEFAULT_URL;
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      // El usuario ya vio el aviso: se avisa a las pestañas abiertas para que
      // lo marquen como leído en la bandeja del panel. Se reenvían los mismos
      // datos (título, cuerpo, tag, received_at) para que el aviso se
      // identifique igual que cuando llegó.
      try {
        await broadcast({
          ...(event.notification.data || {}),
          type: "notification-click",
          title: event.notification.title || DEFAULT_TITLE,
          body: event.notification.body || "",
          url: target,
        });
      } catch {
        // Sin pestañas abiertas no hay nada que marcar.
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reutiliza una pestaña del panel si ya está abierta.
      const existing =
        windows.find((client) => client.url === url) ||
        windows.find((client) => client.url.startsWith(self.location.origin));

      if (existing) {
        if ("navigate" in existing) {
          await existing.navigate(url).catch(() => null);
        }
        if ("focus" in existing) await existing.focus();
        return;
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});

/**
 * Chrome/Firefox pueden renovar la suscripción de push. No se puede recrear
 * aquí (la VAPID key vive en la app), así que se avisa al panel para que
 * vuelva a registrar el dispositivo y actualice el token en la API.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(broadcast({ type: "subscription-change" }));
});
