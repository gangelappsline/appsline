import dagre from "@dagrejs/dagre";
import { normalizeDiagramImage } from "./diagramMedia.js";
import { routeDiagramEdges } from "./diagramGeometry.js";

/**
 * Modelo de los diagramas de flujo del panel.
 *
 * Aquí vive todo lo que NO depende del DOM ni de React Flow: el catálogo de
 * formas, los estilos por defecto, la normalización de lo que devuelve la API
 * (o el almacenamiento local), las plantillas y el auto-acomodo.
 *
 * Un diagrama serializado tiene esta forma (contrato en `docs/API-DIAGRAMS.md`):
 *
 * {
 *   id, name, description, project_id, task_id,
 *   data: {
 *     version: 1,
 *     nodes: [{ id, type: "flow", position: {x,y}, width, height,
 *               data: { label, shape, style: {...}, locked } }],
 *     edges: [{ id, source, target, sourceHandle, targetHandle, type: "flow",
 *               data: { kind, label, color, width, dash, animated,
 *                       markerStart, markerEnd, fontSize, labelBg } }],
 *     viewport: { x, y, zoom },
 *     settings: { background, gridSize, snap, direction, canvasColor, ... }
 *   },
 *   created_at, updated_at
 * }
 *
 * Cubierto por `tests/unit/diagrams.test.mjs`.
 */

export const DIAGRAM_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Catálogo de formas                                                  */
/* ------------------------------------------------------------------ */

/**
 * Formas disponibles. `w`/`h` son el tamaño inicial; `fill`/`stroke` el color
 * sugerido para que un diagrama nuevo ya tenga una semántica visual.
 */
export const SHAPES = [
  { key: "terminal", label: "Inicio / Fin", hint: "Óvalo: comienzo o término del flujo", w: 160, h: 56, fill: "#dcfce7", stroke: "#16a34a", group: "basic" },
  { key: "process", label: "Proceso", hint: "Rectángulo: una acción o paso", w: 180, h: 72, fill: "#eaf3ff", stroke: "#0060fc", group: "basic" },
  { key: "decision", label: "Decisión", hint: "Rombo: una pregunta con dos o más salidas", w: 170, h: 100, fill: "#fef3c7", stroke: "#d97706", group: "basic" },
  { key: "io", label: "Entrada / Salida", hint: "Paralelogramo: datos que entran o salen", w: 180, h: 68, fill: "#ede9fe", stroke: "#7c3aed", group: "basic" },
  { key: "subprocess", label: "Subproceso", hint: "Proceso predefinido (otro flujo)", w: 190, h: 72, fill: "#e0f2fe", stroke: "#0284c7", group: "basic" },
  { key: "document", label: "Documento", hint: "Reporte, archivo o entregable", w: 170, h: 84, fill: "#fff7ed", stroke: "#ea580c", group: "data" },
  { key: "database", label: "Base de datos", hint: "Cilindro: almacenamiento", w: 150, h: 90, fill: "#f1f5f9", stroke: "#475569", group: "data" },
  { key: "manual", label: "Entrada manual", hint: "Captura hecha por una persona", w: 180, h: 72, fill: "#fce7f3", stroke: "#db2777", group: "data" },
  { key: "preparation", label: "Preparación", hint: "Hexágono: configuración previa", w: 180, h: 72, fill: "#ecfeff", stroke: "#0891b2", group: "flow" },
  { key: "delay", label: "Espera", hint: "Pausa o retraso en el flujo", w: 160, h: 68, fill: "#fef9c3", stroke: "#ca8a04", group: "flow" },
  { key: "connector", label: "Conector", hint: "Círculo: salto a otra parte del diagrama", w: 56, h: 56, fill: "#f8fafc", stroke: "#334155", group: "flow" },
  { key: "offpage", label: "Fuera de página", hint: "Continúa en otro diagrama", w: 150, h: 84, fill: "#f8fafc", stroke: "#334155", group: "flow" },
  { key: "note", label: "Nota", hint: "Comentario o aclaración", w: 200, h: 90, fill: "#fef08a", stroke: "#eab308", group: "misc" },
  { key: "text", label: "Texto", hint: "Texto libre sin borde", w: 200, h: 44, fill: "transparent", stroke: "transparent", group: "misc" },
  { key: "image", label: "Imagen", hint: "Imagen propia guardada dentro del diagrama", w: 240, h: 180, fill: "#ffffff", stroke: "#cbd5e1", group: "media" },
  { key: "icon", label: "Icono", hint: "Icono de React Icons con etiqueta opcional", w: 112, h: 112, fill: "transparent", stroke: "#0060fc", group: "media" },
  { key: "swimlane", label: "Carril / Grupo", hint: "Área para agrupar pasos por responsable", w: 420, h: 260, fill: "#f8fafc", stroke: "#94a3b8", group: "misc" },
];

