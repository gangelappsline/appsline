import { test, expect } from "@playwright/test";

/**
 * Tareas continuas (ongoing) y texto enriquecido.
 *
 * Cubre lo que se agregó al tablero de proyectos:
 *  1. Crear una **tarea continua**: al elegir el tipo "Continua (recurrente)" el
 *     campo de fecha de entrega desaparece y la API recibe `task_type: "ongoing"`
 *     con `due_date: null` y su cadencia.
 *  2. Verla en el tablero con su insignia ("Continua · semanal") sin fecha ni
 *     aviso de vencimiento.
 *  3. Buscar por el texto de una descripción enriquecida (sin que estorben las
 *     etiquetas HTML).
 *  4. Cambiar el tipo de una tarea existente desde el detalle: la fecha de
 *     entrega se quita en el mismo guardado.
 *  5. Los comentarios viajan como HTML saneado y las @menciones se detectan
 *     desde el texto visible.
 *
 * Todas las peticiones se interceptan: no se usan cuentas ni datos reales.
 */

const project = {
  id: 1,
  name: "Portal de clientes",
  description: "Un espacio para colaborar con nuestros clientes.",
  status: "active",
};

const user = { id: 1, name: "Ana García", email: "ana@example.test" };

const initialTasks = [
  {
    id: 11,
    title: "Diseñar navegación",
    description: "Definir la estructura de navegación del portal.",
    status: "pending",
    priority: "high",
    assigned_to: user,
    due_date: "2026-11-01",
  },
  {
    id: 12,
    title: "Soporte continuo",
    description: "<p>Atender <strong>tickets</strong> durante el sprint</p>",
    status: "in_progress",
    priority: "medium",
    task_type: "ongoing",
    recurrence: "weekly",
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, name: "Ana García", email: "ana@example.test" })
    );
  });
});

/**
 * Monta la API falsa del proyecto y devuelve los espías de las peticiones que
 * interesan (`created`, `updates`, `comments`).
 */
const mockApi = async (page, { tasks = initialTasks } = {}) => {
  const state = { tasks: structuredClone(tasks), created: [], updates: [], comments: [] };

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    let data = [];

    if (path.endsWith("/projects")) data = [project];
    else if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/users")) data = [user];
    else if (path.endsWith("/projects/1/tasks") && request.method() === "POST") {
      const body = request.postDataJSON();
      state.created.push(body);
      const created = { id: 99, ...body };
      state.tasks = [created, ...state.tasks];
      await route.fulfill({ status: 201, json: { data: created } });
      return;
    } else if (path.endsWith("/projects/1/tasks")) data = state.tasks;
    else if (/\/projects\/1\/tasks\/\d+\/comments$/.test(path)) {
      if (request.method() === "POST") {
        state.comments.push(request.postDataJSON());
        await route.fulfill({
          status: 201,
          json: { data: { id: 500, comment: request.postDataJSON().comment } },
        });
        return;
      }
      data = [];
    } else if (/\/projects\/1\/tasks\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        state.updates.push({ id, body });
        state.tasks = state.tasks.map((task) =>
          task.id === id ? { ...task, ...body } : task
        );
      }
      data = state.tasks.find((task) => task.id === id) || null;
    }

    await route.fulfill({ json: { data } });
  });

  return state;
};

test("crear una tarea continua sin fecha de entrega y con cadencia", async ({ page }) => {
  const api = await mockApi(page);

  await page.goto("/admin/projects/1");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel(/Título de la tarea/).fill("Mantenimiento mensual");

  // Al elegir "Continua", el formulario cambia fecha de entrega por cadencia.
  await expect(page.getByLabel(/Fecha de entrega/)).toBeVisible();
  await page.getByLabel(/Tipo de tarea/).first().selectOption("ongoing");
  await expect(page.getByLabel(/Fecha de entrega/)).toHaveCount(0);
  await expect(page.getByLabel(/Cadencia/).first()).toBeVisible();
  await page.getByLabel(/Cadencia/).first().selectOption("monthly");

  await page.getByRole("button", { name: /Crear tarea/ }).click();

  await expect.poll(() => api.created.length).toBe(1);
  expect(api.created[0]).toMatchObject({
    title: "Mantenimiento mensual",
    task_type: "ongoing",
    recurrence: "monthly",
    due_date: null,
  });

  const card = page.getByRole("article").filter({ hasText: "Mantenimiento mensual" });
  await expect(card).toBeVisible();
  await expect(card.getByText(/Continua · mensual/i)).toBeVisible();
  await expect(card).not.toContainText("Vencida");
});

