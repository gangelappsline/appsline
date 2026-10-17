import { test, expect } from "@playwright/test";

/**
 * Diagramas de flujo y varias personas por tarea.
 *
 * La API se intercepta por completo. Los endpoints de diagramas responden 404
 * en el primer escenario (respaldo en el navegador) y existen en el segundo.
 */
const project = { id: 1, name: "Portal de clientes", status: "active" };
const users = [
  { id: 1, name: "Ana García", email: "ana@example.test" },
  { id: 2, name: "Luis Pérez", email: "luis@example.test" },
  { id: 3, name: "Marta Ruiz", email: "marta@example.test" },
];
const initialTasks = [
  { id: 11, title: "Diseñar navegación", status: "pending", priority: "high", assigned_to: users[0], assignees: [users[0], users[1]], due_date: "2026-11-01" },
  { id: 12, title: "Integrar API", status: "in_progress", priority: "medium", assigned_to: 3 },
];

const setup = async (page, { diagramsApi = false } = {}) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem("user", JSON.stringify({ id: 2, name: "Luis Pérez", email: "luis@example.test" }));
  });
  let tasks = structuredClone(initialTasks);
  let diagrams = [];
  const calls = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    calls.push({ method, path, body: method === "GET" ? null : request.postDataJSON?.() });
    let data = [];
    if (path.endsWith("/projects")) data = [project];
    else if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/users")) data = users;
    else if (path.endsWith("/projects/1/tasks") && method === "POST") {
      const created = { id: 99, ...request.postDataJSON() };
      tasks = [created, ...tasks];
      data = created;
    } else if (path.endsWith("/projects/1/tasks")) data = tasks;
    else if (/\/projects\/1\/tasks\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      if (method === "PUT") tasks = tasks.map((t) => (t.id === id ? { ...t, ...request.postDataJSON() } : t));
      data = tasks.find((t) => t.id === id);
    } else if (/\/projects\/1\/tasks\/\d+\/(comments|files|diagrams)$/.test(path)) data = [];
    else if (path.includes("/diagrams")) {
      if (!diagramsApi) return route.fulfill({ status: 404, json: { message: "Not found" } });
      const id = /\/diagrams\/(\d+)$/.exec(path)?.[1];
      if (method === "POST") {
        const created = { id: diagrams.length + 1, project_id: 1, created_at: "2026-10-16T10:00:00Z", updated_at: "2026-10-16T10:00:00Z", ...request.postDataJSON() };
        diagrams.push(created);
        data = created;
      } else if (method === "PUT" && id) {
        diagrams = diagrams.map((d) => (String(d.id) === id ? { ...d, ...request.postDataJSON(), updated_at: "2026-10-16T11:00:00Z" } : d));
        data = diagrams.find((d) => String(d.id) === id);
      } else if (method === "DELETE" && id) {
        diagrams = diagrams.filter((d) => String(d.id) !== id);
        data = null;
      } else if (id) data = diagrams.find((d) => String(d.id) === id) || null;
      else {
        const taskId = new URL(request.url()).searchParams.get("task_id");
        data = taskId ? diagrams.filter((d) => String(d.task_id) === taskId) : diagrams;
      }
      if (data === null && id && method === "GET") return route.fulfill({ status: 404, json: { message: "Not found" } });
    }
    await route.fulfill({ json: { data } });
  });
  return { calls, getTasks: () => tasks, getDiagrams: () => diagrams };
};

