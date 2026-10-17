import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Capa de datos de los diagramas (`src/services/diagrams.js`).
 *
 * Se prueba contra una API simulada con el comportamiento real de los backends
 * que devuelven el registro podado —el caso que convertía todos los nodos en
 * «Proceso» al reabrir un diagrama—, además del respaldo local y de un backend
 * correcto.
 */
import api from "../../src/services/api.js";
import {
  __resetDiagramsEndpoint,
  deleteDiagram,
  diagramSnapshots,
  diagramsStorageMode,
  duplicateDiagram,
  fetchAllDiagrams,
  fetchDiagram,
  fetchProjectDiagrams,
  saveDiagram,
} from "../../src/services/diagrams.js";
import { createDiagram, makeEdge, makeNode } from "../../src/utils/diagrams.js";

/* ------------------------------------------------------------------ */
/* Utilerías del banco de pruebas                                       */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = "appsline.diagrams.v1";
const SNAPSHOT_KEY = "appsline.diagrams.snapshots.v1";

const installStorage = () => {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: (key) => map.delete(String(key)),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
};

const failWith = (config, status, message = "Error") => {
  const error = new Error(message);
  error.config = config;
  error.response = { status, data: { message }, headers: {}, config };
  return error;
};

/** Instala la API simulada y devuelve el registro de llamadas. */
const useApi = (handler) => {
  const calls = [];
  api.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : null;
    const call = { method: config.method.toUpperCase(), url: config.url, params: config.params || {}, body };
    calls.push(call);
    const outcome = await handler(call, body);
    if (outcome instanceof Error) return Promise.reject(outcome);
    return { data: outcome.data, status: outcome.status ?? 200, statusText: "OK", headers: {}, config };
  };
  return calls;
};

const ok = (data, status = 200) => ({ data, status });
const envelope = (payload) => ({ data: payload });

