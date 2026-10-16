import test from "node:test";
import assert from "node:assert/strict";

/**
 * Modelo de los diagramas de flujo (`src/utils/diagrams.js`).
 *
 * Se protege: la normalización tolerante de lo que devuelva la API, la
 * serialización que se envía, las plantillas (todas válidas), el auto-acomodo
 * por capas y la alineación/distribución.
 */
import {
  SHAPES,
  TEMPLATES,
  alignNodes,
  autoLayout,
  createDiagram,
  diagramBounds,
  diagramStats,
  distributeNodes,
  makeEdge,
  makeNode,
  normalizeDiagram,
  serializeDiagram,
  shapeMeta,
} from "../../src/utils/diagrams.js";

test("normaliza un diagrama con data como JSON en texto y completa estilos", () => {
  const raw = {
    id: 5,
    title: "Flujo",
    project_id: "2",
    task: { id: 9 },
    data: JSON.stringify({
      nodes: [
        { id: "a", position: { x: 10, y: 20 }, data: { label: "Inicio", shape: "terminal" } },
        { id: "b", x: 100, y: 200, label: "Paso" },
      ],
      edges: [
        { id: "e1", source: "a", target: "b", label: "ok" },
        { id: "huerfana", source: "a", target: "zzz" },
      ],
    }),
  };
  const d = normalizeDiagram(raw);
  assert.equal(d.id, 5);
  assert.equal(d.name, "Flujo");
  assert.equal(d.project_id, "2");
  assert.equal(d.task_id, 9);
  assert.equal(d.data.nodes.length, 2);
  assert.equal(d.data.nodes[0].data.style.fill, shapeMeta("terminal").fill);
  assert.equal(d.data.nodes[0].width, shapeMeta("terminal").w);
  assert.equal(d.data.nodes[1].data.shape, "process");
  assert.equal(d.data.nodes[1].data.label, "Paso");
  assert.deepEqual(d.data.nodes[1].position, { x: 100, y: 200 });
  // La conexión huérfana se descarta; la etiqueta suelta pasa a data.label.
  assert.equal(d.data.edges.length, 1);
  assert.equal(d.data.edges[0].data.label, "ok");
  assert.equal(d.data.edges[0].data.kind, "smoothstep");
  assert.equal(d.data.settings.background, "dots");
});

test("normalizar algo vacío o roto no explota", () => {
  assert.equal(normalizeDiagram(null).data.nodes.length, 0);
  assert.equal(normalizeDiagram({ data: "{no es json" }).data.nodes.length, 0);
  assert.equal(normalizeDiagram({}).name, "Diagrama sin título");
});

test("serializa solo lo necesario para la API", () => {
  const d = createDiagram({ name: "Prueba", template: "basic", taskId: 4 });
  const payload = serializeDiagram(d);
  assert.deepEqual(Object.keys(payload).sort(), ["data", "description", "name", "task_id"]);
  assert.equal(payload.task_id, 4);
  assert.equal(payload.data.version, 1);
  assert.ok(payload.data.nodes.length > 0);
  // Sin campos de React Flow que no deben persistirse.
  assert.equal("selected" in payload.data.nodes[0], false);
  assert.equal("measured" in payload.data.nodes[0], false);
  // Ida y vuelta estable.
  assert.deepEqual(serializeDiagram(normalizeDiagram(payload)), payload);
});

test("todas las plantillas producen diagramas válidos", () => {
  for (const tpl of TEMPLATES) {
    const d = createDiagram({ template: tpl.key });
    const ids = new Set(d.data.nodes.map((n) => n.id));
    assert.equal(ids.size, d.data.nodes.length, `${tpl.key}: ids repetidos`);
    for (const e of d.data.edges) {
      assert.ok(ids.has(e.source) && ids.has(e.target), `${tpl.key}: conexión huérfana ${e.id}`);
    }
    for (const n of d.data.nodes) {
      assert.ok(SHAPES.some((s) => s.key === n.data.shape), `${tpl.key}: forma desconocida ${n.data.shape}`);
    }
  }
  assert.equal(diagramStats(createDiagram({ template: "blank" })).empty, true);
  assert.equal(diagramStats(createDiagram({ template: "basic" })).decisions, 1);
});

