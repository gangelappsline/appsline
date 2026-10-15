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
 *   3. El centro de notificaciones del encabezado: cada push queda guardado en
 *      `localStorage`, la campana lo lista y, al abrirla, la alerta de la
 *      pestaña desaparece (antes el aviso se perdía con el *toast*).
 *
 * Todo se intercepta: no se usan cuentas ni datos reales.
 */

/**
 * Simula un push recibido con la pestaña abierta.
 *
 * El service worker reenvía cada push a las pestañas con `postMessage`; aquí se
 * lanza el mismo evento que emite ese puente (`src/firebase/messaging.js`), sin
 * depender de Firebase. Se reintenta hasta que el panel lo guarda en la bandeja
 * (`appsline.notifications.*`), porque el proveedor tarda un instante en montar.
 */
const seedPush = async (page, detail) => {
  await page.evaluate((payload) => {
    let attempts = 0;
    const send = () => {
      attempts += 1;
      window.dispatchEvent(new CustomEvent("appsline:push-message", { detail: payload }));
      let stored = false;
      for (let i = 0; i < localStorage.length; i += 1) {
        if (localStorage.key(i)?.startsWith("appsline.notifications.")) {
          stored = true;
        }
      }
      if (!stored && attempts < 60) setTimeout(send, 100);
    };
    send();
  }, detail);
};

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

/**
 * Centro de notificaciones del encabezado: antes el aviso solo aparecía unos
 * segundos como *toast* y se perdía. Ahora queda guardado en `localStorage`, la
 * campana lo lista al pulsarla y, al abrirla, la alerta de la pestaña
 * (`(1) Appsline · …`) desaparece.
 */
test("la campana lista y conserva las notificaciones, y apaga la alerta de la pestaña", async ({
  page,
}) => {
  await page.goto("/admin/dashboard");
  await seedPush(page, {
    title: "Nueva tarea asignada",
    body: "Revisar el sitio de Acme",
    url: "/admin/tasks",
  });

  // Aviso pendiente: insignia con el contador y título de la pestaña marcado.
  const bell = page.getByRole("button", { name: /^Notificaciones/ });
  await expect(bell).toBeVisible();
  await expect(bell).toHaveAccessibleName("Notificaciones (1 sin leer)");
  await expect(page).toHaveTitle(/^\(1\)/);

  // Un clic abre la lista con el contenido completo y marca todo como leído.
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Nueva tarea asignada")).toBeVisible();
  await expect(panel.getByText("Revisar el sitio de Acme")).toBeVisible();
  // Lo que estaba sin leer se resalta como nuevo durante esta visita.
  await expect(panel.getByText("Nueva", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/^Appsline/);

  // Sigue ahí después de recargar: la información no se pierde con el toast.
  await page.reload();
  await page.getByRole("button", { name: /^Notificaciones/ }).click();
  const reopened = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(reopened.getByText("Nueva tarea asignada")).toBeVisible();
  await expect(reopened.getByText("Leída")).toBeVisible();

  // Y al pulsar el aviso lleva a su destino y cierra el panel.
  await reopened.getByText("Nueva tarea asignada").click();
  await expect(page).toHaveURL(/\/admin\/tasks/);
  await expect(page.getByRole("dialog", { name: "Notificaciones" })).toBeHidden();
});

test("la lista de notificaciones se puede vaciar", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await seedPush(page, { title: "Comentario nuevo", body: "Ana comentó en Acme" });

  await page.getByRole("button", { name: /^Notificaciones/ }).click();
  const panel = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(panel.getByText("Comentario nuevo")).toBeVisible();

  // Vaciar pide confirmación en el mismo botón para no borrar por accidente.
  await panel.getByRole("button", { name: "Vaciar" }).click();
  await expect(panel.getByText("Comentario nuevo")).toBeVisible();
  await panel.getByRole("button", { name: "¿Vaciar?" }).click();

  // La bandeja queda vacía. La campana se oculta cuando no hay nada que listar y
  // el push no se puede activar en este entorno (sin Firebase configurado); con
  // las push activas se vería la lista con el estado "Sin notificaciones".
  await expect
    .poll(() =>
      page.evaluate(() => {
        let total = 0;
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key?.startsWith("appsline.notifications.")) continue;
          try {
            total += JSON.parse(localStorage.getItem(key) || "[]").length;
          } catch {
            /* clave ajena */
          }
        }
        return total;
      })
    )
    .toBe(0);
  await expect(panel.getByText("Comentario nuevo")).toBeHidden();
});
