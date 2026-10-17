import { MarkerType, getBezierPath, getSmoothStepPath, getStraightPath } from "@xyflow/react";

const roundedPath = (points, radius) => {
  let path = `M ${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1], b = points[index], c = points[index + 1];
    const before = Math.hypot(b.x - a.x, b.y - a.y);
    const after = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, before / 2, after / 2);
    if (!r) { path += ` L ${b.x},${b.y}`; continue; }
    path += ` L ${b.x - (b.x - a.x) * r / before},${b.y - (b.y - a.y) * r / before}`;
    path += ` Q ${b.x},${b.y} ${b.x + (c.x - b.x) * r / after},${b.y + (c.y - b.y) * r / after}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x},${last.y}`;
};

/** Los retornos ortogonales rodean el flujo en lugar de atravesar otros nodos. */
const returnPath = ({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition: side, bounds, routeOffset = 40 }, radius) => {
  let points;
  let labelX;
  let labelY;
  if (side === "left" || side === "right") {
    const x = side === "left" ? Math.min(bounds.x, sx, tx) - routeOffset : Math.max(bounds.x + bounds.width, sx, tx) + routeOffset;
    points = [{ x: sx, y: sy }, { x, y: sy }, { x, y: ty }, { x: tx, y: ty }];
    labelX = x; labelY = (sy + ty) / 2;
  } else {
    const y = side === "top" ? Math.min(bounds.y, sy, ty) - routeOffset : Math.max(bounds.y + bounds.height, sy, ty) + routeOffset;
    points = [{ x: sx, y: sy }, { x: sx, y }, { x: tx, y }, { x: tx, y: ty }];
    labelX = (sx + tx) / 2; labelY = y;
  }
  return [roundedPath(points, radius), labelX, labelY];
};

/** Misma ruta en el lienzo y en las vistas previas. */
export const edgePath = (kind, params) => {
  if (!["straight", "bezier"].includes(kind) && params.bounds && params.sourcePosition === params.targetPosition) {
    return returnPath(params, kind === "step" ? 0 : 10);
  }
  switch (kind) {
    case "straight": return getStraightPath(params);
    case "bezier": return getBezierPath(params);
    case "step": return getSmoothStepPath({ ...params, borderRadius: 0, offset: 28 });
    default: return getSmoothStepPath({ ...params, borderRadius: 10, offset: 28 });
  }
};

/** Marcador de React Flow a partir de la clave guardada ("arrowclosed" | "arrow" | "none"). */
export const markerFor = (key, color, width = 2) => {
  if (!key || key === "none") return undefined;
  const size = 12 + Math.min(8, width * 1.5);
  return {
    type: key === "arrow" ? MarkerType.Arrow : MarkerType.ArrowClosed,
    color,
    width: size,
    height: size,
    markerUnits: "userSpaceOnUse",
    orient: "auto-start-reverse",
  };
};

/**
 * Copia a las propiedades de primer nivel de la conexión lo que React Flow
 * necesita (marcadores, animación) a partir de `data`, que es la fuente de verdad.
 */
export const decorateEdge = (edge) => {
  const data = edge.data || {};
  const color = edge.selected ? "#0060fc" : data.color;
  return {
    ...edge,
    type: "flow",
    animated: Boolean(data.animated),
    markerEnd: markerFor(data.markerEnd, color, data.width),
    markerStart: markerFor(data.markerStart, color, data.width),
  };
};