export const SHAPE_GROUPS = [
  { key: "basic", label: "Básicas" },
  { key: "data", label: "Datos" },
  { key: "flow", label: "Flujo" },
  { key: "misc", label: "Otras" },
];

export const shapeMeta = (key) => SHAPES.find((s) => s.key === key) || SHAPES[1];

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_NODE_STYLE = {
  fill: "#eaf3ff",
  stroke: "#0060fc",
  strokeWidth: 2,
  dash: "solid", // solid | dashed | dotted
  radius: 10,
  opacity: 1,
  textColor: "#0f172a",
  fontSize: 14,
  fontWeight: 600,
  fontStyle: "normal",
  align: "center", // left | center | right
  valign: "middle", // top | middle | bottom
  shadow: true,
  icon: "",
  iconSize: 0, // 0 = proporcional al texto (40 px en los iconos independientes)
};

export const EDGE_KINDS = [
  { key: "smoothstep", label: "Ortogonal suave" },
  { key: "step", label: "Ortogonal" },
  { key: "bezier", label: "Curva" },
  { key: "straight", label: "Recta" },
];

export const MARKERS = [
  { key: "arrowclosed", label: "Flecha" },
  { key: "arrow", label: "Flecha abierta" },
  { key: "none", label: "Sin punta" },
];

export const DEFAULT_EDGE_STYLE = {
  kind: "smoothstep",
  label: "",
  color: "#64748b",
  width: 2,
  dash: "solid",
  animated: false,
  markerStart: "none",
  markerEnd: "arrowclosed",
  fontSize: 12,
  labelBg: "#ffffff",
  labelColor: "#334155",
};

export const DASH_OPTIONS = [
  { key: "solid", label: "Continua" },
  { key: "dashed", label: "Discontinua" },
  { key: "dotted", label: "Punteada" },
];

export const BACKGROUNDS = [
  { key: "dots", label: "Puntos" },
  { key: "lines", label: "Cuadrícula" },
  { key: "cross", label: "Cruces" },
  { key: "none", label: "Liso" },
];

export const DIRECTIONS = [
  { key: "TB", label: "De arriba abajo" },
  { key: "LR", label: "De izquierda a derecha" },
];

export const DEFAULT_SETTINGS = {
  background: "dots",
  gridSize: 20,
  snap: true,
  direction: "TB",
  nodeSpacing: 80,
  rankSpacing: 100,
  canvasColor: "#f8fafc",
  minimap: true,
  controls: true,
  edgeKind: "smoothstep",
  animatedEdges: false,
  theme: "appsline",
};

/** Paletas rápidas para recolorear un nodo con un clic. */
export const COLOR_PRESETS = [
  { key: "blue", label: "Azul", fill: "#eaf3ff", stroke: "#0060fc", text: "#0f172a" },
  { key: "green", label: "Verde", fill: "#dcfce7", stroke: "#16a34a", text: "#052e16" },
  { key: "amber", label: "Ámbar", fill: "#fef3c7", stroke: "#d97706", text: "#451a03" },
  { key: "red", label: "Rojo", fill: "#fee2e2", stroke: "#dc2626", text: "#450a0a" },
  { key: "violet", label: "Violeta", fill: "#ede9fe", stroke: "#7c3aed", text: "#2e1065" },
  { key: "pink", label: "Rosa", fill: "#fce7f3", stroke: "#db2777", text: "#500724" },
  { key: "cyan", label: "Cian", fill: "#ecfeff", stroke: "#0891b2", text: "#083344" },
  { key: "slate", label: "Gris", fill: "#f1f5f9", stroke: "#475569", text: "#0f172a" },
  { key: "dark", label: "Oscuro", fill: "#0f172a", stroke: "#0f172a", text: "#ffffff" },
  { key: "white", label: "Blanco", fill: "#ffffff", stroke: "#94a3b8", text: "#0f172a" },
];

