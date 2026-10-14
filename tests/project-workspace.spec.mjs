import { test, expect } from "@playwright/test";

const project = {
  id: 1, name: "Portal de clientes", description: "Un espacio para colaborar con nuestros clientes.",
  status: "active", client_name: "Cliente de prueba", budget: 45000, end_date: "2026-11-20",
};
const user = { id: 1, name: "Ana García", email: "ana@example.test" };
const initialTasks = [
  { id: 11, title: "Diseñar navegación", description: "Definir la estructura de navegación del portal.", status: "pending", priority: "high", assigned_to: user, due_date: "2026-11-01", subtasks: [{ id: 1, title: "Revisar propuesta", completed: true }], tags: ["Diseño"] },
  { id: 12, title: "Integrar API", description: "Conectar los datos del proyecto.", status: "in_progress", priority: "medium" },
  { id: 13, title: "Revisar alcance", description: "Validar los entregables.", status: "completed", priority: "low" },
];

// Todas las peticiones de datos se interceptan: no se usan cuentas ni datos reales.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Ana García" }));
  });
  let tasks = structuredClone(initialTasks);
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    let data = [];
    if (path.endsWith("/projects")) data = [project];
    else if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/users")) data = [user];
    else if (path.endsWith("/projects/1/tasks")) data = tasks;
    else if (/\/projects\/1\/tasks\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      if (request.method() === "PUT") tasks = tasks.map((task) => task.id === id ? { ...task, ...request.postDataJSON() } : task);
      data = tasks.find((task) => task.id === id);
    }
    await route.fulfill({ json: { data } });
  });
});

test("portafolio compacto, resumen accesible y preferencias persistentes", async ({ page }) => {
  await page.goto("/admin/projects");
  await expect(page.getByRole("button", { name: project.name, exact: true })).toBeVisible();
  const summary = page.getByRole("button", { name: /Resumen del portafolio/ });
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Presupuesto total", { exact: true })).toBeVisible();
  await expect(page.getByText(project.description, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ampliar tarjetas" }).click();
  await expect(page.getByText(project.description, { exact: true })).toBeVisible();
  await page.reload();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Compactar tarjetas" })).toBeVisible();
  await page.getByRole("tab", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
});

test("resumen, enfoque reversible y tarjetas plegables sin abrir el detalle", async ({ page }) => {
  await page.goto("/admin/projects/1");
  const task = page.getByRole("article").filter({ hasText: "Diseñar navegación" });
  const info = page.getByRole("button", { name: /Información del proyecto/ });
  await expect(task).toBeVisible();
  await expect(task.getByText(initialTasks[0].description)).toBeHidden();
  const top = (await task.boundingBox()).y;
  expect(top).toBeLessThan(450);
  await info.click();
  await expect(page.getByText(project.description)).toBeVisible();
  await page.getByRole("button", { name: "Modo enfoque" }).click();
  await expect(page.locator("aside")).toBeHidden();
  await expect(info).toHaveCount(0);
  await page.getByRole("button", { name: "Salir del enfoque" }).click();
  await expect(page.locator("aside")).toBeVisible();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await task.getByRole("button", { name: /Mostrar detalles/ }).click();
  await expect(task.getByText(initialTasks[0].description)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Ampliar tarjetas" }).click();
  await expect(page.getByRole("article").getByText(initialTasks[1].description)).toBeVisible();
  await page.getByRole("button", { name: "Compactar tarjetas" }).click();
  await expect(task.getByText(initialTasks[0].description)).toBeHidden();
  await task.getByRole("button", { name: "Diseñar navegación", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Título de la tarea", { exact: true })).toBeVisible();
});

test("los filtros ocultos siguen visibles como activos y se pueden limpiar", async ({ page }) => {
  await page.goto("/admin/projects/1");
  const filters = page.getByRole("button", { name: /^Filtros/ });
  await filters.click();
  await page.getByLabel("Filtrar por prioridad").selectOption("high");
  await expect(page.getByText("1 de 3 tareas", { exact: true })).toBeVisible();
  await filters.click();
  await expect(page.getByLabel("Filtrar por prioridad")).toBeHidden();
  await expect(filters).toContainText("1");
  await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
  await expect(page.getByText("3 de 3 tareas", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Buscar por título o descripción...").fill("ninguna coincidencia");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
  await page.getByRole("tab", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("tab", { name: /Calendario/ }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await page.getByRole("tab", { name: /Archivos/ }).click();
  await expect(filters).toBeHidden();
  await page.getByRole("tab", { name: "Tablero", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("arrastrar tareas y crear una tarea siguen disponibles en modo compacto", async ({ page }) => {
  await page.goto("/admin/projects/1");
  const task = page.getByRole("article").filter({ hasText: "Diseñar navegación" });
  const column = page.locator("section").filter({ has: page.getByRole("heading", { name: "En progreso", exact: true }) }).last();
  await task.dragTo(column);
  await expect(column.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Nueva tarea", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Nueva tarea", exact: true })).toBeVisible();
});

for (const width of [375, 768, 1280, 1920]) {
  test(`sin desbordamiento de página a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/admin/projects", "/admin/projects/1"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: path.endsWith("/1") ? project.name : "Proyectos", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    if (width < 1024) {
      await page.getByRole("button", { name: "Modo enfoque" }).click();
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeInViewport();
      await page.getByRole("button", { name: "Cerrar menú" }).click();
      await expect(page.getByRole("link", { name: "Dashboard", exact: true })).not.toBeInViewport();
    }
  });
}

// Capturas opcionales para revisar el diseño; nunca se incluyen en Git.
test.afterEach(async ({ page }, testInfo) => {
  if (process.env.CAPTURE_WORKSPACE) await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true });
});

test("preferencias inválidas y almacenamiento bloqueado no impiden plegar secciones", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("appsline.display.project.summary", "invalid-json");
    localStorage.setItem("appsline.display.project.compactCards", '"invalid-value"');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("appsline.display.")) throw new Error("Storage blocked");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("/admin/projects/1");
  const summary = page.getByRole("button", { name: /Información del proyecto/ });
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Ampliar tarjetas" })).toBeVisible();
});

test("estados sin tareas y error del proyecto", async ({ page }) => {
  await page.route("**/projects/1/tasks", (route) => route.fulfill({ json: { data: [] } }));
  await page.goto("/admin/projects/1");
  await expect(page.getByText("No hay tareas", { exact: true })).toHaveCount(4);
  await page.route("**/projects/1", (route) => ["xhr", "fetch"].includes(route.request().resourceType())
    ? route.fulfill({ status: 500, json: { message: "Error de prueba" } })
    : route.fallback());
  await page.reload();
  await expect(page.getByRole("heading", { name: "No se pudo cargar el proyecto", exact: true })).toBeVisible();
});