test("makeNode aplica los colores sugeridos y respeta overrides", () => {
  const n = makeNode("decision", { x: 1.6, y: 2.4 }, { id: "d1", data: { label: "¿Ok?", style: { fill: "#fff" } } });
  assert.equal(n.id, "d1");
  assert.deepEqual(n.position, { x: 2, y: 2 });
  assert.equal(n.data.style.fill, "#fff");
  assert.equal(n.data.style.stroke, shapeMeta("decision").stroke);
  const e = makeEdge("d1", "d2", { data: { label: "Sí" } });
  assert.equal(e.data.label, "Sí");
  assert.equal(e.data.markerEnd, "arrowclosed");
});

test("el auto-acomodo ordena por capas siguiendo las conexiones", () => {
  const nodes = [
    makeNode("process", { x: 500, y: 500 }, { id: "c" }),
    makeNode("terminal", { x: 0, y: 0 }, { id: "a" }),
    makeNode("process", { x: 300, y: -100 }, { id: "b" }),
    makeNode("note", { x: 900, y: 900 }, { id: "suelto" }),
  ];
  const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")]; // con ciclo
  const laid = autoLayout(nodes, edges, { direction: "TB" });
  const pos = Object.fromEntries(laid.map((n) => [n.id, n.position]));
  assert.ok(pos.a.y < pos.b.y && pos.b.y < pos.c.y, "a arriba de b arriba de c");
  // El nodo suelto queda en su propia capa (la 0) sin romper nada.
  assert.ok(Number.isFinite(pos.suelto.x) && Number.isFinite(pos.suelto.y));

  const lr = autoLayout(nodes, edges, { direction: "LR" });
  const posLr = Object.fromEntries(lr.map((n) => [n.id, n.position]));
  assert.ok(posLr.a.x < posLr.b.x && posLr.b.x < posLr.c.x, "de izquierda a derecha");
});

test("los carriles y los nodos bloqueados no se mueven con el auto-acomodo", () => {
  const lane = makeNode("swimlane", { x: -10, y: -10 }, { id: "lane" });
  const locked = makeNode("process", { x: 777, y: 777 }, { id: "l", data: { locked: true } });
  const free = makeNode("process", { x: 0, y: 0 }, { id: "f" });
  const laid = autoLayout([lane, locked, free], [makeEdge("f", "l")]);
  assert.deepEqual(laid.find((n) => n.id === "lane").position, { x: -10, y: -10 });
  assert.deepEqual(laid.find((n) => n.id === "l").position, { x: 777, y: 777 });
});

test("alinear y distribuir", () => {
  const nodes = [
    makeNode("process", { x: 0, y: 0 }, { id: "a", width: 100, height: 50 }),
    makeNode("process", { x: 300, y: 80 }, { id: "b", width: 100, height: 50 }),
    makeNode("process", { x: 900, y: 20 }, { id: "c", width: 100, height: 50 }),
  ];
  const ids = ["a", "b", "c"];
  const top = alignNodes(nodes, ids, "top");
  assert.ok(top.every((n) => n.position.y === 0));
  const right = alignNodes(nodes, ids, "right");
  assert.ok(right.every((n) => n.position.x === 900));
  const dist = distributeNodes(nodes, ids, "horizontal");
  const xs = dist.map((n) => n.position.x);
  assert.deepEqual(xs, [0, 450, 900]);
  // Con menos de tres no distribuye y con menos de dos no alinea.
  assert.deepEqual(distributeNodes(nodes, ["a", "b"], "horizontal"), nodes);
  assert.deepEqual(alignNodes(nodes, ["a"], "left"), nodes);
  const box = diagramBounds(nodes, 0);
  assert.deepEqual(box, { x: 0, y: 0, width: 1000, height: 130 });
});