/** Temas completos que recolorean todo el diagrama. */
export const THEMES = [
  {
    key: "appsline",
    label: "Appsline",
    canvas: "#f8fafc",
    edge: "#64748b",
    map: { terminal: "green", process: "blue", decision: "amber", io: "violet", subprocess: "cyan", document: "amber", database: "slate", manual: "pink", preparation: "cyan", delay: "amber", connector: "white", offpage: "white", note: "amber", text: "white", swimlane: "white" },
  },
  {
    key: "mono",
    label: "Monocromo",
    canvas: "#ffffff",
    edge: "#334155",
    map: Object.fromEntries(SHAPES.map((s) => [s.key, "white"])),
  },
  {
    key: "dark",
    label: "Oscuro",
    canvas: "#0b1220",
    edge: "#94a3b8",
    map: Object.fromEntries(SHAPES.map((s) => [s.key, "dark"])),
  },
  {
    key: "pastel",
    label: "Pastel",
    canvas: "#fffbeb",
    edge: "#78716c",
    map: { terminal: "green", process: "pink", decision: "amber", io: "violet", subprocess: "cyan", document: "amber", database: "slate", manual: "pink", preparation: "cyan", delay: "amber", connector: "white", offpage: "white", note: "amber", text: "white", swimlane: "white" },
  },
];

export const presetFor = (key) => COLOR_PRESETS.find((p) => p.key === key) || COLOR_PRESETS[0];

/* ------------------------------------------------------------------ */
/* Constructores                                                       */
/* ------------------------------------------------------------------ */

let counter = 0;
/** Id corto y único dentro de la sesión (no depende de `crypto`). */
export const newId = (prefix = "n") => {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
};

/** Crea un nodo de la forma indicada en la posición dada. */
export const makeNode = (shape = "process", position = { x: 0, y: 0 }, overrides = {}) => {
  const meta = shapeMeta(shape);
  const { data: dataOverrides = {}, ...rest } = overrides;
  const { style: styleOverrides = {}, ...otherData } = dataOverrides;
  const node = {
    id: overrides.id || newId("n"),
    type: "flow",
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    width: overrides.width || meta.w,
    height: overrides.height || meta.h,
    data: {
      label: otherData.label ?? meta.label,
      shape: meta.key,
      locked: false,
      ...otherData,
      style: {
        ...DEFAULT_NODE_STYLE,
        fill: meta.fill,
        stroke: meta.stroke,
        radius: meta.key === "note" ? 4 : meta.key === "swimlane" ? 12 : DEFAULT_NODE_STYLE.radius,
        fontWeight: meta.key === "note" || meta.key === "text" ? 500 : DEFAULT_NODE_STYLE.fontWeight,
        shadow: !["text", "swimlane", "icon"].includes(meta.key),
        valign: meta.key === "swimlane" || meta.key === "note" ? "top" : "middle",
        ...styleOverrides,
      },
    },
    ...rest,
  };
  if (meta.key === "swimlane") node.zIndex = -1;
  return node;
};

/** Crea una conexión entre dos nodos. */
export const makeEdge = (source, target, overrides = {}) => {
  const { data: dataOverrides = {}, ...rest } = overrides;
  return {
    id: overrides.id || newId("e"),
    type: "flow",
    source,
    target,
    sourceHandle: overrides.sourceHandle ?? null,
    targetHandle: overrides.targetHandle ?? null,
    data: { ...DEFAULT_EDGE_STYLE, ...dataOverrides },
    ...rest,
  };
};