test("las tareas continuas se distinguen en el tablero y no muestran fecha", async ({ page }) => {
  await mockApi(page);

  await page.goto("/admin/projects/1");

  const ongoing = page.getByRole("article").filter({ hasText: "Soporte continuo" });
  await expect(ongoing).toBeVisible();
  await expect(ongoing.getByText(/Continua · semanal/i)).toBeVisible();

  // Una tarea puntual con fecha se sigue mostrando igual que siempre.
  const dated = page.getByRole("article").filter({ hasText: "Diseñar navegación" });
  await expect(dated).toContainText("1 nov 2026");
});

test("el buscador usa el texto de la descripción enriquecida, no las etiquetas", async ({ page }) => {
  await mockApi(page);
  await page.goto("/admin/projects/1");

  const search = page.getByPlaceholder(/Buscar por título o descripción/);
  await search.fill("tickets");
  await expect(page.getByRole("article").filter({ hasText: "Soporte continuo" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Diseñar navegación" })).toHaveCount(0);

  await search.fill("<strong>");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText(/No hay tareas|Sin coincidencias/).first()).toBeVisible();
});

test("cambiar una tarea a continua quita su fecha de entrega", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/admin/projects/1");

  await page.getByRole("button", { name: "Diseñar navegación", exact: true }).click();
  await expect(page.getByLabel("Fecha límite")).toBeVisible();

  await page.getByLabel("Tipo de tarea").last().selectOption("ongoing");

  await expect.poll(() => api.updates.length).toBeGreaterThan(0);
  expect(api.updates.at(-1).body).toMatchObject({
    task_type: "ongoing",
    due_date: null,
  });

  // El detalle ahora explica que es continua y ofrece programar la siguiente
  // ronda en cuanto tenga cadencia.
  await expect(page.getByText(/Tarea continua/)).toBeVisible();
  await expect(page.getByLabel("Fecha límite")).toHaveCount(0);
  await page.getByLabel("Cadencia").selectOption("weekly");
  await expect(page.getByRole("button", { name: /Programar siguiente/ })).toBeVisible();
});

test("la descripción enriquecida viaja saneada y se ve con formato", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/admin/projects/1");

  await page.getByRole("button", { name: "Diseñar navegación", exact: true }).click();

  // La descripción de una tarea continua se pinta con su formato (<strong>…).
  await page.getByRole("button", { name: "Soporte continuo", exact: false }).first().click();
  const description = page.getByLabel("Descripción de la tarea");
  await expect(description.locator("strong")).toHaveText("tickets");

  // Y al editarla se guarda como HTML normalizado.
  await expect.poll(() => api.updates.length).toBeGreaterThanOrEqual(0);
  await description.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Atender tickets y avisos");
  await description.blur();
  await expect.poll(() => api.updates.map((u) => u.body.description).filter(Boolean).length)
    .toBeGreaterThan(0);
  const saved = api.updates.filter((u) => u.body.description).at(-1).body.description;
  expect(saved).toContain("Atender tickets y avisos");
  expect(saved).not.toContain("<script");
});

test("el comentario se guarda con formato y detecta las @menciones del texto visible", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/admin/projects/1");

  await page.getByRole("button", { name: "Diseñar navegación", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Escribe un comentario" });
  await expect(composer).toBeVisible();

  await composer.click();
  await page.keyboard.type("Revisar con @Ana García");
  await page.getByRole("button", { name: "Negrita" }).click();
  await page.keyboard.type(" hoy");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await expect.poll(() => api.comments.length).toBe(1);
  expect(api.comments[0].comment).toMatch(/<strong>|<b>/);
  expect(api.comments[0].mentions).toEqual([1]);
});
