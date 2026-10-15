import { test, expect } from "@playwright/test";

/**
 * Cobertura de las notificaciones push web (Firebase Cloud Messaging).
 *
 * No se puede enviar un push real desde las pruebas (depende de credenciales de
 * Firebase y del servicio de push del sistema), así que aquí se verifica lo que
 * sí es determinista:
 *   1. El service worker se publica en la raíz del sitio con el contenido que
 *      espera FCM y se puede registrar/activar en el navegador.
 *   2. Configuración > Preferencias muestra el control de notificaciones sin
 *      depender de si el entorno trae o no las variables `VITE_FIREBASE_*`.
 *
 * Todo se intercepta: no se usan cuentas ni datos reales.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, name: "Ana García", email: "ana@example.test" })
    );
  });

  // El backend de pruebas no expone los endpoints de push: el panel debe
  // seguir funcionando y avisar del estado en Configuración.
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) {
      return route.continue();
    }
    return route.fulfill({ status: 404, json: { message: "Not found" } });
  });
});

test("el service worker de FCM se publica en la raíz del sitio", async ({ request }) => {
  const response = await request.get("/firebase-messaging-sw.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("javascript");

  const body = await response.text();
  expect(body).toContain("showNotification"); // muestra la notificación
  expect(body).toContain("appsline-push"); // avisa a las pestañas
  expect(body).toContain("notificationclick"); // abre la ruta al hacer clic
  expect(body).toContain("pushsubscriptionchange"); // renovación de la suscripción
});

test("el service worker se registra y queda activo", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false };

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    // Se espera la activación (el worker hace skipWaiting() al instalarse).
    const deadline = Date.now() + 5000;
    while (!registration.active && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const active = Boolean(registration.active);
    const scriptURL = registration.active?.scriptURL || "";
    await registration.unregister();

    return { supported: true, active, scriptURL };
  });

  test.skip(!result.supported, "El navegador de pruebas no expone service workers");
  expect(result.active, "el service worker no llegó a activarse").toBe(true);
  expect(result.scriptURL).toContain("/firebase-messaging-sw.js");
});

test("Configuración > Preferencias ofrece activar las notificaciones push", async ({ page }) => {
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Preferencias", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Notificaciones push" })).toBeVisible();
  // El botón se muestra siempre; queda deshabilitado cuando falta configurar
  // Firebase o el navegador no soporta push (en ese caso la tarjeta explica qué hacer).
  await expect(page.getByRole("button", { name: "Activar notificaciones" })).toBeVisible();
  await expect(page.getByText("Este dispositivo", { exact: true })).toBeVisible();
});