/* ------------------------------------------------------------------ */
/* Normalización                                                       */
/* ------------------------------------------------------------------ */

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeNode = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw.data || {};
  const shape = shapeMeta(data.shape || raw.shape).key;
  const position = raw.position || { x: raw.x, y: raw.y };
  const width = Math.max(44, toNumber(raw.width ?? raw.measured?.width ?? raw.style?.width, shapeMeta(shape).w));
  const height = Math.max(28, toNumber(raw.height ?? raw.measured?.height ?? raw.style?.height, shapeMeta(shape).h));
  const image = normalizeDiagramImage(data.image);
  return {
    id: String(raw.id || newId("n")),
    type: "flow",
    position: {
      x: toNumber(position?.x, 0),
      y: toNumber(position?.y, 0),
    },
    width,
    height,
    zIndex: raw.zIndex ?? (shape === "swimlane" ? -1 : undefined),
    parentId: raw.parentId || undefined,
    data: {
      label: typeof data.label === "string" ? data.label : raw.label || shapeMeta(shape).label,
      shape,
      locked: Boolean(data.locked),
      description: data.description || "",
      link: data.link || "",
      ...(image ? { image } : {}),
      style: { ...DEFAULT_NODE_STYLE, fill: shapeMeta(shape).fill, stroke: shapeMeta(shape).stroke, ...(data.style || {}) },
    },
  };
};

const normalizeEdge = (raw, nodeIds) => {
  if (!raw || typeof raw !== "object") return null;
  const source = String(raw.source ?? raw.from ?? "");
  const target = String(raw.target ?? raw.to ?? "");
  if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
  const data = raw.data || {};
  return {
    id: String(raw.id || newId("e")),
    type: "flow",
    source,
    target,
    sourceHandle: raw.sourceHandle ?? null,
    targetHandle: raw.targetHandle ?? null,
    data: {
      ...DEFAULT_EDGE_STYLE,
      ...(typeof raw.label === "string" && !data.label ? { label: raw.label } : null),
      ...data,
      kind: EDGE_KINDS.some((k) => k.key === data.kind) ? data.kind : DEFAULT_EDGE_STYLE.kind,
    },
  };
};

/**
 * A diferencia del lector genérico de la API, NO desenvuelve el `data` de
 * un registro: en un diagrama es el contenido, no un envoltorio HTTP.
 */
export const unwrapDiagramResponse = (payload) => {
  let value = payload;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Object.hasOwn(value, "id") || Array.isArray(value.nodes) ||
        ((value.name || value.title) && (value.data || value.content || value.payload))) return value;
    const key = ["diagram", "flowchart", "diagrams", "flowcharts", "data"].find((k) =>
      value[k] && typeof value[k] === "object" && !Array.isArray(value[k]),
    );
    if (!key) return null;
    value = value[key];
  }
  return null;
};

/**
 * Convierte lo que devuelva la API (o el almacenamiento local) en un diagrama
 * con todos los campos. Tolera `data` como JSON en texto, nodos sin tamaño,
 * conexiones huérfanas, etc.
 */
export const normalizeDiagram = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const data = parseMaybeJson(source.data ?? source.content ?? source.payload) || {};
  const nodesRaw = Array.isArray(data.nodes) ? data.nodes : Array.isArray(source.nodes) ? source.nodes : [];
  const edgesRaw = Array.isArray(data.edges) ? data.edges : Array.isArray(source.edges) ? source.edges : [];
  const nodes = nodesRaw.map(normalizeNode).filter(Boolean);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = routeDiagramEdges(nodes, edgesRaw.map((e) => normalizeEdge(e, ids)).filter(Boolean), data.settings || {});
  const viewport = data.viewport && typeof data.viewport === "object" ? data.viewport : null;

  return {
    id: source.id ?? null,
    name: source.name || source.title || "Diagrama sin título",
    description: source.description || "",
    project_id: source.project_id ?? source.projectId ?? source.project?.id ?? null,
    task_id: source.task_id ?? source.taskId ?? source.task?.id ?? null,
    task: source.task && typeof source.task === "object" ? source.task : null,
    created_by: source.created_by ?? source.user ?? null,
    created_at: source.created_at || null,
    updated_at: source.updated_at || source.created_at || null,
    data: {
      version: toNumber(data.version, DIAGRAM_VERSION),
      nodes,
      edges,
      viewport: viewport
        ? { x: toNumber(viewport.x, 0), y: toNumber(viewport.y, 0), zoom: toNumber(viewport.zoom, 1) }
        : null,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    },
  };
};

