import { test, expect } from "@playwright/test";

/**
 * Cobertura del dashboard rediseñado: KPIs, pestañas navegables, gráficas
 * nuevas y exportaciones. Todos los endpoints se interceptan: no se usan
 * cuentas ni datos reales.
 */

const projects = [
  {
    id: 1, name: "Portal de clientes", description: "Espacio de colaboración.",
    status: "active", client_name: "Acme", budget: 45000, end_date: "2026-11-20",
  },
  {
    id: 2, name: "Tienda móvil", description: "Tienda para retail.",
    status: "in_progress", client_name: "Comercial Sur", budget: 120000, end_date: "2026-12-10",
  },
];

const users = [
  { id: 1, name: "Ana García", email: "ana@example.test", role: "dev" },
  { id: 2, name: "Luis Hernández", email: "luis@example.test", role: "dev" },
];

const tasks = [
  {
    id: 11, title: "Diseñar navegación", description: "Estructura del portal.",
    status: "completed", priority: "high", assigned_to: users[0],
    due_date: "2026-10-20", created_at: "2026-10-01T10:00:00Z",
    completed_at: "2026-10-18T10:00:00Z",
  },
  {
    id: 12, title: "Integrar API", description: "Conectar los datos.",
    status: "in_progress", priority: "medium", assigned_to: users[1],
    due_date: "2026-10-05", created_at: "2026-10-02T10:00:00Z",
  },
  {
    id: 13, title: "Revisar alcance", description: "Validar entregables.",
    status: "pending", priority: "low", assigned_to: users[0],
    due_date: "2026-09-01", created_at: "2026-08-20T10:00:00Z",
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Ana García" }));
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;

    // Los endpoints de analítica todavía no existen en el backend:
    // el panel debe calcular todo en el cliente sin romperse.
    if (path.includes("/analytics/")) {
      return route.fulfill({ status: 404, json: { message: "Not found" } });
    }

    let data = [];
    if (path.endsWith("/dashboard")) {
      data = {
        tasks_by_status: { pending: 1, in_progress: 1, completed: 1 },
        tasks_per_user: [
          { id: 1, name: "Ana García", total: 2, on_time: 1, late: 0 },
          { id: 2, name: "Luis Hernández", total: 1, on_time: 0, late: 1 },
        ],
        overall: { on_time_rate: 0.5 },
      };
    } else if (path.endsWith("/projects")) {
      data = projects;
    } else if (/\/projects\/\d+\/tasks$/.test(path)) {
      data = tasks;
    } else if (/\/projects\/\d+$/.test(path)) {
      data = projects[0];
    } else if (path.endsWith("/clients")) {
      data = [{ id: 1, name: "Acme", client_name: "Acme" }];
    } else if (path.endsWith("/users")) {
      data = users;
    }
    await route.fulfill({ json: { data } });
  });
});

test("el dashboard muestra KPIs, gráficas y pestañas navegables", async ({ page }) => {
  await page.goto("/admin/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Proyectos en curso", { exact: true })).toBeVisible();
  await expect(page.getByText("Tareas completadas", { exact: true })).toBeVisible();
  await expect(page.getByText("Entrega a tiempo", { exact: true })).toBeVisible();
  await expect(page.getByText("Valor del portafolio", { exact: true })).toBeVisible();

  // Gráficas de la vista resumen.
  await expect(page.getByText("Evolución mensual", { exact: true })).toBeVisible();
  await expect(page.getByText("Salud del portafolio", { exact: true })).toBeVisible();
  await expect(page.getByText("Velocidad semanal", { exact: true })).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();

  // Pestañas con URL compartible (?tab=...).
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await expect(page).toHaveURL(/tab=proyectos/);
  await expect(page.getByText("Métricas por proyecto", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Equipo", exact: true }).click();
  await expect(page).toHaveURL(/tab=equipo/);
  await expect(page.getByText("Productividad por persona", { exact: true })).toBeVisible();

  // La vista se conserva al recargar.
  await page.reload();
  await expect(page.getByText("Productividad por persona", { exact: true })).toBeVisible();
});

test("la analítica muestra las gráficas avanzadas y sus pestañas", async ({ page }) => {
  await page.goto("/admin/analytics");

  await expect(page.getByRole("heading", { name: "Analítica", exact: true })).toBeVisible();
  await expect(page.getByText("Explorador de series", { exact: true })).toBeVisible();
  await expect(page.getByText("Presupuesto vs. avance", { exact: true })).toBeVisible();
  await expect(page.getByText("Salud multidimensional", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(page.getByText("Concentración de cartera", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Avanzado", exact: true }).click();
  await expect(page.getByText("Mapa de actividad", { exact: true })).toBeVisible();
  await expect(page.getByText("Alertas de riesgo", { exact: true })).toBeVisible();
});

test("los reportes permiten cambiar de sección y exportar el JSON", async ({ page }) => {
  await page.goto("/admin/reports");

  await expect(page.getByRole("heading", { name: "Reportes", exact: true })).toBeVisible();
  await expect(page.getByText("Resumen ejecutivo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await expect(page.getByText("Detalle de proyectos", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Financiero", exact: true }).click();
  await expect(page.getByText("Resumen financiero", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/reporte-appsline-.*\.json/);
});
