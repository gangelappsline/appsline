import { test, expect } from "@playwright/test";

/**
 * Diagnóstico de notificaciones push (Configuración → Preferencias).
 *
 * El objetivo de esta pantalla es poder revisar **desde el frontend** por qué
 * no llega una notificación, incluida la prueba con un token que está guardado
 * en la base de datos. Aquí se verifica que:
 *
 *  1. Las comprobaciones del entorno aparecen (navegador, permiso, service
 *     worker servido como JavaScript, variables de Firebase, API…).
 *  2. Al pegar un token y pulsar "Enviar prueba" se llama a
 *     `POST /push/devices/test` con ese token.
 *  3. La **respuesta cruda** del servidor se muestra en pantalla, que es lo que
 *     permite ver errores como `SENDER_ID_MISMATCH` sin abrir la consola.
 *
 * Todo se intercepta: la API de pruebas responde con errores a propósito.
 */

const TOKEN = "fZxTokenDeLaBaseDeDatos1234567890abcdefghij";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, name: "Ana García", email: "ana@example.test" })
    );
  });
});

/** API falsa: el listado de dispositivos no existe y la prueba falla en el servidor. */
const mockFailedApi = async (page) => {
  const calls = { test: [] };

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;

    // El archivo real del service worker se sirve tal cual (el diagnóstico
    // comprueba que se entregue como JavaScript y no como HTML de la SPA).
    if (path.endsWith("firebase-messaging-sw.js")) return route.continue();

    if (path.endsWith("/push/devices/test")) {
      calls.test.push(request.postDataJSON() || {});
      return route.fulfill({
        status: 500,
        json: {
          message:
            "SENDER_ID_MISMATCH: la cuenta de servicio es de otro proyecto de Firebase.",
        },
      });
    }
    if (path.endsWith("/push/devices")) {
      return route.fulfill({ status: 404, json: { message: "Not found" } });
    }
    return route.fulfill({ status: 404, json: { message: "Not found" } });
  });

  return calls;
};

const openPreferences = async (page) => {
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Preferencias", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Diagnóstico de notificaciones" })
  ).toBeVisible();
};

test("el diagnóstico revisa cada paso del push y ofrece pruebas locales", async ({ page }) => {
  await mockFailedApi(page);
  await openPreferences(page);

  // Comprobaciones de entorno.
  await expect(page.getByText("El navegador soporta push web")).toBeVisible();
  await expect(page.getByText("Variables de Firebase (VITE_FIREBASE_*)")).toBeVisible();
  await expect(page.getByText("Service worker de notificaciones registrado")).toBeVisible();
  await expect(page.getByText("Token FCM de este dispositivo")).toBeVisible();

  // El archivo del service worker se sirve como JavaScript en el dev server.
  await expect(page.getByText(/El service worker se sirve como JavaScript/)).toBeVisible();
  await expect(page.getByText(/\/firebase-messaging-sw\.js/).first()).toBeVisible();

  // La API de pruebas no expone los endpoints: se avisa en lugar de romper.
  await expect(page.getByText(/La API no expone GET \/push\/devices/)).toBeVisible();

  // Pruebas que no dependen de Firebase ni de la API.
  await expect(page.getByRole("button", { name: /Notificación local/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Simular push/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar curl/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Consola de Firebase/ })).toBeVisible();
});

test("se puede probar un token de la base de datos y ver la respuesta de la API", async ({ page }) => {
  const calls = await mockFailedApi(page);
  await openPreferences(page);

  await page.getByLabel("Token de FCM a probar").fill(TOKEN);
  await page.getByRole("button", { name: /Enviar prueba/ }).click();

  // El token pegado viaja tal cual a la API.
  await expect.poll(() => calls.test.length).toBe(1);
  expect(calls.test[0]).toEqual({ token: TOKEN });

  // Y el error del servidor queda a la vista, con su código HTTP.
  await expect(page.getByText("HTTP 500")).toBeVisible();
  await expect(page.getByText(/SENDER_ID_MISMATCH/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver cuerpo de la respuesta/ })).toBeVisible();
});

test("las respuestas quedan registradas en el historial del diagnóstico", async ({ page }) => {
  await mockFailedApi(page);
  await openPreferences(page);

  await expect(page.getByText("Aún no has probado ninguna petición.")).toBeVisible();
  await page.getByRole("button", { name: /A todos mis dispositivos/ }).click();

  await expect(page.getByText(/POST \/push\/devices\/test/).first()).toBeVisible();
  await expect(page.getByText("Aún no has probado ninguna petición.")).toHaveCount(0);
});