/** Lo mínimo que se envía a la API (sin campos derivados ni medidas de React Flow). */
export const serializeDiagram = (diagram) => {
  const normalized = normalizeDiagram(diagram);
  return {
    name: normalized.name,
    description: normalized.description,
    task_id: normalized.task_id ?? null,
    data: {
      version: DIAGRAM_VERSION,
      nodes: normalized.data.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        width: n.width,
        height: n.height,
        ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : null),
        ...(n.parentId ? { parentId: n.parentId } : null),
        data: n.data,
      })),
      edges: normalized.data.edges.map((e) => ({
        id: e.id,
        type: e.type,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        data: e.data,
      })),
      viewport: normalized.data.viewport,
      settings: normalized.data.settings,
    },
  };
};

/** Diagrama nuevo (vacío o a partir de una plantilla). */
export const createDiagram = ({ name = "Nuevo diagrama", projectId = null, taskId = null, template = "blank" } = {}) => {
  const tpl = TEMPLATES.find((t) => t.key === template) || TEMPLATES[0];
  const { nodes, edges } = tpl.build();
  return normalizeDiagram({
    id: null,
    name: name || tpl.label,
    description: "",
    project_id: projectId,
    task_id: taskId,
    data: { version: DIAGRAM_VERSION, nodes, edges, viewport: null, settings: { ...DEFAULT_SETTINGS } },
  });
};

/** Conteos para tarjetas y listados. */
export const diagramStats = (diagram) => {
  const d = normalizeDiagram(diagram);
  const decisions = d.data.nodes.filter((n) => n.data.shape === "decision").length;
  return {
    nodes: d.data.nodes.length,
    edges: d.data.edges.length,
    decisions,
    empty: d.data.nodes.length === 0,
  };
};

/** Caja que envuelve todos los nodos (para miniaturas y para centrar). */
export const diagramBounds = (nodes = [], padding = 24) => {
  if (!nodes.length) return { x: 0, y: 0, width: 400, height: 300 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const w = toNumber(n.width ?? n.measured?.width, 160);
    const h = toNumber(n.height ?? n.measured?.height, 60);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  });
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
};

/* ------------------------------------------------------------------ */
/* Auto-acomodo (Dagre: capas, ramas y reducción de cruces)              */
/* ------------------------------------------------------------------ */

