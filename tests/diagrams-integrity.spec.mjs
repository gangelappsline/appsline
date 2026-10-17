import { test, expect } from "@playwright/test";
import { createDiagram, makeEdge, makeNode } from "../src/utils/diagrams.js";

/**
 * Integridad del contenido de los diagramas.
 *
 * Reproducción del reporte «al volver a consultar el diagrama todos los nodos
 * se convierten en nodos de proceso»: la API acepta el guardado (200) pero
 * devuelve un registro podado, que es lo que hace un Laravel con reglas
 * anidadas (`data.nodes.*.data.label`, …) y `$request->validated()` —desde
 * Laravel 9 el validador descarta toda clave de un arreglo que no tenga regla
 * propia, así que `data.shape`, `data.style`, `width`/`height` y el estilo de
 * las flechas nunca llegan al servidor.
 *
 * Estos escenarios cubren las tres respuestas posibles del panel: restaurar con
 * la copia de este navegador, no inventar nada cuando no la hay y avisar siempre
 * con la corrección exacta del lado de la API.
 */
const project = { id: 1, name: "Flujos del equipo", status: "active" };
const tasks = [{ id: 11, title: "Diseñar navegación", status: "pending" }];
const NOW = "2026-10-17T10:00:00Z";

/** Lo que devuelve `$request->validated()` con reglas campo por campo. */
const strip = (payload) => ({
  name: payload.name,
  description: payload.description ?? null,
  task_id: payload.task_id ?? null,
  data: {
    version: payload.data?.version ?? 1,
    nodes: (payload.data?.nodes || []).map((node) => ({
      id: node.id,
      position: node.position,
      data: { label: node.data?.label ?? null, link: node.data?.link ?? null },
    })),
    edges: (payload.data?.edges || []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    viewport: payload.data?.viewport ?? null,
    settings: payload.data?.settings ?? null,
  },
});

/** Diagrama con tres tipos de nodo distintos y una flecha con etiqueta. */
const variantDiagram = () => ({
  ...createDiagram({ name: "Flujo con variantes", projectId: 1, template: "blank" }),
  data: {
    ...createDiagram({ template: "blank" }).data,
    nodes: [
      makeNode("terminal", { x: 120, y: 60 }, { id: "a", data: { label: "Inicio" } }),
      makeNode("decision", { x: 120, y: 220 }, { id: "b", data: { label: "¿Correcto?" } }),
      makeNode("database", { x: 420, y: 220 }, { id: "c", data: { label: "Guardar" } }),
    ],
    edges: [makeEdge("a", "b", { id: "e1", data: { label: "sí", color: "#dc2626" } }), makeEdge("b", "c", { id: "e2" })],
  },
});

const variantRecord = (id = 42) => ({ ...variantDiagram(), id, project_id: 1, created_at: NOW, updated_at: NOW });

/** Registro ya podado en el servidor, con su identidad intacta. */
const strippedRecord = (id = 42) => ({ id, project_id: 1, created_at: NOW, updated_at: NOW, ...strip(variantRecord(id)) });

/**
 * API simulada.
 *
 * @param {boolean} healthy  conserva el dibujo tal cual (backend correcto).
 * @param {boolean} lightIndex el listado llega podado pero el registro individual, completo.
 */
async function setup(page, { records = [], healthy = false, lightIndex = false } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "integrity-e2e");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Ana", email: "ana@example.test" }));
  });
  let saved = structuredClone(records);
  const calls = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType()) || !/^https?:/.test(request.url())) return route.continue();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let data = [];
    const asServer = (payload) => (healthy ? payload : strip(payload));
    if (path.includes("/diagrams")) {
      calls.push({ path, method, body: ["POST", "PUT"].includes(method) ? request.postDataJSON() : null });
      const id = /\/diagrams\/([^/]+)$/.exec(path)?.[1];
      if (method === "POST") {
        const created = { id: 100, project_id: 1, created_at: NOW, updated_at: NOW, ...asServer(request.postDataJSON()) };
        saved.push(created);
        data = created;
      } else if (method === "PUT" && id) {
        saved = saved.map((item) => (String(item.id) === id ? { ...item, ...asServer(request.postDataJSON()), updated_at: NOW } : item));
        data = saved.find((item) => String(item.id) === id) ?? null;
      } else if (method === "DELETE" && id) {
        saved = saved.filter((item) => String(item.id) !== id);
        data = null;
      } else if (id) {
        data = saved.find((item) => String(item.id) === id) ?? null;
      } else {
        data = lightIndex ? saved.map((item) => ({ id: item.id, project_id: item.project_id, name: item.name, ...asServer(item) })) : saved;
      }
      if (data === null && method === "GET" && id) return route.fulfill({ status: 404, json: { message: "Not found" } });
      return route.fulfill({ json: { data } });
    }
    if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/projects")) data = [project];
    else if (path.endsWith("/projects/1/tasks")) data = tasks;
    else if (path.endsWith("/users")) data = [];
    await route.fulfill({ json: { data } });
  });
  return {
    calls,
    errors,
    records: () => saved,
    writes: (method) => calls.filter((call) => call.method === method),
  };
}

const nameInput = (page) => page.getByLabel("Nombre del diagrama").first();
const shapesOnCanvas = (page) => page.locator("[data-shape]").evaluateAll((els) => els.map((el) => el.dataset.shape));
const banner = (page) => page.locator("div[role='status']").filter({ hasText: /La API/ });

