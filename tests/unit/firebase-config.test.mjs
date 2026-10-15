import test from "node:test";
import assert from "node:assert/strict";

/**
 * Las variables de entorno del push se documentan en `docs/API-PUSH.md` y en
 * `.env.example`: esta prueba evita que el nombre de una de ellas se desincronice
 * del código (Vite las inyecta tal cual, sin avisar de los errores de escritura).
 */
import {
  MESSAGING_SW_PATH,
  firebaseConfig,
  hasVapidKey,
  isFirebaseConfigured,
  missingFirebaseKeys,
} from "../../src/firebase/config.js";

test("la configuración web lee las variables VITE_FIREBASE_* esperadas", () => {
  assert.deepEqual(Object.keys(firebaseConfig).sort(), [
    "apiKey",
    "appId",
    "authDomain",
    "messagingSenderId",
    "projectId",
    "storageBucket",
  ]);
});

test("sin entorno de Vite faltan las cuatro variables obligatorias", () => {
  assert.deepEqual(missingFirebaseKeys, [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ]);
  assert.equal(isFirebaseConfigured, false);
  assert.equal(hasVapidKey, false);
});

test("el service worker se publica en la raíz del sitio", () => {
  // Un service worker solo controla las rutas bajo su propia URL, por eso el
  // archivo vive en `public/` y no puede moverse a un subdirectorio.
  assert.equal(MESSAGING_SW_PATH, "/firebase-messaging-sw.js");
});