/** Acomoda usando el tamaño real de cada nodo y conserva carriles y bloqueos. */
export const autoLayout = (nodes = [], edges = [], { direction = "TB", gapX = 80, gapY = 100 } = {}) => {
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const movable = nodes.filter((node) => !node.data?.locked && !node.parentId && node.data?.shape !== "swimlane" &&
    (!["text", "note"].includes(node.data?.shape) || connected.has(node.id)));
  if (!movable.length) return nodes;
  const ids = new Set(movable.map((node) => node.id));
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: direction === "LR" ? "LR" : "TB",
    nodesep: Math.max(24, Number(gapX) || 80),
    ranksep: Math.max(40, Number(gapY) || 100),
    edgesep: 32,
    ranker: "network-simplex",
  });
  graph.setDefaultEdgeLabel(() => ({}));
  // Orden estable: el resultado no depende del orden de la respuesta de la API.
  [...movable].sort((a, b) => a.id.localeCompare(b.id)).forEach((node) => {
    graph.setNode(node.id, { width: node.width || 180, height: node.height || 72 });
  });
  const links = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target);
  links.forEach((edge, index) => graph.setEdge(edge.source, edge.target, {}, String(index)));

  // No dejar que un ciclo mande «Corregir» antes de «Inicio». Dentro de cada
  // componente cíclico, las vueltas hacia atrás no determinan los niveles.
  const components = new Map();
  dagre.graphlib.alg.tarjan(graph).forEach((group, index) => {
    if (group.length > 1) group.forEach((id) => components.set(id, index));
  });
  const vertical = links.filter((e) => (e.sourceHandle === "bottom" && e.targetHandle === "top") || (e.sourceHandle === "top" && e.targetHandle === "bottom")).length;
  const horizontal = links.filter((e) => (e.sourceHandle === "right" && e.targetHandle === "left") || (e.sourceHandle === "left" && e.targetHandle === "right")).length;
  const currentDirection = vertical === horizontal ? direction : vertical > horizontal ? "TB" : "LR";
  const byId = new Map(movable.map((node) => [node.id, node]));
  const along = (id) => {
    const node = byId.get(id);
    return currentDirection === "TB" ? node.position.y + node.height / 2 : node.position.x + node.width / 2;
  };
  links.forEach((edge, index) => {
    const sizeKey = currentDirection === "TB" ? "height" : "width";
    const threshold = Math.max(byId.get(edge.source)[sizeKey], byId.get(edge.target)[sizeKey]) / 2;
    if (vertical + horizontal > 0 && byId.get(edge.source).data?.shape !== "terminal" && components.has(edge.source) && components.get(edge.source) === components.get(edge.target) && along(edge.target) < along(edge.source) - threshold) {
      graph.removeEdge(edge.source, edge.target, String(index));
    }
  });
  // Si todos estaban superpuestos, cortar solo las aristas de retorno de DFS.
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visiting.add(id);
    [...graph.outEdges(id)].sort((a, b) => a.w.localeCompare(b.w)).forEach((edge) => {
      if (visiting.has(edge.w)) graph.removeEdge(edge);
      else visit(edge.w);
    });
    visiting.delete(id);
    visited.add(id);
  };
  graph.nodes().filter((id) => !graph.inEdges(id).length).sort().forEach(visit);
  graph.nodes().sort().forEach(visit);
  dagre.layout(graph);
  const positions = new Map(movable.map((node) => {
    const placed = graph.node(node.id);
    return [node.id, { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 }];
  }));
  const original = diagramBounds(movable, 0);
  const laid = diagramBounds(movable.map((node) => ({ ...node, position: positions.get(node.id) })), 0);
  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? {
      ...node,
      position: { x: Math.round(position.x + original.x - laid.x), y: Math.round(position.y + original.y - laid.y) },
    } : node;
  });
};

/* ------------------------------------------------------------------ */
/* Alineación y distribución                                           */
/* ------------------------------------------------------------------ */

/** Alinea los nodos indicados: left | center | right | top | middle | bottom. */
export const alignNodes = (nodes, ids, mode) => {
  const picked = nodes.filter((n) => ids.includes(n.id) && !n.data?.locked);
  if (picked.length < 2) return nodes;
  const b = diagramBounds(picked, 0);
  const size = (n) => ({
    w: toNumber(n.width ?? n.measured?.width, 160),
    h: toNumber(n.height ?? n.measured?.height, 60),
  });
  return nodes.map((n) => {
    if (!ids.includes(n.id) || n.data?.locked) return n;
    const { w, h } = size(n);
    const p = { ...n.position };
    if (mode === "left") p.x = b.x;
    if (mode === "right") p.x = b.x + b.width - w;
    if (mode === "center") p.x = b.x + (b.width - w) / 2;
    if (mode === "top") p.y = b.y;
    if (mode === "bottom") p.y = b.y + b.height - h;
    if (mode === "middle") p.y = b.y + (b.height - h) / 2;
    return { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } };
  });
};