test("API que poda el dibujo: avisa al guardar y las formas sobreviven al recargar", async ({ page }) => {
  const api = await setup(page, { records: [] });
  await page.goto("/admin/projects/1/diagrams/new?template=blank");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);

  // Tres tipos de nodo distintos, insertados desde la biblioteca.
  for (const label of ["Inicio / Fin", "Decisión", "Base de datos"]) {
    await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  }
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(shapesOnCanvas(page)).resolves.toEqual(["terminal", "decision", "database"]);

  await nameInput(page).fill("Flujo con variantes");
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/diagrams\/100$/);

  // El panel envió el dibujo completo…
  const post = api.writes("POST")[0];
  expect(post.body.data.nodes.map((node) => node.data.shape)).toEqual(["terminal", "decision", "database"]);
  expect(post.body.data.nodes[0].data.style.fill).toBeTruthy();
  // …y la API lo recortó: se dice en voz alta en vez de fingir que está guardado.
  expect(api.records()[0].data.nodes.every((node) => node.data.shape === undefined)).toBe(true);
  await expect(banner(page)).toContainText(/La API guardó el diagrama pero descartó/);
  await expect(page.getByText("Guardado incompleto en la API")).toBeVisible();
  await expect(shapesOnCanvas(page)).resolves.toEqual(["terminal", "decision", "database"]);

  // Al reabrir, el registro podado se completa con la copia de este navegador.
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(shapesOnCanvas(page)).resolves.toEqual(["terminal", "decision", "database"]);
  await expect(banner(page)).toContainText(/Completamos 3 nodos/);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  expect(api.errors).toEqual([]);
});

test("sin copia en este navegador no se inventa nada y el aviso explica la corrección", async ({ page }) => {
  const api = await setup(page, { records: [strippedRecord()] });
  await page.goto("/admin/projects/1/diagrams/42");

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  // Lo que sí llegó (texto y posición) se conserva; el tipo, no.
  await expect(shapesOnCanvas(page)).resolves.toEqual(["process", "process", "process"]);
  await expect(page.getByText("Inicio", { exact: true })).toBeVisible();
  await expect(banner(page)).toContainText(/no tiene una copia completa/);

  await page.getByRole("button", { name: "Ver detalle" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Contenido que la API no conserva")).toBeVisible();
  await expect(dialog.getByText("data.nodes[].data.shape")).toBeVisible();
  await expect(dialog.getByText("data.nodes[].data.style")).toBeVisible();
  await expect(dialog.getByText(/'data'\s*=>\s*\['required', 'array'\]/)).toBeVisible();
  await expect(dialog.getByText("$request->input('data')")).toBeVisible();
  await expect(dialog.getByText(/docs\/API-DIAGRAMS\.md/)).toBeVisible();

  // El respaldo exportable sigue disponible desde el aviso.
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Exportar JSON de respaldo/ }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  await dialog.getByRole("button", { name: "Entendido" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Se puede ocultar y el lienzo sigue siendo editable.
  await page.getByRole("button", { name: "Ocultar aviso" }).click();
  await expect(banner(page)).toHaveCount(0);
  await nameInput(page).fill("Rebautizado sin copia");
  await page.keyboard.press("Control+s");
  await expect.poll(() => api.records()[0].name).toBe("Rebautizado sin copia");
  expect(api.errors).toEqual([]);
});

test("renombrar desde la pestaña del proyecto no envía el dibujo degradado", async ({ page }) => {
  // Listado ligero (docs/API-DIAGRAMS.md §5.1) + registro individual completo.
  const api = await setup(page, { records: [variantRecord()], lightIndex: true });
  await page.goto("/admin/projects/1?view=diagrams");
  const card = page.getByRole("article").filter({ hasText: "Flujo con variantes" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Acciones del diagrama" }).click();
  await page.getByRole("menuitem", { name: "Renombrar / vincular" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill("Flujo renombrado");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(card.getByText("Flujo renombrado")).toBeVisible();

  const put = api.writes("PUT").at(-1);
  expect(put.body.name).toBe("Flujo renombrado");
  // Antes del arreglo, aquí viajaba el contenido podado del listado y el
  // servidor perdía el dibujo de forma definitiva.
  expect(put.body.data.nodes.map((node) => node.data.shape)).toEqual(["terminal", "decision", "database"]);
  expect(put.body.data.edges[0].data.label).toBe("sí");
  expect(put.body.data.settings).toBeTruthy();
  await expect(page.getByText(/descartó/)).toHaveCount(0);
  expect(api.errors).toEqual([]);
});

test("backend que conserva el dibujo: sin avisos ni lecturas de más", async ({ page }) => {
  const api = await setup(page, { records: [variantRecord()], healthy: true });
  await page.goto("/admin/projects/1/diagrams/42");

  await expect(shapesOnCanvas(page)).resolves.toEqual(["terminal", "decision", "database"]);
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByText(/Todo guardado/)).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge").first()).toContainText("sí");

  const readsOfRecord = () => api.calls.filter((call) => call.method === "GET" && call.path.endsWith("/diagrams/42")).length;
  expect(readsOfRecord()).toBe(1);

  await nameInput(page).fill("Nombre nuevo");
  await expect.poll(() => api.records()[0].name).toBe("Nombre nuevo");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Todo guardado/)).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect(api.writes("PUT").at(-1).body.data.nodes.map((node) => node.data.shape)).toEqual(["terminal", "decision", "database"]);
  expect(readsOfRecord()).toBe(1, "con el contenido sano no hace lecturas de rescate");

  await page.reload();
  await expect(shapesOnCanvas(page)).resolves.toEqual(["terminal", "decision", "database"]);
  await expect(nameInput(page)).toHaveValue("Nombre nuevo");
  await expect(banner(page)).toHaveCount(0);
  expect(readsOfRecord()).toBe(2);
  expect(api.errors).toEqual([]);
});
