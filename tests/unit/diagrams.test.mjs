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
  unwrapDiagramResponse,
} from "../../src/utils/diagrams.js";
import { edgeAnchor, findFreeNodePosition, nodeAnchors, routeDiagramEdges } from "../../src/utils/diagramGeometry.js";
import { normalizeDiagramImage, validateDiagramImageFile } from "../../src/utils/diagramMedia.js";

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

test("conserva tipo, posición, tamaño y metadatos propios de cada nodo al guardar y recargar", () => {
  const original = {
    name: "Flujo con variantes",
    data: {
      nodes: [
        { id: "start", type: "flow", position: { x: 123, y: 245 }, width: 160, height: 56, data: { label: "Inicio", shape: "terminal", custom: { owner: "ventas" } } },
        { id: "decision", type: "flow", position: { x: 390, y: 260 }, width: 170, height: 100, data: { label: "¿Aprobado?", shape: "decision", validation: "required" } },
      ],
      edges: [{ id: "e1", source: "start", target: "decision" }],
    },
  };
  const sent = serializeDiagram(original);
  const reloaded = normalizeDiagram({ ...original, data: sent.data });
  assert.deepEqual(reloaded.data.nodes.map(({ id, position, width, height, data }) => ({ id, position, width, height, data: { shape: data.shape, custom: data.custom, validation: data.validation } })), [
    { id: "start", position: { x: 123, y: 245 }, width: 160, height: 56, data: { shape: "terminal", custom: { owner: "ventas" }, validation: undefined } },
    { id: "decision", position: { x: 390, y: 260 }, width: 170, height: 100, data: { shape: "decision", custom: undefined, validation: "required" } },
  ]);
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


test("la respuesta directa conserva el ID y no confunde el contenido data con un envoltorio", () => {
  const diagram = { ...createDiagram({ name: "Guardado", template: "basic" }), id: 42 };
  for (const response of [diagram, { data: diagram }, { diagram }, { data: { diagram } }, { data: { data: diagram } }]) {
    const found = unwrapDiagramResponse(response);
    assert.equal(found.id, 42);
    assert.equal(found.name, "Guardado");
    assert.equal(found.data.nodes.length, 5);
  }
  for (const empty of [null, [], { data: null }, { message: "OK" }]) assert.equal(unwrapDiagramResponse(empty), null);
});

test("conexiones antiguas sin conectores se resuelven por la geometría y respetan los manuales", () => {
  const nodes = [
    makeNode("process", { x: 0, y: 0 }, { id: "a" }),
    makeNode("process", { x: 0, y: 200 }, { id: "b" }),
    makeNode("process", { x: 400, y: 0 }, { id: "c" }),
  ];
  const edges = routeDiagramEdges(nodes, [makeEdge("a", "b"), makeEdge("a", "c"), makeEdge("b", "a", { sourceHandle: "right", targetHandle: "right" })]);
  assert.deepEqual(edges.map((e) => [e.sourceHandle, e.targetHandle]), [["bottom", "top"], ["right", "left"], ["right", "right"]]);
  const reset = routeDiagramEdges(nodes, edges, { reset: true, direction: "TB" });
  assert.equal(reset[2].sourceHandle, "right");
  assert.equal(reset[2].targetHandle, "right");
  const normalized = normalizeDiagram({ data: { nodes, edges: [makeEdge("a", "b", { sourceHandle: "bad" })] } });
  assert.equal(normalized.data.edges[0].sourceHandle, "bottom");
});

test("las anclas coinciden con el contorno de documentos, entrada/salida y captura manual", () => {
  const doc = makeNode("document", { x: 100, y: 200 });
  const point = edgeAnchor(doc, "bottom");
  assert.equal(point.x, doc.position.x + doc.width / 2);
  assert.ok(point.y < doc.position.y + doc.height - 10);
  const io = nodeAnchors("io", 180, 68);
  assert.equal(io.left.x, 15);
  assert.equal(io.right.x, 165);
  assert.equal(nodeAnchors("manual", 180, 72).top.y, 10.5);
});

test("Dagre separa ramas con tamaños distintos en ambas direcciones y es estable", () => {
  const nodes = [
    makeNode("terminal", { x: 0, y: 0 }, { id: "start" }),
    makeNode("decision", { x: 0, y: 0 }, { id: "decision", width: 240, height: 160 }),
    makeNode("image", { x: 0, y: 0 }, { id: "branch1", width: 320, height: 220 }),
    makeNode("process", { x: 0, y: 0 }, { id: "branch2" }),
    makeNode("terminal", { x: 0, y: 0 }, { id: "end" }),
  ];
  const edges = [makeEdge("start", "decision"), makeEdge("decision", "branch1"), makeEdge("decision", "branch2"), makeEdge("branch1", "end"), makeEdge("branch2", "end")];
  for (const direction of ["TB", "LR"]) {
    const laid = autoLayout(nodes, edges, { direction });
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i], b = laid[j];
        assert.ok(a.position.x + a.width <= b.position.x || b.position.x + b.width <= a.position.x || a.position.y + a.height <= b.position.y || b.position.y + b.height <= a.position.y);
      }
    }
    const reordered = autoLayout([...nodes].reverse(), edges, { direction });
    for (const node of laid) assert.deepEqual(node.position, reordered.find((n) => n.id === node.id).position);
  }
});