/** Distribuye con espacio uniforme: "horizontal" | "vertical". */
export const distributeNodes = (nodes, ids, axis) => {
  const picked = nodes.filter((n) => ids.includes(n.id) && !n.data?.locked);
  if (picked.length < 3) return nodes;
  const size = (n) => ({
    w: toNumber(n.width ?? n.measured?.width, 160),
    h: toNumber(n.height ?? n.measured?.height, 60),
  });
  const key = axis === "horizontal" ? "x" : "y";
  const dim = axis === "horizontal" ? "w" : "h";
  const sorted = [...picked].sort((a, b) => a.position[key] - b.position[key]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const total = sorted.reduce((sum, n) => sum + size(n)[dim], 0);
  const span = last.position[key] + size(last)[dim] - first.position[key];
  const gap = (span - total) / (sorted.length - 1);
  const positions = new Map();
  let cursor = first.position[key];
  sorted.forEach((n) => {
    positions.set(n.id, Math.round(cursor));
    cursor += size(n)[dim] + gap;
  });
  return nodes.map((n) =>
    positions.has(n.id) ? { ...n, position: { ...n.position, [key]: positions.get(n.id) } } : n,
  );
};

/* ------------------------------------------------------------------ */
/* Plantillas                                                          */
/* ------------------------------------------------------------------ */

/** Ayudante para construir plantillas en una cuadrícula lógica. */
const grid = (col, row, { colW = 240, rowH = 130, x0 = 80, y0 = 60 } = {}) => ({
  x: x0 + col * colW,
  y: y0 + row * rowH,
});

const chain = (ids, labels = {}) =>
  ids.slice(1).map((id, i) => makeEdge(ids[i], id, { data: { label: labels[`${ids[i]}>${id}`] || "" } }));

export const TEMPLATES = [
  {
    key: "blank",
    label: "En blanco",
    description: "Lienzo vacío para empezar desde cero.",
    build: () => ({ nodes: [], edges: [] }),
  },
  {
    key: "basic",
    label: "Flujo básico",
    description: "Inicio → proceso → decisión → fin.",
    build: () => {
      const start = makeNode("terminal", grid(1, 0), { id: "start", data: { label: "Inicio" } });
      const step = makeNode("process", grid(1, 1), { id: "step", data: { label: "Realizar la tarea" } });
      const check = makeNode("decision", grid(1, 2), { id: "check", data: { label: "¿Quedó bien?" } });
      const fix = makeNode("process", grid(2.2, 2), { id: "fix", data: { label: "Corregir" } });
      const end = makeNode("terminal", grid(1, 3.3), { id: "end", data: { label: "Fin" } });
      return {
        nodes: [start, step, check, fix, end],
        edges: [
          makeEdge("start", "step"),
          makeEdge("step", "check"),
          makeEdge("check", "end", { data: { label: "Sí" } }),
          makeEdge("check", "fix", { sourceHandle: "right", targetHandle: "left", data: { label: "No" } }),
          makeEdge("fix", "step", { sourceHandle: "top", targetHandle: "right", data: { kind: "step" } }),
        ],
      };
    },
  },
  {
    key: "approval",
    label: "Aprobación de entregable",
    description: "Entrega, revisión interna, revisión del cliente y cierre.",
    build: () => {
      const nodes = [
        makeNode("terminal", grid(1, 0), { id: "s", data: { label: "Entregable listo" } }),
        makeNode("process", grid(1, 1), { id: "qa", data: { label: "Revisión interna (QA)" } }),
        makeNode("decision", grid(1, 2), { id: "ok", data: { label: "¿Cumple criterios?" } }),
        makeNode("process", grid(2.2, 2), { id: "fix", data: { label: "Ajustes del equipo" } }),
        makeNode("io", grid(1, 3), { id: "send", data: { label: "Enviar al cliente" } }),
        makeNode("decision", grid(1, 4), { id: "client", data: { label: "¿Cliente aprueba?" } }),
        makeNode("document", grid(2.2, 4), { id: "feedback", data: { label: "Registrar feedback" } }),
        makeNode("terminal", grid(1, 5.2), { id: "e", data: { label: "Cerrar tarea" } }),
      ];
      const edges = [
        makeEdge("s", "qa"),
        makeEdge("qa", "ok"),
        makeEdge("ok", "send", { data: { label: "Sí" } }),
        makeEdge("ok", "fix", { sourceHandle: "right", targetHandle: "left", data: { label: "No" } }),
        makeEdge("fix", "qa", { sourceHandle: "top", targetHandle: "right", data: { kind: "step" } }),
        makeEdge("send", "client"),
        makeEdge("client", "e", { data: { label: "Sí" } }),
        makeEdge("client", "feedback", { sourceHandle: "right", targetHandle: "left", data: { label: "No" } }),
        makeEdge("feedback", "fix", { sourceHandle: "top", targetHandle: "bottom", data: { kind: "step" } }),
      ];
      return { nodes, edges };
    },
  },
  {
    key: "bug",
    label: "Ciclo de un incidente",
    description: "Reporte, triage, corrección, verificación y despliegue.",
    build: () => {
      const ids = ["report", "triage", "assign", "fix", "verify", "deploy", "close"];
      const labels = ["Reporte del incidente", "Triage y prioridad", "Asignar responsable", "Corregir", "Verificar en QA", "Desplegar a producción", "Cerrar incidente"];
      const shapes = ["terminal", "process", "process", "process", "decision", "subprocess", "terminal"];
      const nodes = ids.map((id, i) => makeNode(shapes[i], grid(1, i * 0.95), { id, data: { label: labels[i] } }));
      const edges = chain(ids, { "verify>deploy": "Pasa" });
      nodes.push(makeNode("note", grid(2.2, 3.8), { id: "note", data: { label: "Si no pasa QA, regresa a “Corregir” con los pasos para reproducirlo." } }));
      edges.push(makeEdge("verify", "fix", { sourceHandle: "right", targetHandle: "right", data: { label: "No pasa", kind: "step", color: "#dc2626" } }));
      return { nodes, edges };
    },
  },
  {
    key: "onboarding",
    label: "Alta de un cliente",
    description: "Desde la solicitud hasta el arranque del proyecto, con carriles.",
    build: () => {
      const lane = (i, label) =>
        makeNode("swimlane", { x: 40, y: 40 + i * 300 }, { id: `lane${i}`, width: 1020, height: 280, data: { label } });
      const nodes = [
        lane(0, "Ventas"),
        lane(1, "Operación"),
        lane(2, "Cliente"),
        makeNode("terminal", { x: 90, y: 150 }, { id: "lead", data: { label: "Solicitud recibida" } }),
        makeNode("process", { x: 320, y: 142 }, { id: "call", data: { label: "Llamada de descubrimiento" } }),
        makeNode("document", { x: 570, y: 136 }, { id: "quote", data: { label: "Propuesta y cotización" } }),
        makeNode("decision", { x: 810, y: 130 }, { id: "accept", data: { label: "¿Acepta?" } }),
        makeNode("process", { x: 810, y: 440 }, { id: "kickoff", data: { label: "Kick-off del proyecto" } }),
        makeNode("database", { x: 570, y: 430 }, { id: "setup", data: { label: "Crear proyecto y accesos" } }),
        makeNode("manual", { x: 320, y: 740 }, { id: "sign", data: { label: "Firma de contrato" } }),
        makeNode("terminal", { x: 90, y: 750 }, { id: "end", data: { label: "Cliente activo" } }),
      ];
      const edges = [
        makeEdge("lead", "call", { sourceHandle: "right", targetHandle: "left" }),
        makeEdge("call", "quote", { sourceHandle: "right", targetHandle: "left" }),
        makeEdge("quote", "accept", { sourceHandle: "right", targetHandle: "left" }),
        makeEdge("accept", "kickoff", { data: { label: "Sí" } }),
        makeEdge("kickoff", "setup", { sourceHandle: "left", targetHandle: "right" }),
        makeEdge("setup", "sign", { sourceHandle: "bottom", targetHandle: "top", data: { kind: "step" } }),
        makeEdge("sign", "end", { sourceHandle: "left", targetHandle: "right" }),
      ];
      return { nodes, edges };
    },
  },
];

export const templateMeta = (key) => TEMPLATES.find((t) => t.key === key) || TEMPLATES[0];
