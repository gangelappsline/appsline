/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./flowchart.css";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiCloud,
  FiCopy,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiDownload,
  FiGrid,
  FiHardDrive,
  FiHelpCircle,
  FiImage,
  FiLayout,
  FiLock,
  FiMaximize,
  FiMaximize2,
  FiMinimize2,
  FiMinus,
  FiPaperclip,
  FiPlus,
  FiSave,
  FiSidebar,
  FiSliders,
  FiTrash2,
  FiUnlock,
  FiUpload,
  FiZap,
} from "react-icons/fi";
import FlowNode from "./FlowNode";
import FlowEdge, { EdgeEditingContext } from "./FlowEdge";
import { decorateEdge } from "./edgePaths";
import ShapePalette, { SHAPE_MIME } from "./ShapePalette";
import PropertiesPanel from "./PropertiesPanel";
import useHistory from "./useHistory";
import {
  diagramToJsonBlob,
  downloadBlob,
  readDiagramFile,
  renderDiagramImage,
  safeFileName,
} from "./exportDiagram";
import useDisplayPreference from "../../../hooks/useDisplayPreference";
import { useToast } from "../Toasts";
import ConfirmDialog from "../ConfirmDialog";
import Modal from "../Modal";
import {
  COLOR_PRESETS,
  SHAPES,
  THEMES,
  alignNodes,
  autoLayout,
  diagramBounds,
  distributeNodes,
  makeEdge,
  makeNode,
  newId,
  normalizeDiagram,
  presetFor,
  serializeDiagram,
  shapeMeta,
  templateMeta,
} from "../../../utils/diagrams";
import { cx } from "../../../utils/format";
import { edgeRoutingOffsets, findFreeNodePosition, routeDiagramEdges } from "../../../utils/diagramGeometry";
import { DIAGRAM_IMAGE_ACCEPT, diagramImageSize, readDiagramImage } from "../../../utils/diagramMedia";
import { NODE_ICONS } from "./icons";

const nodeTypes = { flow: FlowNode };
const edgeTypes = { flow: FlowEdge };

const BG_VARIANT = {
  dots: BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
};

const SHORTCUTS = [
  ["Doble clic en el lienzo", "Crear un proceso"],
  ["Doble clic en una forma / conexión", "Editar su texto"],
  ["Arrastrar desde un punto azul", "Conectar con otra forma"],
  ["Shift + arrastrar", "Seleccionar varias formas"],
  ["Supr / Retroceso", "Eliminar selección"],
  ["Ctrl + Z / Ctrl + Y", "Deshacer / Rehacer"],
  ["Ctrl + C / Ctrl + V", "Copiar / Pegar"],
  ["Ctrl + D", "Duplicar"],
  ["Ctrl + A", "Seleccionar todo"],
  ["Ctrl + S", "Guardar"],
  ["Flechas", "Mover la selección"],
  ["Ctrl + rueda / pellizcar", "Zoom"],
  ["Espacio + arrastrar o botón central", "Desplazar el lienzo"],
  ["Esc", "Quitar selección / cerrar menús"],
];

const isTypingTarget = (target) => {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
};

const withDraggable = (node) => ({ ...node, draggable: !node.data?.locked, connectable: !node.data?.locked });

/** Firma estable del contenido para saber si hay cambios sin guardar. */
const signature = (diagram) => {
  const s = serializeDiagram(diagram);
  return JSON.stringify({ ...s, data: { ...s.data, viewport: null } });
};

/* ================================================================== */

const ToolButton = ({ title, onClick, active = false, disabled = false, children, className = "" }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active || undefined}
    onClick={onClick}
    disabled={disabled}
    className={cx(
      "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      className,
    )}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />;

