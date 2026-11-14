import test from "node:test";
import assert from "node:assert/strict";
import { edgePath, markerFor } from "../../src/components/admin/flowchart/edgePaths.js";
import { edgeRoutingBounds, edgeRoutingOffsets } from "../../src/utils/diagramGeometry.js";

test("las flechas tienen tamaño absoluto y se orientan también en el extremo inicial", () => {
  const marker = markerFor("arrowclosed", "#0060fc", 4);
  assert.equal(marker.markerUnits, "userSpaceOnUse");
  assert.equal(marker.orient, "auto-start-reverse");
  assert.ok(marker.width <= 20);
  assert.equal(markerFor("none", "#000"), undefined);
});

test("un retorno lateral y su etiqueta quedan fuera de la caja de los nodos", () => {
  const params = {
    sourceX: 180, sourceY: 400, targetX: 180, targetY: 100,
    sourcePosition: "right", targetPosition: "right",
    bounds: { x: 0, y: 0, width: 300, height: 500 },
  };
  const [path, x, y] = edgePath("smoothstep", params);
  assert.ok(x > 300);
  assert.equal(y, 250);
  assert.ok(path.includes("Q"));
  assert.equal(edgePath("step", params)[0].includes("Q"), false);
  assert.notEqual(edgePath("straight", params)[1], x);
  const offsets = edgeRoutingOffsets([{ id: "a", sourceHandle: "right", targetHandle: "right" }, { id: "b", sourceHandle: "right", targetHandle: "right" }]);
  assert.ok(offsets.b > offsets.a);
});

const node = (id, x, y, shape = "process") => ({ id, position: { x, y }, width: 100, height: 60, data: { shape } });

test("un texto o icono independiente no ensancha las rutas de otro flujo", () => {
  const nodes = [node("a", 0, 0), node("b", 0, 200), node("c", 200, 100)];
  const edges = [
    { id: "ab", source: "a", target: "b", sourceHandle: "bottom", targetHandle: "top" },
    { id: "bc", source: "b", target: "c", sourceHandle: "right", targetHandle: "left" },
    { id: "return", source: "c", target: "a", sourceHandle: "right", targetHandle: "right" },
  ];
  const before = edgeRoutingBounds(nodes, edges);
  assert.deepEqual(before.get("return"), { x: 0, y: 0, width: 300, height: 260 });
  assert.deepEqual(before.get("ab"), before.get("return"), "los nodos intermedios del flujo sí cuentan");
  const after = edgeRoutingBounds([
    ...nodes, node("text", 1000, 100, "text"), node("icon", -500, -500, "icon"),
    node("lane", -2000, -2000, "swimlane"), node("other", 2000, 2000), node("other2", 2200, 2000),
  ], [...edges, { id: "independent", source: "other", target: "other2", sourceHandle: "right", targetHandle: "right" }]);
  for (const edge of edges) assert.deepEqual(after.get(edge.id), before.get(edge.id));
  assert.deepEqual(after.get("independent"), { x: 2000, y: 2000, width: 300, height: 60 });
  assert.equal(after.has("text"), false);
  // Mover la anotación o cambiar la selección tampoco cambia el trazado.
  const moved = edgeRoutingBounds([node("text", 3000, 3000, "text"), ...nodes.map((n) => ({ ...n, selected: true }))], edges);
  assert.deepEqual([...moved], [...before]);
});

test("los carriles de retorno se numeran por pareja, no entre flujos distintos", () => {
  const first = { id: "a", source: "a1", target: "a2", sourceHandle: "right", targetHandle: "right" };
  const parallel = { ...first, id: "b" };
  const unrelated = { id: "c", source: "b1", target: "b2", sourceHandle: "right", targetHandle: "right" };
  const forward = { id: "d", source: "a1", target: "a2", sourceHandle: "right", targetHandle: "left" };
  const before = edgeRoutingOffsets([first, parallel, forward]);
  const after = edgeRoutingOffsets([first, parallel, forward, unrelated]);
  assert.ok(before.b > before.a);
  assert.equal(after.a, before.a);
  assert.equal(after.b, before.b);
  assert.equal(after.c, after.a);
  assert.equal(after.d, 40);
});