test("varias personas por tarea: tarjetas, detalle, filtro y Mi trabajo", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/admin/projects/1");

  // La tarjeta muestra la pila de avatares de las dos personas.
  const card = page.getByRole("article").filter({ hasText: "Diseñar navegación" });
  await expect(card.locator("[title='Ana García']")).toBeVisible();
  await expect(card.locator("[title='Luis Pérez']")).toBeVisible();

  // Crear una tarea con dos responsables desde el formulario.
  await page.getByRole("button", { name: "Nueva tarea" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Ej. Diseñar página de inicio").fill("Tarea compartida");
  await dialog.getByRole("button", { name: "Responsables de la tarea" }).click();
  await dialog.getByRole("option", { name: /Ana García/ }).click();
  await dialog.getByRole("option", { name: /Marta Ruiz/ }).click();
  await dialog.getByRole("button", { name: "Listo" }).click();
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  const created = api.calls.find((c) => c.method === "POST" && c.path.endsWith("/projects/1/tasks"));
  expect(created.body.assignees).toEqual([1, 3]);
  expect(created.body.assigned_to).toBe(1);

  // Filtrar por una persona que no es la primera asignada.
  await page.getByRole("button", { name: /Filtros/ }).click();
  await page.getByLabel("Filtrar por responsable").selectOption("2");
  await expect(page.getByRole("article").filter({ hasText: "Diseñar navegación" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Tarea compartida" })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();

  // En el detalle se puede quitar y agregar gente; el PUT lleva la lista completa.
  await card.getByRole("button", { name: "Diseñar navegación", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Responsables" }).click();
  await drawer.getByRole("option", { name: /Marta Ruiz/ }).click();
  const updated = api.calls.filter((c) => c.method === "PUT" && c.path.endsWith("/tasks/11")).pop();
  expect(updated.body.assignees).toEqual([1, 2, 3]);
  await page.keyboard.press("Escape");

  // "Mi trabajo": la sesión es Luis (segundo asignado) y la tarea cuenta como suya.
  await page.goto("/admin/tasks");
  await page.getByRole("button", { name: "Solo mis tareas" }).click();
  await expect(page.getByRole("cell", { name: /Diseñar navegación/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Integrar API/ })).toHaveCount(0);
});

test("diagramas: crear desde plantilla, editar, guardar en el navegador y verlo en la tarea", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/projects/1?view=diagrams");
  await expect(page.getByText(/se guardan en este navegador/i)).toBeVisible();
  await page.getByRole("button", { name: "Crear el primer diagrama" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Ej. Flujo de aprobación").fill("Flujo de prueba");
  await dialog.getByRole("combobox").selectOption("11");
  await dialog.getByRole("button", { name: /Aprobación de entregable/ }).click();
  await dialog.getByRole("button", { name: "Crear y abrir el editor" }).click();

  await expect(page).toHaveURL(/\/admin\/projects\/1\/diagrams\/new\?/);
  const canvas = page.locator(".react-flow");
  await expect(canvas).toBeVisible();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(8);

  // Insertar una forma desde la paleta y editar su texto.
  await page.getByRole("button", { name: /^Base de datos/ }).click();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(9);
  const selected = canvas.locator(".react-flow__node.selected");
  await selected.dblclick();
  await page.getByLabel("Editar texto en el lienzo").fill("Tabla de clientes");
  await page.keyboard.press("Enter");
  await expect(canvas.getByText("Tabla de clientes")).toBeVisible();

  // Propiedades: cambiar el relleno con un preset.
  await page.getByRole("button", { name: "Color Rojo" }).click();
  await expect(selected.locator("svg rect, svg path").first()).toHaveAttribute("fill", "#fee2e2");

  // Deshacer el color y guardar (Ctrl+S).
  await page.keyboard.press("Control+z");
  await expect(selected.locator("svg rect, svg path").first()).not.toHaveAttribute("fill", "#fee2e2");
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/diagrams\/local-/);
  await expect(page.getByText("Todo guardado")).toBeVisible();

  // Volver: el diagrama aparece en la pestaña y en el detalle de la tarea.
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(/task=11/);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Flujo de prueba")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Diagramas/ }).click();
  await expect(page.getByRole("article").filter({ hasText: "Flujo de prueba" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Flujo de prueba" }).getByText(/#11 · Diseñar navegación/)).toBeVisible();
});

test("diagramas: con la API disponible se guarda con POST/PUT y se elimina", async ({ page }) => {
  const api = await setup(page, { diagramsApi: true });
  await page.goto("/admin/projects/1/diagrams/new?template=basic&name=API%20Flow");
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.getByText(/se guardan en este navegador/i)).toHaveCount(0);
  await page.getByRole("button", { name: /^Guardar$/ }).click();
  await expect(page).toHaveURL(/\/diagrams\/1$/);
  const post = api.calls.find((c) => c.method === "POST" && c.path.endsWith("/projects/1/diagrams"));
  expect(post.body.name).toBe("API Flow");
  expect(post.body.data.nodes).toHaveLength(5);
  expect(post.body.data.edges).toHaveLength(5);
  expect(post.body.data.settings.background).toBe("dots");

  // Un cambio en el nombre dispara el autoguardado (PUT).
  await page.getByLabel("Nombre del diagrama").first().fill("API Flow v2");
  await expect.poll(() => api.calls.some((c) => c.method === "PUT" && c.path.endsWith("/diagrams/1")), { timeout: 8000 }).toBe(true);

  await page.goto("/admin/diagrams");
  await expect(page.getByRole("article").filter({ hasText: "API Flow v2" })).toBeVisible();
  await page.getByRole("button", { name: "Acciones del diagrama" }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
  expect(api.calls.some((c) => c.method === "DELETE" && c.path.endsWith("/diagrams/1"))).toBe(true);
  await expect(page.getByText("Todavía no hay diagramas")).toBeVisible();
});
