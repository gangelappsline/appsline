/**
 * Configuración de Firebase (Web) para las notificaciones push.
 *
 * Los valores se inyectan en tiempo de compilación desde variables de entorno
 * de Vite (`VITE_FIREBASE_*`). **No son secretos**: la configuración web de
 * Firebase es pública por diseño y viaja en el bundle del navegador. Lo que
 * NUNCA debe llegar al frontend es el JSON de la cuenta de servicio
 * (service account) que usa el backend para *enviar* los mensajes.
 *
 * Guía completa paso a paso: `docs/API-PUSH.md`.
 */
const env = import.meta.env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || "",
};

/**
 * Clave VAPID (Firebase Console > Cloud Messaging > Web Push certificates).
 * Sin ella `getToken()` falla con `messaging/token-subscribe-failed`.
 */
export const vapidKey = env.VITE_FIREBASE_VAPID_KEY || "";

/** Ruta del service worker que recibe los push. Debe estar en la raíz del sitio. */
export const MESSAGING_SW_PATH = "/firebase-messaging-sw.js";

/** Campos mínimos para inicializar Firebase Messaging en el navegador. */
const REQUIRED_KEYS = ["apiKey", "projectId", "messagingSenderId", "appId"];

/** Variables `VITE_FIREBASE_*` que faltan por definir. */
export const missingFirebaseKeys = REQUIRED_KEYS.filter(
  (key) => !firebaseConfig[key]
).map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

/** ¿Está Firebase configurado para poder pedir tokens de push? */
export const isFirebaseConfigured = missingFirebaseKeys.length === 0;

/** ¿Hay clave VAPID? Es obligatoria para registrar el navegador en FCM. */
export const hasVapidKey = Boolean(vapidKey);

export default firebaseConfig;
