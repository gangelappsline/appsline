/** Hit testing del recuadro de selección, en coordenadas de pantalla. */

export const rectanglesIntersect = (a, b) => (
  a.x <= b.x + b.width && a.x + a.width >= b.x &&
  a.y <= b.y + b.height && a.y + a.height >= b.y
);

const pointInside = (point, rect) => (
  point.x >= rect.x && point.x <= rect.x + rect.width &&
  point.y >= rect.y && point.y <= rect.y + rect.height
);

/** Intersección segmento/caja (Liang–Barsky), incluidos bordes y extremos. */
export const segmentIntersectsRect = (a, b, rect) => {
  if (pointInside(a, rect) || pointInside(b, rect)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [
    [-dx, a.x - rect.x], [dx, rect.x + rect.width - a.x],
    [-dy, a.y - rect.y], [dy, rect.y + rect.height - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
};

/**
 * Comprueba el trazado real, no su caja envolvente: un recuadro dentro de una
 * curva no selecciona la curva si no toca la línea. getScreenCTM incluye el
 * zoom y la posición del lienzo. Se muestrean también curvas y esquinas SVG.
 */
export const svgPathIntersectsRect = (path, rect, samplePixels = 8) => {
  const matrix = path.getScreenCTM?.();
  const length = path.getTotalLength?.();
  if (!matrix || !Number.isFinite(length) || length < 0) return false;
  const toScreen = (point) => ({
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  });
  const box = path.getBBox();
  const corners = [
    { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height },
  ].map(toScreen);
  const left = Math.min(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  if (!rectanglesIntersect({ x: left, y: top, width: Math.max(...corners.map((point) => point.x)) - left, height: Math.max(...corners.map((point) => point.y)) - top }, rect)) return false;
  const scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d), 0.001);
  const step = Math.max(samplePixels / scale, length / 4096);
  let previous = toScreen(path.getPointAtLength(0));
  for (let distance = step; distance < length; distance += step) {
    const next = toScreen(path.getPointAtLength(distance));
    if (segmentIntersectsRect(previous, next, rect)) return true;
    previous = next;
  }
  return segmentIntersectsRect(previous, toScreen(path.getPointAtLength(length)), rect);
};
