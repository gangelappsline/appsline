import test from "node:test";
import assert from "node:assert/strict";
import { rectanglesIntersect, segmentIntersectsRect, svgPathIntersectsRect } from "../../src/utils/diagramSelection.js";

const rect = { x: 40, y: 40, width: 20, height: 20 };

test("el recuadro incluye intersecciones parciales, bordes y etiquetas", () => {
  assert.equal(rectanglesIntersect(rect, { x: 50, y: 50, width: 30, height: 30 }), true);
  assert.equal(rectanglesIntersect(rect, { x: 60, y: 60, width: 10, height: 10 }), true);
  assert.equal(rectanglesIntersect(rect, { x: 61, y: 61, width: 10, height: 10 }), false);
  assert.equal(segmentIntersectsRect({ x: 0, y: 50 }, { x: 100, y: 50 }, rect), true);
  assert.equal(segmentIntersectsRect({ x: 0, y: 0 }, { x: 100, y: 100 }, rect), true);
  assert.equal(segmentIntersectsRect({ x: 0, y: 39 }, { x: 100, y: 39 }, rect), false);
  assert.equal(segmentIntersectsRect({ x: 40, y: 0 }, { x: 40, y: 100 }, rect), true);
  assert.equal(segmentIntersectsRect({ x: 45, y: 45 }, { x: 45, y: 45 }, rect), true);
});

/** SVGGeometryElement mínimo: polilínea con matriz de pantalla y longitud real. */
function pathFixture(points, { zoom = 1, x = 0, y = 0 } = {}) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return {
    getScreenCTM: () => ({ a: zoom, b: 0, c: 0, d: zoom, e: x, f: y }),
    getTotalLength: () => total,
    getBBox: () => ({ x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)), width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)), height: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) }),
    getPointAtLength: (distance) => {
      let remaining = Math.max(0, Math.min(total, distance));
      for (let index = 0; index < lengths.length; index += 1) {
        if (remaining <= lengths[index]) {
          const t = lengths[index] ? remaining / lengths[index] : 0;
          return { x: points[index].x + (points[index + 1].x - points[index].x) * t, y: points[index].y + (points[index + 1].y - points[index].y) * t };
        }
        remaining -= lengths[index];
      }
      return points[points.length - 1];
    },
  };
}

test("una línea se selecciona por su trazado aunque ambos extremos estén fuera", () => {
  const path = pathFixture([{ x: 0, y: 50 }, { x: 100, y: 50 }]);
  assert.equal(svgPathIntersectsRect(path, rect), true);
  assert.equal(svgPathIntersectsRect(path, { x: 0, y: 0, width: 10, height: 10 }), false);
});

test("el recuadro dentro de una U no selecciona la línea que lo rodea", () => {
  const path = pathFixture([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
  assert.equal(svgPathIntersectsRect(path, rect), false);
  assert.equal(svgPathIntersectsRect(path, { x: 95, y: 20, width: 10, height: 10 }), true);
});

test("la intersección funciona con zoom y desplazamiento del lienzo", () => {
  const path = pathFixture([{ x: 0, y: 0 }, { x: 100, y: 0 }], { zoom: 2, x: 30, y: 100 });
  assert.equal(svgPathIntersectsRect(path, { x: 120, y: 95, width: 10, height: 10 }), true);
  assert.equal(svgPathIntersectsRect(path, { x: 40, y: 40, width: 20, height: 20 }), false);
  const tiny = pathFixture([{ x: 10, y: 10 }, { x: 10, y: 10 }]);
  assert.equal(svgPathIntersectsRect(tiny, { x: 9, y: 9, width: 2, height: 2 }), true);
  assert.equal(svgPathIntersectsRect({ ...tiny, getScreenCTM: () => null }, rect), false);
});
