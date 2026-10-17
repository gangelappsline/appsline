import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createDiagram, serializeDiagram } from "../src/utils/diagrams.js";

const project = { id: 1, name: "Flujos del equipo", status: "active" };
const record = (id = 42) => ({ ...createDiagram({ name: "Proceso existente", projectId: 1, template: "basic" }), id });

/** Respuestas reales: registro directo, resource Laravel, envoltorio anidado o respaldo local. */
async function setup(page, { format = "direct", records = [record()], holdCreate = false, noCreateId = false, putStatus = 200 } = {}) {
  const local = format === "local";
  await page.addInitScript(({ local, records }) => {
    localStorage.setItem("user_token", "diagrams-e2e");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Ana", email: "ana@example.test" }));
    if (local && !localStorage.getItem("appsline.diagrams.v1")) localStorage.setItem("appsline.diagrams.v1", JSON.stringify(records));
  }, { local, records });
  let saved = structuredClone(records);
  const calls = [];
  let releaseCreate;
  const gate = holdCreate ? new Promise((resolve) => { releaseCreate = resolve; }) : Promise.resolve();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType()) || !/^https?:/.test(request.url())) return route.continue();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let data = [];
    if (path.includes("/diagrams")) {
      calls.push({ path, method, body: ["POST", "PUT"].includes(method) ? request.postDataJSON() : null });
      if (local) return route.fulfill({ status: 404, json: { message: "Not found" } });
      const id = path.match(/\/diagrams\/([^/]+)$/)?.[1];
      if (method === "POST") {
        const created = { ...request.postDataJSON(), id: 100, project_id: 1, updated_at: new Date().toISOString() };
        saved.push(created);
        await gate;
        data = noCreateId ? { message: "Created" } : created;
      } else if (method === "PUT") {
        if (putStatus >= 400) return route.fulfill({ status: putStatus, json: { message: "No se pudo actualizar el diagrama" } });
        saved = saved.map((item) => String(item.id) === id ? { ...item, ...request.postDataJSON(), updated_at: new Date().toISOString() } : item);
        if (putStatus === 204) return route.fulfill({ status: 204 });
        data = saved.find((item) => String(item.id) === id);
      } else data = id ? saved.find((item) => String(item.id) === id) : saved;
      if (format === "wrapped") data = { data };
      if (format === "nested") data = { data: { diagram: data } };
      return route.fulfill({ json: data });
    }
    if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/projects")) data = [project];
    await route.fulfill({ json: { data } });
  });
  return { calls, errors, records: () => saved, releaseCreate };
}

const nameInput = (page) => page.getByLabel("Nombre del diagrama").first();
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("appsline.diagrams.v1") || "[]"));
const updates = (api) => api.calls.filter((call) => call.method === "PUT");
const creates = (api) => api.calls.filter((call) => call.method === "POST");

for (const format of ["direct", "wrapped", "nested"]) {
  test(`autoguardado: respuesta ${format}, conserva ID y actualiza sin crear copias`, async ({ page }) => {
    const api = await setup(page, { format });
    await page.goto("/admin/projects/1/diagrams/42");
    await expect(page.locator(".react-flow__node")).toHaveCount(5);
    for (const name of ["Revisión uno", "Revisión dos"]) {
      await nameInput(page).fill(name);
      await expect.poll(() => api.records()[0].name).toBe(name);
      await expect(page.getByText(/Todo guardado/)).toBeVisible();
    }
    expect(creates(api)).toHaveLength(0);
    expect(updates(api)).toHaveLength(2);
    expect(updates(api).every((call) => call.path.endsWith("/diagrams/42"))).toBe(true);
    expect(api.records()).toHaveLength(1);
    await page.reload();
    await expect(nameInput(page)).toHaveValue("Revisión dos");
    await expect(page.locator(".react-flow__node")).toHaveCount(5);
    expect(api.errors).toEqual([]);
  });
}