test("las inserciones sucesivas no se apilan y los carriles no estorban", () => {
  const node = makeNode("process", { x: 0, y: 0 });
  const size = { width: 180, height: 72 };
  const p = findFreeNodePosition([node], size, { x: 0, y: 0 });
  assert.ok(p.x + size.width <= 0 || p.x >= 180 || p.y + size.height <= 0 || p.y >= 72);
  assert.equal(Math.abs(p.x % 20), 0);
  const lane = makeNode("swimlane", { x: 0, y: 0 });
  assert.deepEqual(findFreeNodePosition([lane], size, { x: 0, y: 0 }), { x: 0, y: 0 });
});

const image = { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1EAAAAASUVORK5CYII=", name: "logo.png", alt: "Logo", fit: "cover", naturalWidth: 100, naturalHeight: 80, lockAspectRatio: false };

test("imágenes y claves de iconos sobreviven a normalizar/serializar/exportar JSON", () => {
  const raw = { data: { nodes: [makeNode("image", { x: 0, y: 0 }, { data: { image } }), makeNode("icon", { x: 350, y: 0 }, { data: { style: { icon: "cloud", iconSize: 48 } } })], edges: [] } };
  const payload = serializeDiagram(raw);
  const restored = normalizeDiagram(JSON.parse(JSON.stringify(payload)));
  assert.deepEqual(restored.data.nodes[0].data.image, image);
  assert.equal(restored.data.nodes[1].data.shape, "icon");
  assert.equal(restored.data.nodes[1].data.style.icon, "cloud");
  assert.equal(restored.data.nodes[1].data.style.iconSize, 48);
  assert.deepEqual(serializeDiagram(restored), payload);
});

test("no se importan SVG, URLs ejecutables o temporales como imágenes", () => {
  for (const src of ["javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zy8+", "data:text/html;base64,eA==", "blob:temporary", "https://example.test/tracking.png"]) {
    assert.equal(normalizeDiagramImage({ ...image, src }), null);
    const node = makeNode("image", { x: 0, y: 0 }, { data: { image: { ...image, src } } });
    assert.equal(serializeDiagram({ nodes: [node] }).data.nodes[0].data.image, undefined);
  }
  assert.throws(() => validateDiagramImageFile({ type: "image/svg+xml", size: 200 }), /PNG, JPG o WebP/);
  assert.throws(() => validateDiagramImageFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }), /5 MB/);
  assert.throws(() => validateDiagramImageFile({ type: "image/png", size: 0 }), /vacía/);
  assert.doesNotThrow(() => validateDiagramImageFile({ type: "image/webp", size: 200 }));
});

test("las vueltas de una plantilla no adelantan las correcciones al inicio al cambiar de dirección", () => {
  for (const template of ["basic", "approval", "bug"]) {
    const diagram = createDiagram({ template });
    let { nodes, edges } = diagram.data;
    for (const direction of ["TB", "LR", "TB"]) {
      nodes = autoLayout(nodes, edges, { direction });
      edges = routeDiagramEdges(nodes, edges, { direction, reset: true });
      const axis = direction === "TB" ? "y" : "x";
      const startId = template === "basic" ? "start" : template === "approval" ? "s" : "report";
      const start = nodes.find((node) => node.id === startId);
      const fix = nodes.find((node) => node.id === "fix");
      assert.ok(start.position[axis] < fix.position[axis], `${template}/${direction}: la corrección debe ir después del inicio`);
      const main = edges.find((edge) => edge.source === startId);
      assert.equal(main.sourceHandle, direction === "TB" ? "bottom" : "right");
    }
  }
});
