import test from "node:test";
import assert from "node:assert/strict";
import { edgePath, markerFor } from "../../src/components/admin/flowchart/edgePaths.js";
import { edgeRoutingOffsets } from "../../src/utils/diagramGeometry.js";

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