test("primer autoguardado lento + Ctrl+S: un POST, sin remontar ni perder los cambios posteriores", async ({ page }) => {
  const api = await setup(page, { records: [], holdCreate: true });
  await page.goto("/admin/projects/1/diagrams/new?template=basic");
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.locator(".react-flow").evaluate((el) => { el.dataset.session = "same-editor"; });
  await nameInput(page).fill("Primera versión");
  await expect.poll(() => creates(api).length).toBe(1);
  await page.getByRole("button", { name: /^Base de datos/ }).click();
  await nameInput(page).fill("Editado mientras guarda");
  await page.keyboard.press("Control+s");
  await page.keyboard.press("Control+s");
  expect(creates(api)).toHaveLength(1);
  api.releaseCreate();
  await expect(page).toHaveURL(/\/diagrams\/100$/);
  await expect(page.locator(".react-flow")).toHaveAttribute("data-session", "same-editor");
  await expect(nameInput(page)).toHaveValue("Editado mientras guarda");
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Deshacer (Ctrl+Z)" })).toBeEnabled();
  await expect.poll(() => updates(api).length).toBe(1);
  expect(updates(api)[0].body.data.nodes).toHaveLength(6);
  expect(updates(api)[0].body.name).toBe("Editado mientras guarda");
  expect(api.records()).toHaveLength(1);
  expect(creates(api)).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(nameInput(page)).toHaveValue("Editado mientras guarda");
  expect(api.errors).toEqual([]);
});

test("un PUT 204 conserva el contenido y la identidad", async ({ page }) => {
  const api = await setup(page, { putStatus: 204 });
  await page.goto("/admin/projects/1/diagrams/42");
  await nameInput(page).fill("Actualizado sin cuerpo");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Todo guardado/)).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await nameInput(page).fill("Segunda actualización");
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(2);
  expect(creates(api)).toHaveLength(0);
  expect(api.records()).toHaveLength(1);
});

for (const status of [404, 500]) {
  test(`PUT ${status}: no crea respaldo ni reintenta creando otro diagrama`, async ({ page }) => {
    const api = await setup(page, { putStatus: status });
    await page.goto("/admin/projects/1/diagrams/42");
    await nameInput(page).fill("Cambio pendiente");
    await page.keyboard.press("Control+s");
    await expect(page.getByText("Error al guardar · autoguardado pausado")).toBeVisible();
    await page.clock.install();
    await page.clock.runFor(5500);
    expect(updates(api)).toHaveLength(1);
    expect(creates(api)).toHaveLength(0);
    expect(await stored(page)).toHaveLength(0);
    await expect(nameInput(page)).toHaveValue("Cambio pendiente");
    await expect(page).toHaveURL(/\/diagrams\/42$/);
  });
}

test("POST sin ID: muestra error y detiene el autoguardado en lugar de repetir POST", async ({ page }) => {
  const api = await setup(page, { records: [], noCreateId: true });
  await page.goto("/admin/projects/1/diagrams/new?template=basic");
  await nameInput(page).fill("Sin identidad en la respuesta");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/La API no devolvió el ID/)).toBeVisible();
  await nameInput(page).fill("Sigo editando sin repetir la creación");
  await page.clock.install();
  await page.clock.runFor(5500);
  expect(creates(api)).toHaveLength(1);
  await expect(page.getByText(/autoguardado pausado/)).toBeVisible();
});

test("respaldo local: varias ediciones y recarga mantienen un solo registro", async ({ page }) => {
  const api = await setup(page, { format: "local", records: [record("local-existing")] });
  await page.goto("/admin/projects/1/diagrams/local-existing");
  for (const name of ["Local uno", "Local dos"]) {
    await nameInput(page).fill(name);
    await expect.poll(async () => (await stored(page))[0].name).toBe(name);
    expect(await stored(page)).toHaveLength(1);
  }
  await page.reload();
  await expect(nameInput(page)).toHaveValue("Local dos");
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  expect((await stored(page))[0].id).toBe("local-existing");
  expect(creates(api)).toHaveLength(0);
});

test("cuota local llena: nunca muestra un falso Todo guardado", async ({ page }) => {
  await setup(page, { format: "local", records: [] });
  await page.goto("/admin/projects/1/diagrams/new?template=basic");
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "appsline.diagrams.v1") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/No hay espacio en el navegador/)).toBeVisible();
  await expect(page.getByText(/Todo guardado/)).toHaveCount(0);
  expect(await stored(page)).toHaveLength(0);
  await expect(page).toHaveURL(/\/diagrams\/new/);
});

async function pngFile(page, name = "imagen-propia.png", color = "#0060fc") {
  const data = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 280; canvas.height = 180;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color; ctx.fillRect(0, 0, 280, 180);
    ctx.fillStyle = "white"; ctx.font = "24px sans-serif"; ctx.fillText("Mi imagen", 64, 95);
    return canvas.toDataURL("image/png").split(",")[1];
  }, color);
  return { name, mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}

async function download(page, label) {
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: new RegExp(label) }).click();
  const file = await pending;
  return readFile(await file.path());
}

