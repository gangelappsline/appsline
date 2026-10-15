import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Pruebas de las ayudas de diagnóstico del push (`src/firebase/messaging.js`).
 *
 * Son las que permiten comparar el token de la base de datos con la
 * configuración de Firebase del frontend —el fallo clásico
 * `SENDER_ID_MISMATCH`— y las que alimentan el panel de diagnóstico.
 */
import {
  decodeFcmToken,
  maskToken,
  messagingServiceWorkerStatus,
} from "../../src/firebase/messaging.js";

/** Base64url de un JSON, como el que llevan dentro los tokens de FCM. */
const fakeToken = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

test("maskToken recorta el token sin exponerlo completo", () => {
  assert.equal(maskToken("abcdefghijklmnopqrst"), "abcdef…opqrst");
  assert.equal(maskToken("corto"), "corto");
  assert.equal(maskToken(""), "");
  assert.equal(maskToken("1234567890123", 3), "123…123");
});

test("decodeFcmToken lee el proyecto que va dentro del token", () => {
  const token = fakeToken({
    projectId: "appsline-demo",
    appId: "1:1234567890:web:abc123",
    fid: "fid-de-ejemplo",
  });

  const decoded = decodeFcmToken(token);
  assert.equal(decoded.projectId, "appsline-demo");
  assert.equal(decoded.appId, "1:1234567890:web:abc123");
  assert.equal(decoded.fid, "fid-de-ejemplo");
});

test("decodeFcmToken no revienta con tokens opacos (lo normal)", () => {
  assert.equal(decodeFcmToken(""), null);
  assert.equal(decodeFcmToken("no-es-un-token"), null);
  assert.equal(decodeFcmToken(Buffer.from("texto suelto").toString("base64url")), null);
});

test("sin service workers el estado se reporta como no soportado", async () => {
  const status = await messagingServiceWorkerStatus();
  assert.equal(status.supported, false);
  assert.deepEqual(status.registrations, []);
  assert.equal(status.ours, null);
});

test("el service worker acepta el push simulado del panel", () => {
  const sw = readFileSync(
    fileURLToPath(new URL("../../public/firebase-messaging-sw.js", import.meta.url)),
    "utf8"
  );
  // El panel manda `{ source: "appsline-push", type: "simulate-push" }`; el
  // service worker debe atenderlo y mostrar la notificación igual que un push real.
  assert.match(sw, /addEventListener\("message"/);
  assert.match(sw, /simulate-push/);
  assert.match(sw, /const showPush = async \(payload\)/);
  assert.match(sw, /addEventListener\("push", \(event\) => \{\s*event\.waitUntil\(showPush/);
});