/** Lo que devuelve un Laravel que valida el dibujo campo por campo. */
const pruned = (payload) => ({
  name: payload.name,
  description: payload.description ?? null,
  task_id: payload.task_id ?? null,
  data: {
    version: payload.data?.version ?? null,
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

/** Registro podado conservando la identidad (lo que devolvería una API real). */
const prunedRecord = (record) => ({
  id: record.id,
  project_id: record.project_id,
  created_at: record.created_at,
  updated_at: record.updated_at,
  ...pruned(record),
});

/** Listado ligero (docs/API-DIAGRAMS.md §5.1): solo lo necesario para la miniatura. */
const light = (record) => ({
  id: record.id,
  project_id: record.project_id,
  name: record.name,
  description: record.description,
  task_id: record.task_id ?? null,
  updated_at: record.updated_at,
  data: {
    version: 1,
    nodes: (record.data?.nodes || []).map((node) => ({
      id: node.id,
      position: node.position,
      width: node.width,
      height: node.height,
      data: { shape: node.data?.shape, style: { fill: node.data?.style?.fill } },
    })),
    edges: (record.data?.edges || []).map((edge) => ({ source: edge.source, target: edge.target })),
  },
});

const shapesOf = (diagram) => (diagram?.data?.nodes || []).map((node) => `${node.id}:${node.data.shape}`);

const variantDiagram = () => ({
  ...createDiagram({ name: "Flujo con variantes", projectId: 7, template: "blank" }),
  data: {
    ...createDiagram({ template: "blank" }).data,
    nodes: [
      makeNode("terminal", { x: 100, y: 40 }, { id: "a", data: { label: "Inicio" } }),
      makeNode("decision", { x: 100, y: 180 }, { id: "b", data: { label: "¿Ok?" } }),
      makeNode("database", { x: 380, y: 180 }, { id: "c", data: { label: "Guardar" } }),
    ],
    edges: [makeEdge("a", "b", { id: "e1", data: { label: "sí", color: "#dc2626" } }), makeEdge("b", "c", { id: "e2" })],
  },
});

/** API que guarda el registro tal cual se lo mandan (backend correcto). */
const storeApi = () => {
  const records = new Map();
  let nextId = 101;
  return {
    records,
    handler: async ({ method, url, body }) => {
      const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
      if (method === "POST") {
        const record = { id: nextId, project_id: 7, created_at: "2026-10-17T10:00:00Z", ...body };
        records.set(String(nextId), record);
        nextId += 1;
        return ok(envelope(record));
      }
      if (method === "PUT") {
        const record = { ...records.get(id), ...body, updated_at: "2026-10-17T11:00:00Z" };
        records.set(id, record);
        return ok(envelope(record));
      }
      if (method === "DELETE") {
        records.delete(id);
        return ok(null, 204);
      }
      if (id) {
        const record = records.get(id);
        return record ? ok(envelope(record)) : Promise.reject(failWith({}, 404, "No encontrado"));
      }
      return ok(envelope([...records.values()]));
    },
  };
};

beforeEach(() => {
  installStorage();
  __resetDiagramsEndpoint();
  api.defaults.adapter = undefined;
});

/* ------------------------------------------------------------------ */
/* Backend que poda el dibujo                                           */
/* ------------------------------------------------------------------ */

test("API que valida campo por campo: se detecta al guardar, se restaura al abrir y se denuncia", async () => {
  const store = new Map();
  useApi(async ({ method, url, body }) => {
    const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
    if (method === "POST") {
      const record = { id: 101, project_id: 7, ...pruned(body) };
      store.set("101", record);
      return ok(envelope(record));
    }
    if (method === "PUT") {
      const record = { ...store.get(id), ...pruned(body), updated_at: "2026-10-17T11:00:00Z" };
      store.set(id, record);
      return ok(envelope(record));
    }
    if (id) return store.has(id) ? ok(envelope(store.get(id))) : Promise.reject(failWith({}, 404));
    return ok(envelope([...store.values()]));
  });

  const saved = await saveDiagram(7, variantDiagram());
  assert.equal(saved.id, 101);
  // El servidor guardó menos de lo que se envió…
  assert.deepEqual(store.get("101").data.nodes.map((node) => node.data.shape), [undefined, undefined, undefined]);
  // …y el panel lo dice en vez de fingir que todo está guardado.
  assert.equal(saved.integrity.ok, false);
  assert.equal(saved.integrity.stage, "save");
  assert.match(saved.integrity.message, /descartó el tipo de los nodos/);
  assert.ok(saved.integrity.missing.includes("data.nodes[].data.shape"));
  // A la sesión no le llega el registro podado.
  assert.deepEqual(shapesOf(saved), ["a:terminal", "b:decision", "c:database"]);

  const reloaded = await fetchDiagram(7, 101);
  assert.deepEqual(shapesOf(reloaded), ["a:terminal", "b:decision", "c:database"], "los nodos vuelven como Proceso");
  assert.equal(reloaded.data.edges[0].data.label, "sí");
  assert.equal(reloaded.data.edges[0].data.color, "#dc2626");
  assert.equal(reloaded.data.nodes[0].width, 160);
  assert.equal(reloaded.integrity.ok, false);
  assert.equal(reloaded.integrity.stage, "read");
  assert.ok(reloaded.integrity.restored > 0);
  assert.match(reloaded.integrity.detail, /copia guardada en este navegador/);
  assert.match(reloaded.integrity.detail, /docs\/API-DIAGRAMS\.md/);
});

test("sin copia local no se inventa nada: avisa que los nodos se dibujan como Proceso", async () => {
  const record = { id: 5, project_id: 7, ...pruned({ name: "Ajeno", description: "", task_id: null, data: variantDiagram().data }) };
  useApi(async ({ url }) => (url.endsWith("/diagrams/5") ? ok(envelope(record)) : ok(envelope([record]))));

  const reloaded = await fetchDiagram(7, 5);
  assert.deepEqual(shapesOf(reloaded), ["a:process", "b:process", "c:process"]);
  assert.equal(reloaded.data.nodes[0].data.label, "Inicio", "el texto que sí llegó se conserva");
  assert.equal(reloaded.integrity.ok, false);
  assert.equal(reloaded.integrity.restored, 0);
  assert.equal(reloaded.integrity.restoredFrom, null);
  assert.match(reloaded.integrity.detail, /no tiene una copia completa/);
  assert.match(reloaded.integrity.detail, /Exporta el JSON/);

  const list = await fetchProjectDiagrams(7);
  assert.equal(list[0].integrity.ok, false);
  const all = await fetchAllDiagrams([]);
  assert.equal(all[0].integrity.ok, false);
});

test("renombrar desde una tarjeta con el registro podado no destruye el dibujo", async () => {
  const store = new Map();
  const calls = useApi(async ({ method, url, body }) => {
    const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
    if (method === "POST") {
      store.set("101", { id: 101, project_id: 7, ...pruned(body) });
      return ok(envelope(store.get("101")));
    }
    if (method === "PUT") {
      store.set(id, { ...store.get(id), ...pruned(body) });
      return ok(envelope(store.get(id)));
    }
    if (id) return ok(envelope(prunedRecord(store.get(id))));
    return ok(envelope([...store.values()].map(prunedRecord)));
  });
  const puts = () => calls.filter((call) => call.method === "PUT");
  const shapesSent = (call) => call.body.data.nodes.map((node) => node.data.shape);

  await saveDiagram(7, variantDiagram());

  // Con la copia de este navegador, la tarjeta ya llega completa.
  const [card] = await fetchProjectDiagrams(7);
  assert.equal(card.integrity.ok, false);
  assert.ok(card.integrity.restored > 0);
  await saveDiagram(7, { ...card, name: "Otro nombre" });
  assert.equal(puts().at(-1).body.name, "Otro nombre");
  assert.deepEqual(shapesSent(puts().at(-1)), ["terminal", "decision", "database"]);
  assert.equal(puts().at(-1).body.data.edges[0].data.label, "sí");

  // Sin copia y sin saber todavía que el servidor poda (sesión nueva, otro
  // navegador): antes de guardar se intenta leer el registro completo.
  localStorage.removeItem(SNAPSHOT_KEY);
  __resetDiagramsEndpoint();
  const before = calls.length;
  const [naked] = await fetchProjectDiagrams(7);
  assert.equal(naked.integrity.restored, 0);
  const renamed = await saveDiagram(7, { ...naked, name: "Sin copia" });
  assert.equal(renamed.name, "Sin copia");
  assert.ok(
    calls.slice(before).some((call) => call.method === "GET" && call.url.endsWith("/diagrams/101")),
    "antes de guardar se intenta recuperar el dibujo completo del servidor",
  );

  // Ya se sabe que el servidor poda: no se repite la lectura en cada guardado.
  const known = calls.length;
  await saveDiagram(7, { ...naked, name: "Otra vez" });
  assert.equal(
    calls.slice(known).filter((call) => call.method === "GET" && call.url.endsWith("/diagrams/101")).length,
    0,
  );
});

test("listado ligero + registro completo: el cambio de nombre conserva todo el dibujo", async () => {
  const store = new Map();
  const calls = useApi(async ({ method, url, body }) => {
    const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
    if (method === "POST") {
      store.set("9", { id: 9, project_id: 7, ...body });
      return ok(envelope(store.get("9")));
    }
    if (method === "PUT") {
      store.set(id, { ...store.get(id), ...body });
      return ok(envelope(store.get(id)));
    }
    if (id) return ok(envelope(store.get(id)));
    return ok(envelope([...store.values()].map(light))); // el listado sí es ligero
  });

  await saveDiagram(7, variantDiagram());
  localStorage.removeItem(SNAPSHOT_KEY); // otro navegador, sin copia de rescate
  const [card] = await fetchProjectDiagrams(7);
  assert.equal(card.integrity.ok, false, "el listado ligero se detecta como incompleto");
  await saveDiagram(7, { ...card, name: "Renombrado ligero" });

  assert.equal(store.get("9").name, "Renombrado ligero");
  assert.deepEqual(store.get("9").data.nodes.map((node) => node.data.shape), ["terminal", "decision", "database"]);
  assert.equal(store.get("9").data.edges[0].data.label, "sí");
  const reads = calls.filter((call) => call.method === "GET" && /\/diagrams\/9$/.test(call.url));
  assert.ok(reads.length >= 1, "se vuelve a leer el registro completo antes de guardar");
});

test("duplicar un diagrama podado copia el dibujo completo", async () => {
  const store = new Map();
  useApi(async ({ method, url, body }) => {
    const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
    if (method === "POST") {
      const nextId = String(200 + store.size);
      store.set(nextId, { id: Number(nextId), project_id: 7, ...body });
      return ok(envelope(store.get(nextId)));
    }
    if (id) return store.has(id) ? ok(envelope(prunedRecord(store.get(id)))) : Promise.reject(failWith({}, 404));
    return ok(envelope([...store.values()].map(prunedRecord)));
  });

  await saveDiagram(7, variantDiagram());
  const [card] = await fetchProjectDiagrams(7);
  assert.equal(card.integrity.ok, false);
  assert.ok(card.integrity.restored > 0, "la tarjeta se completa con la copia local");
  const copy = await duplicateDiagram(7, card);
  assert.deepEqual(shapesOf(copy), ["a:terminal", "b:decision", "c:database"]);
  const created = [...store.values()].find((record) => record.name.includes("(copia)"));
  assert.deepEqual(created.data.nodes.map((node) => node.data.shape), ["terminal", "decision", "database"]);
});

/* ------------------------------------------------------------------ */
/* Backend correcto y respaldo local                                    */
/* ------------------------------------------------------------------ */

test("backend que conserva el dibujo: sin avisos y sin lecturas de más", async () => {
  const store = storeApi();
  const calls = useApi(store.handler);

  const saved = await saveDiagram(7, variantDiagram());
  assert.equal(saved.integrity, undefined);
  const reloaded = await fetchDiagram(7, saved.id);
  assert.equal(reloaded.integrity, undefined);
  assert.deepEqual(shapesOf(reloaded), ["a:terminal", "b:decision", "c:database"]);

  const [card] = await fetchProjectDiagrams(7);
  assert.equal(card.integrity, undefined);
  const readsBefore = calls.filter((call) => call.method === "GET").length;
  await saveDiagram(7, { ...card, name: "Solo el nombre" });
  assert.equal(calls.filter((call) => call.method === "GET").length, readsBefore, "no hace lecturas extra");
  assert.deepEqual(store.records.get("101").data.nodes.map((node) => node.data.shape), ["terminal", "decision", "database"]);
  assert.equal(store.records.get("101").name, "Solo el nombre");

  await deleteDiagram(7, 101);
  assert.equal(store.records.has("101"), false);
  assert.deepEqual(diagramSnapshots(), [], "al eliminar también se olvida la copia de rescate");
});

test("PUT 204 y respuesta de solo metadatos no disparan un falso aviso", async () => {
  const store = new Map();
  useApi(async ({ method, url, body }) => {
    const id = /\/diagrams\/([^/]+)$/.exec(url)?.[1];
    if (method === "POST") {
      store.set("3", { id: 3, project_id: 7, ...body });
      return ok(envelope(store.get("3")));
    }
    if (method === "PUT") return ok("", 204); // sin cuerpo
    return ok(envelope(store.get(id)));
  });

  await saveDiagram(7, { ...variantDiagram(), id: 3 });
  const quiet = await saveDiagram(7, { ...variantDiagram(), id: 3, name: "Sin cuerpo en la respuesta" });
  assert.equal(quiet.integrity, undefined);
  assert.deepEqual(shapesOf(quiet), ["a:terminal", "b:decision", "c:database"]);
  assert.equal(quiet.name, "Sin cuerpo en la respuesta");
});

test("respaldo local: conserva cada tipo de nodo y no escribe copias de rescate", async () => {
  useApi(async () => Promise.reject(failWith({}, 404, "La ruta no existe")));

  const saved = await saveDiagram(7, variantDiagram());
  assert.equal(diagramsStorageMode(saved.id), "local");
  assert.equal(saved.integrity, undefined);
  const reloaded = await fetchDiagram(7, saved.id);
  assert.deepEqual(shapesOf(reloaded), ["a:terminal", "b:decision", "c:database"]);
  assert.equal(reloaded.data.edges[0].data.color, "#dc2626");

  const renamed = await saveDiagram(7, { ...reloaded, name: "Local renombrado" });
  assert.equal(renamed.name, "Local renombrado");
  assert.deepEqual(shapesOf(renamed), ["a:terminal", "b:decision", "c:database"]);
  const [stored] = JSON.parse(localStorage.getItem(LOCAL_KEY));
  assert.equal(stored.name, "Local renombrado");
  assert.deepEqual(stored.data.nodes.map((node) => node.data.shape), ["terminal", "decision", "database"], "el respaldo local guarda el dibujo completo");
  assert.deepEqual(JSON.parse(localStorage.getItem(LOCAL_KEY)).length, 1, "un solo registro local");
  assert.deepEqual(diagramSnapshots(), []);

  const [card] = await fetchProjectDiagrams(7);
  assert.equal(card.integrity, undefined);
  assert.deepEqual(shapesOf(card), ["a:terminal", "b:decision", "c:database"]);
});

test("las copias de rescate solo cubren diagramas de la API y tienen tope", async () => {
  const store = storeApi();
  useApi(store.handler);
  for (let index = 0; index < 12; index += 1) {
    const diagram = variantDiagram();
    diagram.name = `Diagrama ${index}`;
    await saveDiagram(7, diagram);
  }
  const snapshots = diagramSnapshots();
  assert.equal(store.records.size, 12);
  assert.ok(snapshots.length > 0 && snapshots.length <= 8, `copias guardadas: ${snapshots.length}`);
  assert.ok(snapshots.every((entry) => entry.nodes === 3));
});