test("imágenes e iconos: insertar, conectar, reemplazar, guardar, exportar y reimportar", async ({ page }, testInfo) => {
  const api = await setup(page, { records: [] });
  await page.goto("/admin/projects/1/diagrams/new?name=Recursos%20propios");
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await page.getByLabel("Subir imágenes al diagrama").setInputFiles(await pngFile(page));
  const imageNode = page.locator(".react-flow__node").filter({ has: page.locator("img") });
  await expect(imageNode.locator("img")).toBeVisible();
  await page.getByRole("complementary", { name: "Biblioteca de elementos" }).getByLabel("Buscar icono").fill("Nube");
  await page.getByRole("button", { name: "Insertar icono Nube" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  const iconNode = page.locator(".react-flow__node").filter({ hasText: "Nube" });
  await page.getByTitle("Ajustar a la vista", { exact: true }).click();
  await imageNode.hover();
  await imageNode.locator('[data-handleid="right"]').dragTo(iconNode.locator('[data-handleid="left"]'), { force: true });
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await imageNode.click();
  await page.getByLabel("Reemplazar imagen", { exact: true }).setInputFiles(await pngFile(page, "logo-verde.png", "#16a34a"));
  await expect(imageNode.locator("img")).toHaveAttribute("alt", "logo-verde");
  await page.getByLabel("Texto alternativo de la imagen").fill("Logo del equipo");
  await page.getByLabel("Ancho", { exact: true }).fill("420");
  await expect(page.getByLabel("Alto", { exact: true })).toHaveValue("270");
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/diagrams\/100$/);
  await expect(page.getByText(/Todo guardado/)).toBeVisible();
  expect(api.records()).toHaveLength(1);
  const saved = api.records()[0];
  expect(saved.data.nodes.find((n) => n.data.shape === "image").data.image.src).toMatch(/^data:image\/webp;base64,/);
  expect(saved.data.nodes.find((n) => n.data.shape === "icon").data.style.icon).toBe("cloud");
  await page.reload();
  await expect(imageNode.locator("img")).toHaveAttribute("alt", "Logo del equipo");
  await expect(iconNode).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  const json = await download(page, "Archivo JSON");
  const exported = JSON.parse(json.toString());
  expect(serializeDiagram(exported)).toEqual(serializeDiagram(saved));
  const svg = await download(page, "Vector SVG");
  expect(svg.toString()).toContain("data:image/webp;base64,");
  expect(svg.toString()).toContain("Logo del equipo");
  const png = await download(page, "Imagen PNG");
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.length).toBeGreaterThan(2000);

  await page.getByLabel("Importar diagrama JSON").setInputFiles({ name: "recursos.json", mimeType: "application/json", buffer: json });
  await expect(imageNode.locator("img")).toHaveAttribute("alt", "Logo del equipo");
  await expect(iconNode).toBeVisible();
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("editor-recursos.png") });
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: "Recursos propios" });
  await expect(card.locator("svg image")).toHaveCount(1);
  expect(api.errors).toEqual([]);
});

