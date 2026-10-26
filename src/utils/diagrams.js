import dagre from "@dagrejs/dagre";
import { normalizeDiagramImage } from "./diagramMedia.js";
import { routeDiagramEdges } from "./diagramGeometry.js";
import {
  SCREEN_SHAPE,
  SCREEN_TYPE,
  deviceMeta,
  makeScreenNode,
  makeWidget,
  mockupStats,
  normalizeComments,
  normalizeScreen,
  screenSize,
} from "./mockups.js";

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
  { key: "screen", label: "Pantalla", hint: "Mockup de una pantalla móvil o web", w: 393, h: 852, fill: "#ffffff", stroke: "#94a3b8", group: "screens" },
];

export const SHAPE_GROUPS = [
  { key: "basic", label: "Básicas" },
  { key: "data", label: "Datos" },
  { key: "flow", label: "Flujo" },
  { key: "misc", label: "Otras" },
];

export const shapeMeta = (key) => SHAPES.find((s) => s.key === key) || SHAPES[1];

/** Tipo de nodo/conexión de React Flow que usa el editor. */
export const FLOW_TYPE = "flow";

/** Forma que se dibuja cuando un nodo llega sin ningún tipo reconocible. */
export const FALLBACK_SHAPE = "process";

/**
 * Nombres alternativos de cada forma.
 *
 * Un backend, una importación o una integración pueden guardar «diamond» en
 * lugar de «decision». Antes cualquier valor no idéntico a una clave del
 * catálogo se convertía en «process» y el tipo se perdía para siempre al
 * volver a guardar.
 */
export const SHAPE_ALIASES = {
  start: "terminal", end: "terminal", terminator: "terminal", oval: "terminal", ellipse: "terminal", stadium: "terminal",
  inicio: "terminal", fin: "terminal", comienzo: "terminal", terminador: "terminal",
  rect: "process", rectangle: "process", action: "process", step: "process", task: "process",
  actividad: "process", proceso: "process", rectangulo: "process",
  diamond: "decision", rhombus: "decision", question: "decision", condition: "decision",
  pregunta: "decision", decision_diamond: "decision", rombo: "decision",
  data: "io", parallelogram: "io", entrada: "io", salida: "io", entrada_salida: "io", paralelogramo: "io",
  sub_process: "subprocess", predefined: "subprocess", predefined_process: "subprocess",
  subproceso: "subprocess", proceso_predefinido: "subprocess",
  doc: "document", report: "document", documento: "document", reporte: "document",
  db: "database", cylinder: "database", storage: "database", base_de_datos: "database", cilindro: "database",
  manual_input: "manual", manual_operation: "manual", entrada_manual: "manual", operacion_manual: "manual",
  prep: "preparation", hexagon: "preparation", preparacion: "preparation", hexagono: "preparation",
  wait: "delay", pause: "delay", espera: "delay", retraso: "delay", demora: "delay",
  circle: "connector", jump: "connector", conector: "connector", punto_de_conexion: "connector",
  off_page: "offpage", off_page_connector: "offpage", fuera_de_pagina: "offpage", continuacion: "offpage",
  comment: "note", annotation: "note", sticky: "note", nota: "note", comentario: "note", anotacion: "note",
  label: "text", texto: "text", texto_libre: "text",
  img: "image", picture: "image", photo: "image", imagen: "image", fotografia: "image",
  glyph: "icon", icono: "icon", simbolo: "icon",
  lane: "swimlane", pool: "swimlane", group: "swimlane", carril: "swimlane", banda: "swimlane", grupo: "swimlane",
  screen: "screen", pantalla: "screen", mockup: "screen", mock: "screen", wireframe: "screen", prototipo: "screen", mockup_screen: "screen",
};

const shapeName = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s/-]+/g, "_");

/** Traduce cualquier nombre de forma a una clave del catálogo (`null` si no existe). */
export const resolveShapeKey = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const known = (key) => (SHAPES.some((shape) => shape.key === key) ? key : SHAPE_ALIASES[key] || null);
  const key = shapeName(value);
  // «swim-lane», «sub process» o «off_page» también son nombres válidos.
  return known(key) || known(key.replace(/_/g, ""));
};