/** Menú desplegable mínimo (sin dependencias). */
const Menu = ({ label, icon: Icon, items, align = "right" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <ToolButton title={label} onClick={() => setOpen((v) => !v)} active={open}>
        <Icon /> <span className="hidden xl:inline">{label}</span> <FiChevronDown className="text-xs" />
      </ToolButton>
      {open && (
        <div
          role="menu"
          className={cx(
            "absolute top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "-" ? (
              <div key={`sep-${i}`} className="my-1 border-t border-slate-100" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cx(
                  "flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
                  item.danger ? "text-red-600" : "text-slate-700",
                )}
              >
                {item.icon && <item.icon className="mt-0.5 shrink-0 text-slate-400" />}
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  {item.hint && <span className="block text-[11px] text-slate-400">{item.hint}</span>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};

/* ================================================================== */

const EditorInner = ({
  diagram,
  tasks = [],
  onSave,
  saving = false,
  storageMode = "api",
  onBack,
  onAttach,
  contextLabel = "",
}) => {
  const rf = useReactFlow();
  const { notify } = useToast();
  const wrapperRef = useRef(null);
  const shellRef = useRef(null);
  const importRef = useRef(null);
  const imageRef = useRef(null);
  const imageBusyRef = useRef(false);
  const [uploading, setUploading] = useState(false);

  const initial = useMemo(() => normalizeDiagram(diagram), [diagram]);
  const [nodes, setNodes] = useState(() => initial.data.nodes.map(withDraggable));
  const [edges, setEdges] = useState(() => initial.data.edges.map(decorateEdge));
  const [meta, setMeta] = useState({
    name: initial.name,
    description: initial.description,
    task_id: initial.task_id,
  });
  const [settings, setSettings] = useState(initial.data.settings);
  const [savedSignature, setSavedSignature] = useState(() => signature(initial));
  const [savedAt, setSavedAt] = useState(initial.updated_at);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveInFlight = useRef(null);
  const isSaving = saving || savePending;

  const [paletteOpen, setPaletteOpen] = useDisplayPreference("flow.palette", window.innerWidth >= 1024);
  const [propsOpen, setPropsOpen] = useDisplayPreference("flow.props", window.innerWidth >= 1024);
  const [autosave, setAutosave] = useDisplayPreference("flow.autosave", true);
  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const clipboard = useRef(null);

  const stateRef = useRef({ nodes, edges });
  stateRef.current = { nodes, edges };
  const history = useHistory(useCallback(() => stateRef.current, []));

  const buildDiagram = useCallback(
    (withViewport = false) => ({
      ...initial,
      ...meta,
      data: {
        version: 1,
        nodes,
        edges,
        viewport: withViewport ? rf.getViewport() : initial.data.viewport,
        settings,
      },
    }),
    [initial, meta, nodes, edges, settings, rf],
  );

  const dirty = useMemo(() => signature(buildDiagram()) !== savedSignature, [buildDiagram, savedSignature]);

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const selectedIds = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);

  /* ---------------- Guardado ---------------- */
  const saveRef = useRef(null);
  const handleSave = useCallback(
    (quiet = false) => {
      // El candado es síncrono: Ctrl+S y el temporizador no pueden crear dos POST.
      if (saveInFlight.current) return saveInFlight.current;
      if (!onSave || saving) return Promise.resolve(false);
      const payload = buildDiagram(true);
      setSavePending(true);
      setSaveError("");
      saveInFlight.current = (async () => {
        try {
          const saved = await onSave(payload);
          if (!saved) throw new Error("No se recibió confirmación del guardado.");
          // Solo lo enviado está guardado; no marcar cambios posteriores como persistidos.
          setSavedSignature(signature(payload));
          setSavedAt(saved.updated_at || new Date().toISOString());
          if (!quiet) notify("Diagrama guardado");
          return true;
        } catch (error) {
          const message = error?.response?.data?.message || error?.message || "No se pudo guardar el diagrama";
          setSaveError(message);
          notify(message, "error");
          return false;
        } finally {
          saveInFlight.current = null;
          setSavePending(false);
        }
      })();
      return saveInFlight.current;
    },
    [onSave, saving, buildDiagram, notify],
  );
  saveRef.current = handleSave;

  useEffect(() => {
    // Tras un error no reintentar en bucle, especialmente un POST sin ID confirmado.
    if (!autosave || !dirty || isSaving || saveError) return undefined;
    const timer = setTimeout(() => saveRef.current?.(true), 2500);
    return () => clearTimeout(timer);
  }, [autosave, dirty, isSaving, saveError, nodes, edges, meta, settings]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  /* ---------------- Cambios de React Flow ---------------- */
  const onNodesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "dimensions" && c.resizing)) history.snapshot("resize", 1500);
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [history],
  );
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds).map(decorateEdge)), []);

  const onConnect = useCallback(
    (connection) => {
      if (connection.source === connection.target) return;
      history.snapshot();
      setEdges((eds) =>
        addEdge(
          decorateEdge(
            makeEdge(connection.source, connection.target, {
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
              data: { kind: settings.edgeKind, animated: settings.animatedEdges },
            }),
          ),
          eds,
        ),
      );
    },
    [history, settings.edgeKind, settings.animatedEdges],
  );

  const onReconnect = useCallback(
    (oldEdge, connection) => {
      history.snapshot();
      setEdges((eds) => reconnectEdge(oldEdge, connection, eds).map(decorateEdge));
    },
    [history],
  );

  const onBeforeDelete = useCallback(
    async ({ nodes: toDelete }) => {
      if (toDelete.some((n) => n.data?.locked)) {
        notify("Hay elementos bloqueados en la selección; desbloquéalos para eliminarlos", "info");
        return false;
      }
      history.snapshot();
      return true;
    },
    [history, notify],
  );

  const onNodeDragStart = useCallback(() => history.snapshot("drag", 100), [history]);

  /* ---------------- Inserción ---------------- */
  const snapPos = useCallback(
    (p) => {
      if (!settings.snap) return p;
      const g = settings.gridSize || 20;
      return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
    },
    [settings.snap, settings.gridSize],
  );

  const addShape = useCallback(
    (shapeKey, flowPosition = null, overrides = {}) => {
      const shape = shapeMeta(shapeKey);
      const size = { width: overrides.width || shape.w, height: overrides.height || shape.h };
      const rect = wrapperRef.current?.getBoundingClientRect();
      const center = rf.screenToFlowPosition({
        x: (rect?.left || 0) + (rect?.width || 800) / 2,
        y: (rect?.top || 0) + (rect?.height || 600) / 2,
      });
      const position = snapPos(flowPosition || { x: center.x - size.width / 2, y: center.y - size.height / 2 });
      const node = withDraggable(makeNode(shapeKey, position, { ...overrides, selected: true }));
      history.snapshot(shapeKey === "image" ? "insert-images" : null);
      setNodes((nds) => {
        const next = { ...node, position: findFreeNodePosition(nds, size, position, { grid: settings.snap ? settings.gridSize : 1 }) };
        return nds.map((n) => ({ ...n, selected: false })).concat(next);
      });
      setEdges((eds) => eds.map((e) => decorateEdge({ ...e, selected: false })));
      return node;
    },
    [rf, snapPos, history, settings.snap, settings.gridSize],
  );

  const addIcon = useCallback((key) => {
    const icon = NODE_ICONS.find((item) => item.key === key);
    if (icon) addShape("icon", null, { data: { label: icon.label, style: { icon: key, iconSize: 40 } } });
  }, [addShape]);

  const addImages = useCallback(async (files, position = null) => {
    if (!files?.length || imageBusyRef.current) return;
    imageBusyRef.current = true;
    setUploading(true);
    try {
      for (const file of files.slice(0, 10)) {
        try {
          const image = await readDiagramImage(file);
          addShape("image", position, { ...diagramImageSize(image), data: { label: "", image } });
        } catch (error) {
          notify(`${file.name}: ${error.message}`, "error");
        }
      }
      if (files.length > 10) notify("Puedes agregar hasta 10 imágenes a la vez.", "info");
    } finally {
      imageBusyRef.current = false;
      setUploading(false);
    }
  }, [addShape, notify]);

  const replaceImage = useCallback(async (file) => {
    const node = selectedNodes[0];
    if (!file || !node || imageBusyRef.current) return;
    imageBusyRef.current = true;
    setUploading(true);
    try {
      const image = await readDiagramImage(file);
      history.snapshot();
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, image } } : n));
    } catch (error) {
      notify(error.message, "error");
    } finally {
      imageBusyRef.current = false;
      setUploading(false);
    }
  }, [selectedNodes, history, notify]);

  const onDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes(SHAPE_MIME) || e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (e.dataTransfer.files?.length) {
        addImages(Array.from(e.dataTransfer.files), p);
        return;
      }
      const shapeKey = e.dataTransfer.getData(SHAPE_MIME);
      if (!SHAPES.some((shape) => shape.key === shapeKey)) return;
      const shape = shapeMeta(shapeKey);
      addShape(shapeKey, { x: p.x - shape.w / 2, y: p.y - shape.h / 2 });
    },
    [rf, addShape, addImages],
  );

  const onPaneDoubleClick = useCallback(
    (e) => {
      if (!e.target?.classList?.contains("react-flow__pane")) return;
      const meta = shapeMeta("process");
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addShape("process", { x: p.x - meta.w / 2, y: p.y - meta.h / 2 });
    },
    [rf, addShape],
  );

  const insertTemplate = useCallback(
    (key) => {
      const tpl = templateMeta(key);
      const built = tpl.build();
      if (!built.nodes.length) return;
      history.snapshot();
      const prefix = newId("t");
      const map = new Map(built.nodes.map((n) => [n.id, `${prefix}-${n.id}`]));
      const existing = diagramBounds(stateRef.current.nodes, 0);
      const incoming = diagramBounds(built.nodes, 0);
      const dx = stateRef.current.nodes.length ? existing.x + existing.width + 120 - incoming.x : 0;
      const dy = stateRef.current.nodes.length ? existing.y - incoming.y : 0;
      const newNodes = built.nodes.map((n) =>
        withDraggable({ ...n, id: map.get(n.id), position: { x: n.position.x + dx, y: n.position.y + dy }, selected: true }),
      );
      const newEdges = routeDiagramEdges(built.nodes, built.edges).map((e) =>
        decorateEdge({ ...e, id: newId("e"), source: map.get(e.source), target: map.get(e.target) }),
      );
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(newNodes));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })).concat(newEdges));
      setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 50);
      notify(`Plantilla “${tpl.label}” insertada`);
    },
    [history, rf, notify],
  );

  /* ---------------- Edición de la selección ---------------- */
  const patchNodes = useCallback(
    (ids, fn, key) => {
      history.snapshot(key);
      setNodes((nds) => nds.map((n) => (ids.includes(n.id) ? withDraggable(fn(n)) : n)));
    },
    [history],
  );

  const patchSelectedData = useCallback(
    (patch, key) => patchNodes(selectedIds, (n) => ({ ...n, data: { ...n.data, ...patch } }), key),
    [patchNodes, selectedIds],
  );

  const patchSelectedStyle = useCallback(
    (patch, key) =>
      patchNodes(selectedIds, (n) => ({ ...n, data: { ...n.data, style: { ...n.data.style, ...patch } } }), key),
    [patchNodes, selectedIds],
  );

  const changeShape = useCallback(
    (shapeKey) =>
      patchNodes(selectedIds, (n) => {
        const prev = shapeMeta(n.data.shape);
        const next = shapeMeta(shapeKey);
        const style = { ...n.data.style };
        // Si el nodo conservaba los colores sugeridos de su forma, hereda los de la nueva.
        if (style.fill === prev.fill && style.stroke === prev.stroke) {
          style.fill = next.fill;
          style.stroke = next.stroke;
        }
        const sameSize = n.width === prev.w && n.height === prev.h;
        return {
          ...n,
          width: sameSize ? next.w : n.width,
          height: sameSize ? next.h : n.height,
          zIndex: next.key === "swimlane" ? -1 : n.zIndex === -1 ? undefined : n.zIndex,
          data: { ...n.data, shape: next.key, style },
        };
      }),
    [patchNodes, selectedIds],
  );

  const resizeSelected = useCallback(
    (size) =>
      patchNodes(
        selectedIds,
        (n) => {
          if (n.data.locked) return n;
          const next = { width: Math.max(44, size.width ?? n.width), height: Math.max(28, size.height ?? n.height) };
          if (n.data.shape === "image" && n.data.image?.lockAspectRatio !== false) {
            const ratio = n.width / n.height;
            if (size.width !== undefined) next.height = Math.max(28, Math.round(next.width / ratio));
            else next.width = Math.max(44, Math.round(next.height * ratio));
          }
          return { ...n, ...next };
        },
        "size",
      ),
    [patchNodes, selectedIds],
  );

  const moveSelected = useCallback(
    (pos) => patchNodes(selectedIds, (n) => n.data.locked ? n : ({ ...n, position: { ...n.position, ...pos } }), "move"),
    [patchNodes, selectedIds],
  );

  const zOrder = useCallback(
    (dir) => {
      const all = stateRef.current.nodes.map((n) => n.zIndex || 0);
      const z = dir === "front" ? Math.max(0, ...all) + 1 : Math.min(0, ...all) - 1;
      patchNodes(selectedIds, (n) => ({ ...n, zIndex: z }));
    },
    [patchNodes, selectedIds],
  );

  const toggleLock = useCallback(() => {
    const lock = !selectedNodes.every((n) => n.data.locked);
    patchNodes(selectedIds, (n) => ({ ...n, data: { ...n.data, locked: lock } }));
  }, [patchNodes, selectedIds, selectedNodes]);

  const deleteSelected = useCallback(() => {
    rf.deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [rf, selectedNodes, selectedEdges]);

  const cloneSelection = useCallback(
    (sourceNodes, sourceEdges, offset = 40) => {
      const map = new Map(sourceNodes.map((n) => [n.id, newId("n")]));
      const newNodes = sourceNodes.map((n) =>
        withDraggable({
          ...n,
          id: map.get(n.id),
          position: { x: n.position.x + offset, y: n.position.y + offset },
          selected: true,
          data: { ...n.data, locked: false },
        }),
      );
      const newEdges = sourceEdges
        .filter((e) => map.has(e.source) && map.has(e.target))
        .map((e) => decorateEdge({ ...e, id: newId("e"), source: map.get(e.source), target: map.get(e.target), selected: false }));
      history.snapshot();
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(newNodes));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })).concat(newEdges));
    },
    [history],
  );

  const duplicateSelected = useCallback(() => {
    if (!selectedNodes.length) return;
    const ids = new Set(selectedIds);
    cloneSelection(selectedNodes, edges.filter((e) => ids.has(e.source) && ids.has(e.target)));
  }, [selectedNodes, selectedIds, edges, cloneSelection]);

  const copySelected = useCallback(() => {
    if (!selectedNodes.length) return;
    const ids = new Set(selectedIds);
    clipboard.current = {
      nodes: selectedNodes,
      edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
    notify(`${selectedNodes.length} elemento${selectedNodes.length === 1 ? "" : "s"} copiado${selectedNodes.length === 1 ? "" : "s"}`);
  }, [selectedNodes, selectedIds, edges, notify]);

  const paste = useCallback(() => {
    if (!clipboard.current?.nodes?.length) return;
    cloneSelection(clipboard.current.nodes, clipboard.current.edges, 60);
  }, [cloneSelection]);

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
  }, []);

  const align = useCallback(
    (mode) => {
      history.snapshot();
      setNodes((nds) => alignNodes(nds, selectedIds, mode));
    },
    [history, selectedIds],
  );

  const distribute = useCallback(
    (axis) => {
      history.snapshot();
      setNodes((nds) => distributeNodes(nds, selectedIds, axis));
    },
    [history, selectedIds],
  );

  const patchSelectedEdges = useCallback(
    (patch, key) => {
      history.snapshot(key);
      setEdges((eds) => eds.map((e) => (e.selected ? decorateEdge({ ...e, data: { ...e.data, ...patch } }) : e)));
    },
    [history],
  );

  const reverseSelectedEdges = useCallback(() => {
    history.snapshot();
    setEdges((eds) =>
      eds.map((e) =>
        e.selected
          ? decorateEdge({ ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle })
          : e,
      ),
    );
  }, [history]);

  const applyTheme = useCallback(
    (key) => {
      const theme = THEMES.find((t) => t.key === key) || THEMES[0];
      history.snapshot();
      setNodes((nds) =>
        nds.map((n) => {
          const preset = presetFor(theme.map[n.data.shape] || "blue");
          const isText = n.data.shape === "text";
          const isIcon = n.data.shape === "icon";
          return {
            ...n,
            data: {
              ...n.data,
              style: {
                ...n.data.style,
                fill: isText || isIcon ? "transparent" : preset.fill,
                stroke: isText ? "transparent" : isIcon && theme.key === "dark" ? "#e2e8f0" : preset.stroke,
                textColor: isText && theme.key === "dark" ? "#f8fafc" : preset.text,
              },
            },
          };
        }),
      );
      setEdges((eds) =>
        eds.map((e) => decorateEdge({ ...e, data: { ...e.data, color: theme.edge, labelBg: theme.key === "dark" ? "#1e293b" : "#ffffff", labelColor: theme.key === "dark" ? "#e2e8f0" : "#334155" } })),
      );
      setSettings((s) => ({ ...s, theme: key, canvasColor: theme.canvas }));
    },
    [history],
  );

  const runLayout = useCallback(() => {
    history.snapshot();
    const current = stateRef.current;
    const arranged = autoLayout(current.nodes, current.edges, {
      direction: settings.direction,
      gapX: settings.nodeSpacing,
      gapY: settings.rankSpacing,
    });
    setNodes(arranged);
    setEdges(routeDiagramEdges(arranged, current.edges, { direction: settings.direction, reset: true }).map(decorateEdge));
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 300, maxZoom: 1.2 }), 50);
    notify("Nodos y flechas organizados. Puedes deshacer el cambio.");
  }, [history, rf, settings.direction, settings.nodeSpacing, settings.rankSpacing, notify]);

  const clearAll = useCallback(() => {
    history.snapshot();
    setNodes([]);
    setEdges([]);
    setConfirmClear(false);
  }, [history]);

  const undo = useCallback(() => {
    const prev = history.undo();
    if (!prev) return;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [history]);

  const redo = useCallback(() => {
    const next = history.redo();
    if (!next) return;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [history]);

  /* ---------------- Importar / exportar ---------------- */
  const exportImage = useCallback(
    async (format) => {
      if (!nodes.length) {
        notify("El diagrama está vacío", "info");
        return null;
      }
      setExporting(true);
      try {
        const blob = await renderDiagramImage(wrapperRef.current, nodes, {
          format,
          background: settings.canvasColor || "#ffffff",
        });
        return blob;
      } catch (error) {
        notify(error?.message || "No se pudo exportar la imagen", "error");
        return null;
      } finally {
        setExporting(false);
      }
    },
    [nodes, settings.canvasColor, notify],
  );

  const download = useCallback(
    async (format) => {
      const base = safeFileName(meta.name);
      if (format === "json") {
        downloadBlob(diagramToJsonBlob(buildDiagram(true)), `${base}.json`);
        return;
      }
      const blob = await exportImage(format);
      if (blob) downloadBlob(blob, `${base}.${format}`);
    },
    [meta.name, buildDiagram, exportImage],
  );

  const attach = useCallback(async () => {
    if (!onAttach) return;
    const blob = await exportImage("png");
    if (!blob) return;
    const base = safeFileName(meta.name);
    const json = diagramToJsonBlob(buildDiagram(true));
    try {
      await onAttach([
        new File([blob], `${base}.png`, { type: "image/png" }),
        new File([json], `${base}.flow.json`, { type: "application/json" }),
      ], meta.task_id);
      notify("Imagen y archivo del diagrama adjuntados");
    } catch {
      notify("No se pudieron adjuntar los archivos", "error");
    }
  }, [onAttach, exportImage, meta.name, meta.task_id, buildDiagram, notify]);

  const importJson = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const json = await readDiagramFile(file);
        const parsed = normalizeDiagram(json);
        if (!parsed.data.nodes.length) throw new Error("El archivo no contiene nodos");
        history.snapshot();
        setNodes(parsed.data.nodes.map(withDraggable));
        setEdges(parsed.data.edges.map(decorateEdge));
        setSettings((s) => ({ ...s, ...parsed.data.settings }));
        if (!meta.name || meta.name === "Nuevo diagrama") setMeta((m) => ({ ...m, name: parsed.name }));
        setTimeout(() => rf.fitView({ padding: 0.15 }), 50);
        notify(`Importado: ${parsed.data.nodes.length} nodos, ${parsed.data.edges.length} conexiones`);
      } catch (error) {
        notify(error?.message || "No se pudo importar el archivo", "error");
      }
    },
    [history, rf, meta.name, notify],
  );

  /* ---------------- Pantalla completa ---------------- */
  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ---------------- Atajos ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        saveRef.current?.();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((mod && k === "y") || (mod && e.shiftKey && k === "z")) {
        e.preventDefault();
        redo();
      } else if (mod && k === "c") {
        e.preventDefault();
        copySelected();
      } else if (mod && k === "v") {
        e.preventDefault();
        paste();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && k === "a") {
        e.preventDefault();
        selectAll();

      } else if (e.key === "Escape") {
        setContextMenu(null);
        setEditingEdgeId(null);
      } else if (k === "?" || (e.shiftKey && k === "/")) {
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, copySelected, paste, duplicateSelected, selectAll]);

  /* ---------------- Menú contextual ---------------- */
  const openContextMenu = useCallback((event, kind, target = null) => {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    setContextMenu({
      kind,
      target,
      x: event.clientX - (rect?.left || 0),
      y: event.clientY - (rect?.top || 0),
      flow: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      if (!node.selected) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      }
      openContextMenu(event, "node", node);
    },
    [openContextMenu],
  );

  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === edge.id })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      openContextMenu(event, "edge", edge);
    },
    [openContextMenu],
  );

  const onPaneContextMenu = useCallback((event) => openContextMenu(event, "pane"), [openContextMenu]);

  const contextItems = useMemo(() => {
    if (!contextMenu) return [];
    if (contextMenu.kind === "pane") {
      const at = () => {
        const p = rf.screenToFlowPosition(contextMenu.flow);
        return p;
      };
      return [
        ...SHAPES.slice(0, 5).map((s) => ({
          label: `Insertar ${s.label.toLowerCase()}`,
          icon: FiPlus,
          onClick: () => {
            const p = at();
            addShape(s.key, { x: p.x - s.w / 2, y: p.y - s.h / 2 });
          },
        })),
        "-",
        { label: "Pegar", icon: FiCopy, disabled: !clipboard.current, onClick: paste },
        { label: "Seleccionar todo", icon: FiMaximize, onClick: selectAll },
        { label: "Ajustar a la vista", icon: FiMaximize2, onClick: () => rf.fitView({ padding: 0.15, duration: 300 }) },
      ];
    }
    if (contextMenu.kind === "edge") {
      return [
        { label: "Editar etiqueta", icon: FiSliders, onClick: () => setEditingEdgeId(contextMenu.target.id) },
        { label: "Invertir dirección", icon: FiCornerUpLeft, onClick: reverseSelectedEdges },
        "-",
        { label: "Eliminar", icon: FiTrash2, danger: true, onClick: () => rf.deleteElements({ edges: [contextMenu.target] }) },
      ];
    }
    const locked = selectedNodes.every((n) => n.data.locked);
    return [
      { label: "Duplicar", hint: "Ctrl + D", icon: FiCopy, onClick: duplicateSelected },
      { label: "Copiar", hint: "Ctrl + C", icon: FiCopy, onClick: copySelected },
      { label: locked ? "Desbloquear" : "Bloquear posición", icon: locked ? FiUnlock : FiLock, onClick: toggleLock },
      "-",
      { label: "Traer al frente", icon: FiCornerUpRight, onClick: () => zOrder("front") },
      { label: "Enviar atrás", icon: FiCornerUpLeft, onClick: () => zOrder("back") },
      "-",
      ...COLOR_PRESETS.slice(0, 4).map((p) => ({
        label: `Color ${p.label.toLowerCase()}`,
        onClick: () => patchSelectedStyle({ fill: p.fill, stroke: p.stroke, textColor: p.text }),
      })),
      "-",
      { label: "Eliminar", hint: "Supr", icon: FiTrash2, danger: true, onClick: deleteSelected },
    ];
  }, [contextMenu, rf, addShape, paste, selectAll, reverseSelectedEdges, selectedNodes, duplicateSelected, copySelected, toggleLock, zOrder, patchSelectedStyle, deleteSelected]);

  /* ---------------- Render ---------------- */
  const stats = { nodes: nodes.length, edges: edges.length };
  const routingBounds = useMemo(() => diagramBounds(nodes.filter((node) => node.data.shape !== "swimlane"), 0), [nodes]);
  const routingOffsets = useMemo(() => edgeRoutingOffsets(edges), [edges]);
  const edgeCtx = useMemo(() => ({ editingId: editingEdgeId, setEditingId: setEditingEdgeId, routingBounds, routingOffsets }), [editingEdgeId, routingBounds, routingOffsets]);

  const exportItems = [
    { label: "Imagen PNG", hint: "Alta resolución, fondo del lienzo", icon: FiImage, onClick: () => download("png"), disabled: exporting },
    { label: "Vector SVG", hint: "Escalable, para documentos", icon: FiImage, onClick: () => download("svg"), disabled: exporting },
    { label: "Archivo JSON", hint: "Se puede volver a importar", icon: FiDownload, onClick: () => download("json") },
    "-",
    { label: "Importar JSON…", hint: "Reemplaza el contenido del lienzo", icon: FiUpload, onClick: () => importRef.current?.click() },
    ...(onAttach
      ? ["-", { label: "Adjuntar como archivo", hint: `PNG + JSON en ${meta.task_id ? "la tarea" : "el proyecto"}`, icon: FiPaperclip, onClick: attach, disabled: exporting }]
      : []),
  ];

  const moreItems = [
    { label: "Auto-acomodar", hint: `Capas ${settings.direction === "LR" ? "de izquierda a derecha" : "de arriba abajo"}`, icon: FiZap, onClick: runLayout, disabled: nodes.length < 2 },
    { label: "Ajustar a la vista", icon: FiMaximize2, onClick: () => rf.fitView({ padding: 0.15, duration: 300 }) },
    { label: "Zoom 100 %", icon: FiMaximize, onClick: () => rf.zoomTo(1, { duration: 200 }) },
    "-",
    { label: autosave ? "Desactivar autoguardado" : "Activar autoguardado", hint: "Guarda 2.5 s después del último cambio", icon: FiSave, onClick: () => setAutosave((v) => !v) },
    { label: "Atajos de teclado", hint: "?", icon: FiHelpCircle, onClick: () => setHelpOpen(true) },
    "-",
    { label: "Vaciar lienzo", icon: FiTrash2, danger: true, disabled: !nodes.length, onClick: () => setConfirmClear(true) },
  ];

  return (
    <EdgeEditingContext.Provider value={edgeCtx}>
      <div
        ref={shellRef}
        className={cx(
          "flowchart-editor flex h-full min-h-[560px] flex-col overflow-hidden bg-white text-slate-800",
          fullscreen ? "" : "rounded-2xl border border-slate-200 shadow-card",
        )}
      >
        {/* ---------- Barra superior ---------- */}
        <header className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
          {onBack && (
            <ToolButton title="Volver" onClick={onBack}>
              <FiArrowLeft />
            </ToolButton>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <input
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
              aria-label="Nombre del diagrama"
              placeholder="Nombre del diagrama"
              className="w-full min-w-0 rounded-lg border border-transparent px-2 py-1 text-sm font-bold text-slate-800 transition hover:border-slate-200 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10 sm:w-56"
            />
            {contextLabel && (
              <span className="hidden max-w-[220px] truncate text-xs text-slate-400 lg:inline" title={contextLabel}>
                {contextLabel}
              </span>
            )}
          </div>

          <Divider />
          <ToolButton title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!history.canUndo}>
            <FiCornerUpLeft />
          </ToolButton>
          <ToolButton title="Rehacer (Ctrl+Y)" onClick={redo} disabled={!history.canRedo}>
            <FiCornerUpRight />
          </ToolButton>
          <Divider />
          <ToolButton title="Alejar" onClick={() => rf.zoomOut({ duration: 150 })}>
            <FiMinus />
          </ToolButton>
          <button
            type="button"
            onClick={() => rf.fitView({ padding: 0.15, duration: 300 })}
            title="Ajustar a la vista"
            className="h-8 min-w-[52px] rounded-lg px-1 text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-100"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton title="Acercar" onClick={() => rf.zoomIn({ duration: 150 })}>
            <FiPlus />
          </ToolButton>
          <Divider />
          <ToolButton title="Ajustar a la cuadrícula" active={settings.snap} onClick={() => setSettings((s) => ({ ...s, snap: !s.snap }))}>
            <FiGrid />
          </ToolButton>
          <ToolButton title="Auto-acomodar" onClick={runLayout} disabled={nodes.length < 2}>
            <FiZap /><span className="hidden xl:inline text-xs font-semibold">Organizar</span>
          </ToolButton>
          <ToolButton title="Agregar imágenes" onClick={() => imageRef.current?.click()} disabled={uploading}><FiImage /></ToolButton>

          <div className="ml-auto flex items-center gap-1">
            <ToolButton title={paletteOpen ? "Ocultar formas" : "Mostrar formas"} active={paletteOpen} onClick={() => { setPaletteOpen((v) => !v); if (window.innerWidth < 1024) setPropsOpen(false); }}>
              <FiSidebar />
            </ToolButton>
            <ToolButton title={propsOpen ? "Ocultar propiedades" : "Mostrar propiedades"} active={propsOpen} onClick={() => { setPropsOpen((v) => !v); if (window.innerWidth < 1024) setPaletteOpen(false); }}>
              <FiSliders />
            </ToolButton>
            <ToolButton title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFullscreen} active={fullscreen}>
              {fullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            </ToolButton>
            <Menu label="Exportar" icon={FiDownload} items={exportItems} />
            <Menu label="Más" icon={FiLayout} items={moreItems} />
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving || (!dirty && Boolean(initial.id))}
              className="btn-primary !px-3 !py-1.5 text-sm"
            >
              {isSaving ? (
                <>
                  <FiCloud className="animate-pulse" /> Guardando…
                </>
              ) : dirty || !initial.id ? (
                <>
                  <FiSave /> Guardar
                </>
              ) : (
                <>
                  <FiCheck /> Guardado
                </>
              )}
            </button>
          </div>
        </header>

        {/* ---------- Cuerpo ---------- */}
        <div className="relative flex min-h-0 flex-1">
          {paletteOpen && <ShapePalette onAddShape={(key) => addShape(key)} onInsertTemplate={insertTemplate} onAddImages={addImages} onAddIcon={addIcon} uploading={uploading} onClose={() => setPaletteOpen(false)} />}

          <div
            ref={wrapperRef}
            className="relative min-w-0 flex-1"
            style={{ background: settings.canvasColor }}
            onDoubleClick={onPaneDoubleClick}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onBeforeDelete={onBeforeDelete}
              onNodeDragStart={onNodeDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onMove={(_, viewport) => setZoom(viewport.zoom)}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              onPaneClick={() => setContextMenu(null)}
              onEdgeDoubleClick={(_, edge) => setEditingEdgeId(edge.id)}
              defaultViewport={initial.data.viewport || { x: 40, y: 40, zoom: 1 }}
              fitView={!initial.data.viewport && nodes.length > 0}
              fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
              connectionMode={ConnectionMode.Loose}
              connectionLineType={settings.edgeKind}
              connectionLineStyle={{ stroke: "#0060fc", strokeWidth: 2 }}
              connectionRadius={36}
              snapToGrid={settings.snap}
              snapGrid={[settings.gridSize, settings.gridSize]}
              selectionMode={SelectionMode.Partial}
              selectionOnDrag={false}
              panOnDrag={[0, 1]}
              panActivationKeyCode="Space"
              selectionKeyCode="Shift"
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              deleteKeyCode={["Backspace", "Delete"]}
              zoomOnDoubleClick={false}
              edgesReconnectable
              elevateNodesOnSelect
              minZoom={0.1}
              maxZoom={4}
              proOptions={{ hideAttribution: true }}
              className="!bg-transparent"
            >
              {settings.background !== "none" && (
                <Background
                  variant={BG_VARIANT[settings.background] || BackgroundVariant.Dots}
                  gap={settings.gridSize}
                  size={settings.background === "dots" ? 1.5 : 1}
                  color={settings.theme === "dark" ? "#334155" : "#cbd5e1"}
                />
              )}
              {settings.controls && <Controls position="bottom-left" showInteractive={false} className="!rounded-xl !border !border-slate-200 !shadow-card" />}
              {settings.minimap && (
                <MiniMap
                  position="bottom-right"
                  style={{ width: 140, height: 96 }}
                  pannable
                  zoomable
                  nodeColor={(n) => n.data?.style?.fill || "#cbd5e1"}
                  nodeStrokeColor={(n) => n.data?.style?.stroke || "#94a3b8"}
                  maskColor="rgba(15, 23, 42, 0.08)"
                  className="!rounded-xl !border !border-slate-200 !shadow-card"
                />
              )}
              {nodes.length === 0 && (
                <Panel position="top-center" className="pointer-events-none mt-10">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-5 text-center shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold text-slate-700">El lienzo está vacío</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                      Arrastra una forma desde la paleta, haz doble clic aquí o inserta una plantilla para empezar.
                    </p>
                  </div>
                </Panel>
              )}
              {selectedNodes.length > 1 && (
                <Panel position="top-center" className="mt-2">
                  <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
                    <span className="px-2 text-[11px] font-semibold text-slate-500">{selectedNodes.length} seleccionados</span>
                    {[
                      ["left", "⇤", "Alinear a la izquierda"],
                      ["center", "↔", "Centrar horizontalmente"],
                      ["right", "⇥", "Alinear a la derecha"],
                      ["top", "⤒", "Alinear arriba"],
                      ["middle", "↕", "Centrar verticalmente"],
                      ["bottom", "⤓", "Alinear abajo"],
                    ].map(([mode, glyph, title]) => (
                      <ToolButton key={mode} title={title} onClick={() => align(mode)} className="!min-w-7 !px-1.5 text-xs">
                        {glyph}
                      </ToolButton>
                    ))}
                    <Divider />
                    <ToolButton title="Distribuir horizontalmente" onClick={() => distribute("horizontal")} disabled={selectedNodes.length < 3} className="!px-1.5 text-xs">H</ToolButton>
                    <ToolButton title="Distribuir verticalmente" onClick={() => distribute("vertical")} disabled={selectedNodes.length < 3} className="!px-1.5 text-xs">V</ToolButton>
                    <Divider />
                    <ToolButton title="Duplicar" onClick={duplicateSelected}><FiCopy /></ToolButton>
                    <ToolButton title="Eliminar" onClick={deleteSelected} className="hover:!bg-red-50 hover:!text-red-600"><FiTrash2 /></ToolButton>
                  </div>
                </Panel>
              )}
            </ReactFlow>

            {contextMenu && (
              <div
                role="menu"
                className="absolute z-40 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card-lg"
                style={{ left: Math.min(contextMenu.x, (wrapperRef.current?.clientWidth || 400) - 230), top: Math.min(contextMenu.y, (wrapperRef.current?.clientHeight || 400) - 320) }}
                onMouseLeave={() => setContextMenu(null)}
              >
                {contextItems.map((item, i) =>
                  item === "-" ? (
                    <div key={`sep-${i}`} className="my-1 border-t border-slate-100" />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        setContextMenu(null);
                        item.onClick();
                      }}
                      className={cx(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition hover:bg-slate-50 disabled:opacity-40",
                        item.danger ? "text-red-600" : "text-slate-700",
                      )}
                    >
                      {item.icon && <item.icon className="shrink-0 text-slate-400" />}
                      <span className="flex-1">{item.label}</span>
                      {item.hint && <span className="text-[10px] text-slate-400">{item.hint}</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {propsOpen && (
            <PropertiesPanel
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onClose={() => setPropsOpen(false)}
              node={{
                onPatchData: patchSelectedData,
                onPatchStyle: patchSelectedStyle,
                onResize: resizeSelected,
                onMove: moveSelected,
                onChangeShape: changeShape,
                onAlign: align,
                onDistribute: distribute,
                onDelete: deleteSelected,
                onDuplicate: duplicateSelected,
                onZOrder: zOrder,
                onToggleLock: toggleLock,
                onReplaceImage: replaceImage,
                uploading,
              }}
              edge={{
                onPatch: patchSelectedEdges,
                onReverse: reverseSelectedEdges,
                onDelete: deleteSelected,
              }}
              diagram={{
                meta,
                settings,
                tasks,
                stats,
                onMeta: (patch) => setMeta((m) => ({ ...m, ...patch })),
                onSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
                onApplyTheme: applyTheme,
                onLayout: runLayout,
              }}
            />
          )}
        </div>

        {/* ---------- Barra de estado ---------- */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
          <span>
            {stats.nodes} nodos · {stats.edges} conexiones
            {selectedNodes.length ? ` · ${selectedNodes.length} seleccionados` : ""}
          </span>
          <span className="flex items-center gap-1" title={storageMode === "local" ? "La API aún no tiene los endpoints de diagramas: se guarda en este navegador" : "Se guarda en la API"}>
            {storageMode === "local" ? <FiHardDrive /> : <FiCloud />}
            {storageMode === "local" ? "Guardado en este navegador" : "Guardado en la API"}
          </span>
          <span role="status" title={saveError || undefined} className={cx("flex items-center gap-1", saveError ? "text-red-600" : dirty || !initial.id ? "text-amber-600" : "text-emerald-600")}>
            {isSaving ? "Guardando…" : saveError ? "Error al guardar · autoguardado pausado" : dirty ? "Cambios sin guardar" : !initial.id ? "Diagrama sin guardar" : <><FiCheck /> Todo guardado{savedAt ? ` · ${new Date(savedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={Boolean(autosave)} onChange={(e) => setAutosave(e.target.checked)} className="accent-brand-600" />
            Autoguardado
          </label>
          <button type="button" onClick={() => setHelpOpen(true)} className="flex items-center gap-1 hover:text-brand-600">
            <FiHelpCircle /> Atajos
          </button>
        </footer>

        <input ref={imageRef} type="file" multiple accept={DIAGRAM_IMAGE_ACCEPT} aria-label="Agregar imágenes al lienzo" hidden onChange={(event) => { addImages(Array.from(event.target.files || [])); event.target.value = ""; }} />

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          aria-label="Importar diagrama JSON"
          hidden
          onChange={(e) => {
            importJson(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Atajos y gestos del editor" size="lg">
        <dl className="grid gap-2 sm:grid-cols-2">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">{what}</dt>
              <dd className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{keys}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Vaciar el lienzo"
        message="Se quitarán todos los nodos y conexiones del diagrama. Puedes deshacerlo con Ctrl+Z mientras no cierres el editor."
      />
    </EdgeEditingContext.Provider>
  );
};

/**
 * Editor de diagramas de flujo.
 *
 * @param {object} diagram Diagrama normalizado (ver `normalizeDiagram`).
 * @param {Array} tasks Tareas del proyecto para vincular el diagrama.
 * @param {(diagram) => Promise<object|null>} onSave Guarda y devuelve el diagrama con id.
 * @param {boolean} saving
 * @param {"api"|"local"} storageMode
 * @param {Function} [onBack]
 * @param {(files: File[]) => Promise<void>} [onAttach] Adjunta PNG + JSON al proyecto/tarea.
 * @param {string} [contextLabel] "Proyecto · Tarea" para el encabezado.
 */
const FlowchartEditor = (props) => (
  <ReactFlowProvider>
    <EditorInner {...props} />
  </ReactFlowProvider>
);

export default FlowchartEditor;