test("rechaza SVG, imágenes rotas y archivos mayores de 5 MB sin agregar nodos", async ({ page }) => {
  await setup(page, { records: [] });
  await page.goto("/admin/projects/1/diagrams/new");
  const input = page.getByLabel("Agregar imágenes al lienzo");
  await input.setInputFiles({ name: "archivo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg />") });
  await expect(page.getByText(/Usa una imagen PNG, JPG o WebP/)).toBeVisible();
  await input.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByText(/supera el límite de 5 MB/)).toBeVisible();
  await input.setInputFiles({ name: "roto.png", mimeType: "image/png", buffer: Buffer.from("not a PNG") });
  await expect(page.getByText(/No se pudo leer la imagen/)).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("organización horizontal/vertical reorienta flechas y se puede deshacer", async ({ page }, testInfo) => {
  const api = await setup(page);
  await page.goto("/admin/projects/1/diagrams/42");
  await page.getByLabel("Dirección del flujo").selectOption("LR");
  await page.getByRole("button", { name: "Organizar nodos y flechas" }).click();
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(1);
  const horizontal = structuredClone(api.records()[0].data);
  const first = horizontal.edges.find((e) => e.source === "start");
  expect(first.sourceHandle).toBe("right");
  expect(first.targetHandle).toBe("left");
  await page.getByLabel("Dirección del flujo").selectOption("TB");
  await page.getByRole("button", { name: "Auto-acomodar", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(2);
  const vertical = api.records()[0].data;
  expect(vertical.edges.find((e) => e.source === "start").sourceHandle).toBe("bottom");
  for (let i = 0; i < vertical.nodes.length; i++) {
    for (let j = i + 1; j < vertical.nodes.length; j++) {
      const a = vertical.nodes[i], b = vertical.nodes[j];
      expect(a.position.x + a.width <= b.position.x || b.position.x + b.width <= a.position.x || a.position.y + a.height <= b.position.y || b.position.y + b.height <= a.position.y).toBe(true);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("editor-organizado.png") });
  await page.getByRole("button", { name: "Deshacer (Ctrl+Z)" }).click();
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(3);
  expect(api.records()[0].data.nodes).toEqual(horizontal.nodes);
  expect(api.records()[0].data.edges).toEqual(horizontal.edges);
});

test("móvil: paneles cerrables y lienzo utilizable sin desbordar la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/admin/projects/1/diagrams/42");
  await expect(page.locator(".react-flow")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Biblioteca de elementos" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar formas" }).click();
  await expect(page.getByRole("tab", { name: "Recursos", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar propiedades" }).click();
  await expect(page.getByRole("complementary", { name: "Biblioteca de elementos" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Propiedades del diagrama" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar propiedades" }).click();
  const box = await page.locator(".react-flow").boundingBox();
  expect(box.width).toBeGreaterThan(340);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("salir mientras se crea no redirige de vuelta al editor al terminar la petición", async ({ page }) => {
  const api = await setup(page, { records: [], holdCreate: true });
  await page.goto("/admin/projects/1/diagrams/new?template=basic");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect.poll(() => creates(api).length).toBe(1);
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1\?view=diagrams$/);
  const response = page.waitForResponse((res) => res.request().method() === "POST" && res.url().endsWith("/projects/1/diagrams"));
  api.releaseCreate();
  await response;
  await page.clock.install();
  await page.clock.runFor(3000);
  await expect(page).toHaveURL(/\/projects\/1\?view=diagrams$/);
  expect(api.records()).toHaveLength(1);
});

test("un icono dentro de una forma se conserva al duplicar, deshacer y recargar", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/admin/projects/1/diagrams/42");
  await page.locator('.react-flow__node[data-id="step"]').click();
  const props = page.getByRole("complementary", { name: "Propiedades del diagrama" });
  await props.getByRole("button", { name: "Icono", exact: true }).click();
  await props.getByLabel("Buscar icono").fill("Servidor");
  await props.getByRole("button", { name: "Elegir icono Servidor" }).click();
  await page.keyboard.press("Control+d");
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(1);
  expect(api.records()[0].data.nodes.filter((n) => n.data.style.icon === "server")).toHaveLength(2);
  await page.getByRole("button", { name: "Deshacer (Ctrl+Z)" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.keyboard.press("Control+s");
  await expect.poll(() => updates(api).length).toBe(2);
  await page.reload();
  await page.locator('.react-flow__node[data-id="step"]').click();
  await expect(props.getByRole("button", { name: "Elegir icono Servidor" })).toHaveAttribute("aria-pressed", "true");
  expect(api.records()[0].data.nodes.filter((n) => n.data.style.icon === "server")).toHaveLength(1);
});

test("soltar una imagen en el lienzo funciona también con guardado local", async ({ page }) => {
  await setup(page, { format: "local", records: [] });
  await page.goto("/admin/projects/1/diagrams/new?name=Imagen%20local");
  await expect(page.locator(".react-flow")).toBeVisible();
  const file = await pngFile(page);
  const transfer = await page.evaluateHandle(({ base64, name, type }) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], name, { type }));
    return data;
  }, { base64: file.buffer.toString("base64"), name: file.name, type: file.mimeType });
  const canvas = page.locator(".react-flow");
  const box = await canvas.boundingBox();
  await canvas.dispatchEvent("dragover", { dataTransfer: transfer });
  await canvas.dispatchEvent("drop", { dataTransfer: transfer, clientX: box.x + 160, clientY: box.y + 150 });
  await expect(page.locator(".react-flow__node img")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/diagrams\/local-/);
  const id = (await stored(page))[0].id;
  await page.reload();
  await expect(page.locator(".react-flow__node img")).toBeVisible();
  await nameInput(page).fill("Imagen local editada");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Todo guardado/)).toBeVisible();
  const data = await stored(page);
  expect(data).toHaveLength(1);
  expect(data[0].id).toBe(id);
  expect(data[0].data.nodes[0].data.image.src).toMatch(/^data:image\/webp;base64,/);
});