/** Campos donde distintas versiones o integraciones llegan a guardar el tipo. */
const SHAPE_FIELDS = ["shape", "shapeKey", "shape_key", "shapeType", "shape_type", "nodeType", "node_type"];

/**
 * Tipo de un nodo tal como viene guardado.
 *
 * Busca en todos los sitios razonables (`data.shape`, `data.shapeType`,
 * `node.shape`, `node.type`…) y acepta sinónimos. Si el valor no es del
 * catálogo se conserva tal cual en lugar de reescribirlo a «process»: se dibuja
 * como rectángulo, pero una corrección posterior todavía puede recuperarlo.
 */
export const resolveNodeShape = (raw = {}, data = {}) => {
  const candidates = [
    ...SHAPE_FIELDS.map((field) => data?.[field]),
    ...SHAPE_FIELDS.map((field) => raw?.[field]),
    raw?.shape,
    raw?.type !== FLOW_TYPE ? raw?.type : null,
  ];
  for (const candidate of candidates) {
    const key = resolveShapeKey(candidate);
    if (key) return key;
  }
  const exotic = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return exotic ? exotic.trim() : FALLBACK_SHAPE;
};

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
  const meta = shapeMeta(resolveShapeKey(shape) || shape);
  const { data: dataOverrides = {}, ...rest } = overrides;
  const { style: styleOverrides = {}, image: imageOverride, ...otherData } = dataOverrides;
  // Igual que al normalizar: una imagen que no sea ráster embebido no entra.
  const image = normalizeDiagramImage(imageOverride);
  if (image) otherData.image = image;
  const node = {
    id: overrides.id || newId("n"),
    type: FLOW_TYPE,
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
    type: FLOW_TYPE,
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

/** Objeto plano o `null`: tolera campos que la API devuelva como JSON en texto. */
const asObject = (value) => {
  const parsed = typeof value === "string" ? parseMaybeJson(value) : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
};

const normalizeNode = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  // `data` puede venir como objeto o como JSON en texto según el backend.
  const data = asObject(raw.data) || {};
  const shape = resolveNodeShape(raw, data);
  const meta = shapeMeta(shape);
  // Las pantallas de mockup son nodos de pleno derecho del mismo lienzo.
  const isScreen = shape === SCREEN_SHAPE || raw.type === SCREEN_TYPE;
  const type = isScreen ? SCREEN_TYPE : FLOW_TYPE;
  const screen = isScreen ? screenSize(data.device) : null;
  const position = asObject(raw.position) || { x: raw.x, y: raw.y };
  const width = Math.max(44, toNumber(raw.width ?? raw.measured?.width ?? raw.style?.width, screen?.width ?? meta.w));
  const height = Math.max(28, toNumber(raw.height ?? raw.measured?.height ?? raw.style?.height, screen?.height ?? meta.h));
  const image = normalizeDiagramImage(data.image);
  const normalizedData = {
    // Mantener metadatos de nodos introducidos por versiones nuevas o
    // integraciones; reconstruir solo los campos que normalizamos aquí
    // provocaba que desaparecieran al guardar y volver a cargar.
    ...data,
    label: typeof data.label === "string" ? data.label : raw.label || meta.label,
    shape,
    locked: Boolean(data.locked),
    description: data.description || "",
    link: data.link || "",
    style: { ...DEFAULT_NODE_STYLE, fill: meta.fill, stroke: meta.stroke, ...(asObject(data.style) || {}) },
  };
  // Una imagen rechazada (SVG, `javascript:`, `blob:`, URL externa o demasiado
  // grande) NO puede sobrevivir a través del spread de metadatos: se quita.
  if (image) normalizedData.image = image;
  else delete normalizedData.image;
  if (isScreen) {
    // Elementos, dispositivo y fondo de la pantalla (ver `docs/API-MOCKUPS.md`).
    Object.assign(normalizedData, normalizeScreen(data));
    normalizedData.shape = SCREEN_SHAPE;
    normalizedData.label = typeof data.label === "string" && data.label ? data.label : deviceMeta(data.device).label;
  }
  return {
    id: String(raw.id || newId("n")),
    type,
    position: {
      x: toNumber(position?.x, 0),
      y: toNumber(position?.y, 0),
    },
    width,
    height,
    zIndex: raw.zIndex ?? (shape === "swimlane" ? -1 : undefined),
    parentId: raw.parentId || raw.parent_id || raw.parentNode || undefined,
    data: normalizedData,
  };
};

