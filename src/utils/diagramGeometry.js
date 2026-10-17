/** Geometría compartida por el lienzo y las miniaturas (sin depender de React). */
export const HANDLE_SIDES = ["top", "right", "bottom", "left"];

const sizeOf = (node) => ({ width: node.width || node.measured?.width || 180, height: node.height || node.measured?.height || 72 });

/** Ancla sobre el contorno real de la forma, no sobre su caja rectangular. */
export const nodeAnchors = (shape, width, height, strokeWidth = 2) => {
  const inset = Number(strokeWidth) / 2 + 1;
  const anchors = {
    top: { x: width / 2, y: inset },
    right: { x: width - inset, y: height / 2 },
    bottom: { x: width / 2, y: height - inset },
    left: { x: inset, y: height / 2 },
  };
  if (shape === "io") {
    const skew = Math.min(26, (width - 2 * inset) * 0.16);
    anchors.left.x += skew / 2;
    anchors.right.x -= skew / 2;
  }
  if (shape === "document") anchors.bottom.y -= Math.min(18, (height - 2 * inset) * 0.22);
  if (shape === "manual") anchors.top.y += Math.min(18, (height - 2 * inset) * 0.25) / 2;
  return anchors;
};

export const edgeAnchor = (node, side) => {
  const { width, height } = sizeOf(node);
  const p = nodeAnchors(node.data?.shape, width, height, node.data?.style?.strokeWidth ?? 2)[side || "top"];
  return { x: node.position.x + p.x, y: node.position.y + p.y };
};

/**
 * Completa los conectores que antes quedaban nulos (React Flow elegía «top»
 * para ambos extremos). `reset` reorienta también los explícitos al acomodar.
 * Los retornos salen por un lateral para no atravesar la columna del flujo.
 */
export const routeDiagramEdges = (nodes, edges, { direction = "TB", reset = false } = {}) => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return edge;
    const a = sizeOf(source);
    const b = sizeOf(target);
    const dx = target.position.x + b.width / 2 - source.position.x - a.width / 2;
    const dy = target.position.y + b.height / 2 - source.position.y - a.height / 2;
    let sourceHandle;
    let targetHandle;
    if (reset && (direction === "TB" ? dy < -1 : dx < -1)) {
      sourceHandle = targetHandle = direction === "TB" ? (dx <= 0 ? "right" : "left") : (dy <= 0 ? "bottom" : "top");
    } else {
      const horizontal = Math.abs(dx) / ((a.width + b.width) / 2) > Math.abs(dy) / ((a.height + b.height) / 2);
      sourceHandle = horizontal ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
      targetHandle = horizontal ? (dx >= 0 ? "left" : "right") : (dy >= 0 ? "top" : "bottom");
    }
    return {
      ...edge,
      sourceHandle: !reset && HANDLE_SIDES.includes(edge.sourceHandle) ? edge.sourceHandle : sourceHandle,
      targetHandle: !reset && HANDLE_SIDES.includes(edge.targetHandle) ? edge.targetHandle : targetHandle,
    };
  });
};

/** Inserción sin apilar nodos; los carriles son contenedores, no obstáculos. */
export const findFreeNodePosition = (nodes, size, preferred, { grid = 20, gap = 24 } = {}) => {
  const snap = (value) => Math.round(value / grid) * grid;
  const origin = { x: snap(preferred.x), y: snap(preferred.y) };
  const occupied = nodes.filter((node) => node.data?.shape !== "swimlane");
  const fits = (p) => occupied.every((node) => {
    const n = sizeOf(node);
    return p.x + size.width + gap <= node.position.x || p.x >= node.position.x + n.width + gap ||
      p.y + size.height + gap <= node.position.y || p.y >= node.position.y + n.height + gap;
  });
  if (fits(origin)) return origin;
  const stepX = Math.ceil((size.width + gap) / grid) * grid;
  const stepY = Math.ceil((size.height + gap) / grid) * grid;
  // Busca cerca del centro en anillos; siempre hay sitio más allá de los nodos existentes.
  for (let ring = 1; ; ring += 1) {
    for (let y = -ring; y <= ring; y += 1) {
      for (let x = -ring; x <= ring; x += 1) {
        if (Math.abs(x) !== ring && Math.abs(y) !== ring) continue;
        const p = { x: origin.x + x * stepX, y: origin.y + y * stepY };
        if (fits(p)) return p;
      }
    }
  }
};


/** Carriles exteriores separados para que las etiquetas de retorno no se apilen. */
export const edgeRoutingOffsets = (edges) => {
  const counts = {};
  return Object.fromEntries(edges.map((edge) => {
    const side = edge.sourceHandle;
    if (side !== edge.targetHandle) return [edge.id, 40];
    const count = counts[side] || 0;
    counts[side] = count + 1;
    return [edge.id, 40 + count * 20];
  }));
};

/** `stroke-dasharray` para cada estilo de línea. */
export const dashArray = (dash, width = 2) => {
  if (dash === "dashed") return `${width * 4} ${width * 3}`;
  if (dash === "dotted") return `${width} ${width * 2.5}`;
  return undefined;
};