const normalizeEdge = (raw, nodeIds) => {
  if (!raw || typeof raw !== "object") return null;
  const source = String(raw.source ?? raw.from ?? "");
  const target = String(raw.target ?? raw.to ?? "");
  if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
  const data = asObject(raw.data) || {};
  return {
    id: String(raw.id || newId("e")),
    type: FLOW_TYPE,
    source,
    target,
    sourceHandle: raw.sourceHandle ?? raw.source_handle ?? raw.sourcePort ?? null,
    targetHandle: raw.targetHandle ?? raw.target_handle ?? raw.targetPort ?? null,
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

  const comments = normalizeComments(data.comments ?? source.comments);

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
      comments,
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
      // Comentarios de revisión del equipo (ver `docs/API-MOCKUPS.md` §6).
      comments: normalized.data.comments,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Integridad del contenido                                            */
/* ------------------------------------------------------------------ */

/**
 * Claves que `serializeDiagram` escribe SIEMPRE en cada nodo y conexión.
 *
 * Sirven como huella: si el registro que devuelve la API no las trae, es que
 * las descartó al guardar. Es lo que pasa con un `$request->validated()` de
 * Laravel validado campo por campo —desde Laravel 9 el validador poda toda
 * clave de un arreglo que no tenga su propia regla— y el síntoma visible es que
 * al reabrir el diagrama todos los nodos aparecen como «Proceso».
 */
export const NODE_STORED_KEYS = ["type", "position", "width", "height", "data"];
export const NODE_DATA_STORED_KEYS = ["label", "shape", "locked", "description", "link", "style"];
/** Escritas solo cuando tienen valor; se restauran pero no se reclaman. */
export const NODE_OPTIONAL_STORED_KEYS = ["zIndex", "parentId"];
export const EDGE_STORED_KEYS = ["type", "source", "target", "sourceHandle", "targetHandle", "data"];
export const EDGE_DATA_STORED_KEYS = Object.keys(DEFAULT_EDGE_STYLE);
export const CONTENT_STORED_KEYS = ["nodes", "edges", "settings"];

/** Nombres legibles de cada pérdida, en orden de importancia para el aviso. */
const LOSS_LABELS = [
  ["data.nodes[].data.shape", "el tipo de los nodos (data.shape)"],
  ["data.nodes[].data.style", "los colores y estilos (data.style)"],
  ["data.nodes[].data.image", "las imágenes incrustadas (data.image)"],
  ["data.nodes[].data.widgets", "los elementos de las pantallas (data.widgets)"],
  ["data.nodes[].data.device", "el dispositivo de las pantallas (data.device)"],
  ["data.edges[].data", "el estilo y las etiquetas de las conexiones (edges[].data)"],
  ["data.edges[].sourceHandle", "los lados de conexión de las flechas (sourceHandle/targetHandle)"],
  ["data.edges[].targetHandle", "los lados de conexión de las flechas (sourceHandle/targetHandle)"],
  ["data.nodes[].width", "el tamaño de los nodos (width/height)"],
  ["data.nodes[].height", "el tamaño de los nodos (width/height)"],
  ["data.nodes[].data.label", "los textos de los nodos (data.label)"],
  ["data.nodes[].data.locked", "los metadatos de los nodos (bloqueo, descripción, enlace)"],
  ["data.nodes[].data.description", "los metadatos de los nodos (bloqueo, descripción, enlace)"],
  ["data.nodes[].data.link", "los metadatos de los nodos (bloqueo, descripción, enlace)"],
  ["data.nodes[].data", "el contenido de los nodos (nodes[].data)"],
  ["data.nodes[].position", "la posición de los nodos (position)"],
  ["data.nodes", "la lista de nodos"],
  ["data.edges", "la lista de conexiones"],
  ["data.settings", "los ajustes del lienzo (settings)"],
];

/** Pérdidas reales pero irrelevantes para el usuario (siempre valen "flow"). */
const SILENT_LOSSES = ["data.nodes[].type", "data.edges[].type"];

/** Contenido de un registro tal como vino (sin normalizar), tolerante a JSON en texto. */
const diagramContent = (raw) => {
  const source = asObject(raw) || {};
  const data = asObject(source.data ?? source.content ?? source.payload) || {};
  return {
    data,
    nodes: Array.isArray(data.nodes) ? data.nodes : Array.isArray(source.nodes) ? source.nodes : null,
    edges: Array.isArray(data.edges) ? data.edges : Array.isArray(source.edges) ? source.edges : null,
    settings: data.settings ?? source.settings ?? null,
  };
};

/** Frase en español con lo que la API dejó fuera (lo más importante primero). */
export const describeDiagramLoss = (missing = []) => {
  const found = missing.filter((path) => !SILENT_LOSSES.includes(path));
  const labels = [];
  found.forEach((path) => {
    const index = LOSS_LABELS.findIndex(([key]) => key === path);
    const label = index >= 0 ? LOSS_LABELS[index][1] : path;
    if (!labels.some((item) => item.label === label)) labels.push({ index: index < 0 ? LOSS_LABELS.length : index, label });
  });
  if (!labels.length) return missing.length ? "contenido del diagrama" : "";
  labels.sort((a, b) => a.index - b.index);
  const shown = labels.slice(0, 4).map((item) => item.label);
  const rest = labels.length - shown.length;
  if (shown.length === 1) return shown[0];
  const joined = `${shown.slice(0, -1).join(", ")} y ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined}, entre otros ${rest} detalles del dibujo` : joined;
};

/**
 * Revisa un registro recibido de la API y dice si le falta contenido que el
 * panel siempre envía. `inspected: false` cuando la respuesta no trae dibujo
 * (un `PUT` 204 o una respuesta de solo metadatos no son una pérdida).
 */
export const inspectDiagramPayload = (received) => {
  const { nodes, edges, settings } = diagramContent(received);
  const empty = { ok: true, inspected: false, missing: [], summary: "", nodes: 0, edges: 0 };
  // Sin dibujo que revisar (PUT 204, respuesta de solo metadatos) no hay pérdida.
  if (nodes === null && edges === null && settings === null) return empty;
  const missing = [];
  const note = (path) => {
    if (!missing.includes(path)) missing.push(path);
  };
  let damagedNodes = 0;
  let damagedEdges = 0;

  (nodes || []).forEach((node) => {
    const item = asObject(node);
    const data = item ? asObject(item.data) : null;
    let damaged = false;
    NODE_STORED_KEYS.forEach((key) => {
      if (key === "data") {
        if (!data) {
          note("data.nodes[].data");
          damaged = true;
        }
        return;
      }
      if (!item || item[key] === undefined) {
        note(`data.nodes[].${key}`);
        damaged = true;
      }
    });
    if (data) {
      NODE_DATA_STORED_KEYS.forEach((key) => {
        if (data[key] === undefined) {
          note(`data.nodes[].data.${key}`);
          damaged = true;
        }
      });
      // Las pantallas de mockup pierden todo su contenido si la API poda `data`:
      // `widgets` y `device` no tienen regla propia en un validador anidado.
      const isScreen = item?.type === "screen" || data.shape === "screen";
      if (isScreen && data.widgets === undefined) {
        note("data.nodes[].data.widgets");
        damaged = true;
      }
      if (isScreen && data.device === undefined) {
        note("data.nodes[].data.device");
        damaged = true;
      }
    }
    if (damaged) damagedNodes += 1;
  });

  (edges || []).forEach((edge) => {
    const item = asObject(edge);
    const data = item ? asObject(item.data) : null;
    let damaged = false;
    EDGE_STORED_KEYS.forEach((key) => {
      if (key === "data") {
        if (!data) {
          note("data.edges[].data");
          damaged = true;
        }
        return;
      }
      if (!item || item[key] === undefined) {
        note(`data.edges[].${key}`);
        damaged = true;
      }
    });
    if (data) {
      EDGE_DATA_STORED_KEYS.forEach((key) => {
        if (data[key] === undefined) {
          note("data.edges[].data");
          damaged = true;
        }
      });
    }
    if (damaged) damagedEdges += 1;
  });

  if (nodes === null) note("data.nodes");
  if (edges === null) note("data.edges");
  if (settings === null) note("data.settings");

  return {
    ok: missing.length === 0,
    inspected: true,
    missing,
    summary: describeDiagramLoss(missing),
    nodes: damagedNodes,
    edges: damagedEdges,
  };
};

/**
 * Completa un registro podado con una copia de referencia (la última que este
 * navegador envió, o una lectura completa del mismo diagrama).
 *
 * Reglas estrictas para no inventar nada:
 *  - solo rellena claves AUSENTES; nunca pisa un valor que la API sí devolvió;
 *  - solo toca nodos y conexiones que existen en el registro recibido: nada de
 *    resucitar elementos borrados en otro equipo;
 *  - `style` e `image` se completan clave por clave.
 */
export const repairDiagramPayload = (received, reference) => {
  const target = diagramContent(received);
  const source = diagramContent(reference);
  const fields = new Set();
  let repairedNodes = 0;
  let repairedEdges = 0;

  const fill = (current, ref, path) => {
    const base = { ...(asObject(current) || {}) };
    const extra = asObject(ref) || {};
    let touched = false;
    Object.keys(extra).forEach((key) => {
      if (base[key] === undefined) {
        base[key] = extra[key];
        fields.add(`${path}.${key}`);
        touched = true;
      } else if (key === "style" || key === "image") {
        const nested = fill(base[key], extra[key], `${path}.${key}`);
        if (nested.touched) {
          base[key] = nested.value;
          touched = true;
        }
      }
    });
    return { value: base, touched };
  };

  const nodesById = new Map((source.nodes || []).map((node) => [String(asObject(node)?.id ?? ""), asObject(node)]));
  const edgesById = new Map();
  const edgesByPair = new Map();
  (source.edges || []).forEach((edge) => {
    const item = asObject(edge);
    if (!item) return;
    if (item.id !== undefined && item.id !== null) edgesById.set(String(item.id), item);
    const pair = `${item.source}>${item.target}`;
    if (!edgesByPair.has(pair)) edgesByPair.set(pair, item);
  });

  // Si la respuesta ni siquiera trae la lista, se recupera entera de la copia.
  if (target.nodes === null && source.nodes?.length) {
    fields.add("data.nodes");
    repairedNodes += source.nodes.length;
  }
  if (target.edges === null && source.edges?.length) {
    fields.add("data.edges");
    repairedEdges += source.edges.length;
  }

  const nodes = (target.nodes ?? source.nodes ?? []).map((node) => {
    const item = asObject(node);
    if (!item) return node;
    const ref = nodesById.get(String(item.id ?? ""));
    if (!ref) return node;
    const out = { ...item };
    let touched = false;
    [...NODE_STORED_KEYS, ...NODE_OPTIONAL_STORED_KEYS].forEach((key) => {
      if (key === "data" || out[key] !== undefined || ref[key] === undefined) return;
      out[key] = ref[key];
      fields.add(`data.nodes[].${key}`);
      touched = true;
    });
    const data = fill(out.data, ref.data, "data.nodes[].data");
    if (data.touched) touched = true;
    out.data = data.value;
    if (touched) repairedNodes += 1;
    return out;
  });

  const edges = (target.edges ?? source.edges ?? []).map((edge) => {
    const item = asObject(edge);
    if (!item) return edge;
    // Por id y, si el registro viene sin él (listados ligeros), por sus extremos.
    const ref = edgesById.get(String(item.id ?? "")) || edgesByPair.get(`${item.source}>${item.target}`);
    if (!ref) return edge;
    const out = { ...item };
    let touched = false;
    if (out.id === undefined && ref.id !== undefined) {
      out.id = ref.id;
      fields.add("data.edges[].id");
      touched = true;
    }
    EDGE_STORED_KEYS.forEach((key) => {
      if (key === "data" || out[key] !== undefined || ref[key] === undefined) return;
      out[key] = ref[key];
      fields.add(`data.edges[].${key}`);
      touched = true;
    });
    const data = fill(out.data, ref.data, "data.edges[].data");
    if (data.touched) touched = true;
    out.data = data.value;
    if (touched) repairedEdges += 1;
    return out;
  });

  const data = { ...target.data };
  data.nodes = nodes;
  data.edges = edges;
  if (data.version === undefined && source.data.version !== undefined) data.version = source.data.version;
  if (data.viewport === undefined && source.data.viewport !== undefined) {
    data.viewport = source.data.viewport;
    fields.add("data.viewport");
  }
  const settings = fill(data.settings, source.data.settings, "data.settings");
  data.settings = settings.value;

  return { data, fields: [...fields], nodes: repairedNodes, edges: repairedEdges, repaired: fields.size > 0 };
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
  const mockups = mockupStats(d.data.nodes, d.data.comments);
  return {
    nodes: d.data.nodes.length,
    edges: d.data.edges.length,
    decisions,
    screens: mockups.screens,
    widgets: mockups.widgets,
    comments: mockups.comments,
    openComments: mockups.openComments,
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


/* ------------------------- Plantillas de mockup ------------------------- */

/**
 * Las pantallas de mockup son nodos del mismo diagrama: las plantillas ya
 * traen las conexiones entre pantallas y desde botones concretos.
 */
const mockupScreen = (id, device, x, label, data = {}) =>
  makeScreenNode(device, { x, y: 80 }, { id, data: { label, ...data } });

export const MOCKUP_TEMPLATES = [
  {
    key: "mockup-app",
    label: "App móvil · 3 pantallas",
    description: "iPhone: inicio de sesión, feed y detalle, conectadas.",
    build: () => {
      const loginTitle = makeWidget("heading", { x: 24, y: 132 }, { text: "Bienvenido", style: { textColor: "#ffffff", fontSize: 30 }, w: 345 });
      const loginSub = makeWidget("text", { x: 24, y: 184 }, { text: "Inicia sesión para continuar.", style: { textColor: "#c7d2fe" }, w: 345 });
      const email = makeWidget("input", { x: 24, y: 252 }, { w: 345, props: { placeholder: "Correo electrónico" } });
      const password = makeWidget("input", { x: 24, y: 316 }, { w: 345, props: { placeholder: "Contraseña" } });
      const loginButton = makeWidget("button", { x: 24, y: 392 }, { w: 345, text: "Iniciar sesión" });
      const forgot = makeWidget("link", { x: 24, y: 456 }, { w: 200, text: "¿Olvidaste tu contraseña?", style: { textColor: "#e0e7ff" } });

      const feedBar = makeWidget("appbar", { x: 0, y: 0 }, { w: 393, text: "Inicio" });
      const feedSearch = makeWidget("search", { x: 20, y: 70 }, { w: 353 });
      const feedList = makeWidget("list", { x: 20, y: 132 }, {
        w: 353,
        h: 220,
        text: "Ana compartió un archivo\nNuevo comentario de Luis\nEntrega aprobada",
      });
      const feedCard = makeWidget("card", { x: 20, y: 368 }, { w: 353, h: 140, text: "Resumen semanal\n8 tareas cerradas y 3 pendientes." });
      const feedTab = makeWidget("tabbar", { x: 0, y: 776 }, { w: 393 });

      const detailBar = makeWidget("appbar", { x: 0, y: 0 }, { w: 393, text: "Detalle" });
      const detailImage = makeWidget("image", { x: 20, y: 76 }, { w: 353, h: 200 });
      const detailTitle = makeWidget("heading", { x: 20, y: 296 }, { w: 353, text: "Entrega aprobada", style: { fontSize: 24 } });
      const detailText = makeWidget("text", { x: 20, y: 340 }, { w: 353, h: 80, text: "El cliente aprobó la entrega del sprint 12. Puedes continuar con el despliegue." });
      const detailButton = makeWidget("button", { x: 20, y: 440 }, { w: 353, text: "Compartir" });

      const screens = [
        mockupScreen("scr-login", "iphone-15-pro", 80, "Inicio de sesión", {
          background: "linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)",
          start: true,
          widgets: [loginTitle, loginSub, email, password, loginButton, forgot],
        }),
        mockupScreen("scr-feed", "iphone-15-pro", 620, "Feed", {
          widgets: [feedBar, feedSearch, feedList, feedCard, feedTab],
        }),
        mockupScreen("scr-detail", "iphone-15-pro", 1160, "Detalle", {
          widgets: [detailBar, detailImage, detailTitle, detailText, detailButton],
        }),
      ];

      return {
        nodes: screens,
        edges: [
          makeEdge("scr-login", "scr-feed", { sourceHandle: `w:${loginButton.id}`, targetHandle: "left", data: { label: "Iniciar sesión" } }),
          makeEdge("scr-feed", "scr-detail", { sourceHandle: `w:${feedList.id}`, targetHandle: "left", data: { label: "Abrir" } }),
          makeEdge("scr-detail", "scr-feed", { sourceHandle: "left", targetHandle: "right", data: { label: "Volver", kind: "step", color: "#94a3b8" } }),
        ],
      };
    },
  },
  {
    key: "mockup-web",
    label: "Web · landing y panel",
    description: "Escritorio: landing y panel conectados.",
    build: () => {
      const nav = makeWidget("appbar", { x: 0, y: 0 }, { w: 1440, h: 64, text: "Appsline" });
      const hero = makeWidget("heading", { x: 96, y: 180 }, { w: 620, h: 120, text: "Diseña, valida y entrega.", style: { fontSize: 46, fontWeight: 800 } });
      const sub = makeWidget("text", { x: 96, y: 316 }, { w: 520, h: 60, text: "Mockups conectados al flujo real de tu proyecto." });
      const cta = makeWidget("button", { x: 96, y: 400 }, { w: 220, text: "Comenzar" });
      const heroImage = makeWidget("image", { x: 760, y: 140 }, { w: 580, h: 400 });

      const panelNav = makeWidget("appbar", { x: 0, y: 0 }, { w: 1440, h: 64, text: "Panel" });
      const panelChart = makeWidget("chart", { x: 64, y: 120 }, { w: 560, h: 300 });
      const panelTable = makeWidget("table", { x: 672, y: 120 }, { w: 700, h: 220 });
      const panelList = makeWidget("list", { x: 672, y: 380 }, { w: 700, h: 200, text: "Proyecto Atlas\nProyecto Nube\nProyecto Faro" });

      return {
        nodes: [
          mockupScreen("scr-landing", "desktop", 80, "Landing", { start: true, widgets: [nav, hero, sub, cta, heroImage] }),
          mockupScreen("scr-panel", "desktop", 1680, "Panel", { widgets: [panelNav, panelChart, panelTable, panelList] }),
        ],
        edges: [
          makeEdge("scr-landing", "scr-panel", { sourceHandle: `w:${cta.id}`, targetHandle: "left", data: { label: "Comenzar" } }),
          makeEdge("scr-panel", "scr-landing", { sourceHandle: "top", targetHandle: "bottom", data: { label: "Salir", kind: "step", color: "#94a3b8" } }),
        ],
      };
    },
  },
];

TEMPLATES.push(...MOCKUP_TEMPLATES);

export const templateMeta = (key) => TEMPLATES.find((t) => t.key === key) || TEMPLATES[0];
