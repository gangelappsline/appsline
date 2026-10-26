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
  FiAlertTriangle,
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
  FiSmartphone,
  FiMessageSquare,
  FiPlay,
  FiTrash2,
  FiUnlock,
  FiUpload,
  FiZap,
} from "react-icons/fi";
import FlowNode from "./FlowNode";
import FlowEdge, { EdgeEditingContext } from "./FlowEdge";
import MockupNode, { MockupContext } from "./MockupNode";
import MockupPalette, { SCREEN_MIME, WIDGET_MIME } from "./MockupPalette";
import ReviewPanel from "./ReviewPanel";
import PrototypePlayer from "./PrototypePlayer";
import { decorateEdge } from "./edgePaths";
import ShapePalette, { SHAPE_MIME } from "./ShapePalette";
import PropertiesPanel from "./PropertiesPanel";
import IntegrityNotice from "./IntegrityNotice";
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
import {
  SCREEN_SHAPE,
  deviceMeta,
  makeComment,
  makeScreenNode,
  makeWidget,
  newWidgetId,
  normalizeWidget,
  screenContentSize,
  screenInsets,
  widgetMeta,
} from "../../../utils/mockups";

const nodeTypes = { flow: FlowNode, screen: MockupNode };
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
  ["Arrastrar un elemento sobre una pantalla", "Colocarlo en ese punto"],
  ["Arrastrar desde el punto azul de un botón", "Conectar ese elemento con otra pantalla"],
  ["Doble clic en un elemento de la pantalla", "Editar su texto"],
  ["Supr con un elemento activo", "Quitar solo ese elemento"],
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
  integrity: loadedIntegrity = null,
  onBack,
  onAttach,
  contextLabel = "",
  currentUser = null,
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
  // Contenido que la API no conservó (ver `IntegrityNotice`); `null` si todo bien.
  const [integrity, setIntegrity] = useState(() => loadedIntegrity || initial.integrity || null);
  const [integrityHidden, setIntegrityHidden] = useState(false);
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
  const [paletteMode, setPaletteMode] = useState("shapes");
  const [activeWidget, setActiveWidget] = useState(null);
  const [comments, setComments] = useState(() => initial.data.comments || []);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [prototype, setPrototype] = useState({ open: false, startId: null });
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
        comments,
      },
    }),
    [initial, meta, nodes, edges, settings, comments, rf],
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
          const report = saved.integrity || null;
          setIntegrity(report);
          setIntegrityHidden(false);
          if (report) {
            // Sí se guardó, pero la API descartó contenido: avisar en vez de
            // celebrar y dejar el aviso visible hasta que se corrija.
            notify(report.message, "error");
            return true;
          }
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

  /* ---------------- Mockups: pantallas y elementos ---------------- */

  const selectWidget = useCallback((nodeId, widgetId) => {
    setActiveWidget(widgetId ? { nodeId, widgetId } : null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, []);

  const addScreen = useCallback(
    (deviceKey = "iphone-15-pro", flowPosition = null) => {
      const device = deviceMeta(deviceKey);
      const rect = wrapperRef.current?.getBoundingClientRect();
      const center = rf.screenToFlowPosition({
        x: (rect?.left || 0) + (rect?.width || 800) / 2,
        y: (rect?.top || 0) + (rect?.height || 600) / 2,
      });
      const preferred = snapPos(flowPosition || { x: center.x - device.width / 2, y: center.y - device.height / 2 });
      const node = withDraggable(makeScreenNode(device.key, preferred, { selected: true }));
      history.snapshot();
      setActiveWidget(null);
      setNodes((nds) => {
        const position = findFreeNodePosition(nds, { width: device.width, height: device.height }, preferred, {
          grid: settings.snap ? settings.gridSize : 1,
        });
        return nds.map((n) => ({ ...n, selected: false })).concat({ ...node, position, selected: true });
      });
      setEdges((eds) => eds.map((e) => decorateEdge({ ...e, selected: false })));
      notify(`Pantalla “${device.label}” agregada`);
    },
    [rf, snapPos, history, settings.snap, settings.gridSize, notify],
  );

  /** Pantalla bajo un punto del lienzo (para soltar elementos encima). */
  const screenAt = useCallback((point) => {
    const screens = stateRef.current.nodes.filter((n) => n.data?.shape === SCREEN_SHAPE);
    return [...screens].reverse().find((node) => {
      const size = { width: node.width || 393, height: node.height || 852 };
      return (
        point.x >= node.position.x && point.x <= node.position.x + size.width &&
        point.y >= node.position.y && point.y <= node.position.y + size.height
      );
    });
  }, []);

  const addWidget = useCallback(
    (type, { nodeId = null, point = null } = {}) => {
      const current = stateRef.current.nodes;
      let target = nodeId ? current.find((node) => node.id === nodeId) : null;
      if (!target && point) target = screenAt(point);
      if (!target) target = current.find((node) => node.selected && node.data?.shape === SCREEN_SHAPE);
      if (!target) target = current.find((node) => node.data?.shape === SCREEN_SHAPE);
      if (!target) {
        notify("Primero agrega o selecciona una pantalla para colocar elementos", "info");
        return null;
      }
      const inset = screenInsets(target.data.device);
      const meta = widgetMeta(type);
      const widgets = target.data.widgets || [];
      let position;
      if (point) {
        position = {
          x: point.x - target.position.x - inset.left - meta.w / 2,
          y: point.y - target.position.y - inset.top - meta.h / 2,
        };
      } else {
        const content = screenContentSize(target.data.device);
        const bottom = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 16);
        position = {
          x: Math.min(20, Math.max(0, content.width - meta.w - 8)),
          y: Math.min(bottom + 12, Math.max(8, content.height - meta.h - 16)),
        };
      }
      const widget = makeWidget(type, position);
      history.snapshot();
      setNodes((nds) =>
        nds.map((node) =>
          node.id === target.id
            ? { ...node, selected: true, data: { ...node.data, widgets: [...(node.data.widgets || []), widget] } }
            : { ...node, selected: false },
        ),
      );
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      setActiveWidget({ nodeId: target.id, widgetId: widget.id });
      return widget;
    },
    [history, notify, screenAt],
  );

  const updateWidgets = useCallback(
    (nodeId, updater, key) => {
      history.snapshot(key);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, widgets: updater(node.data.widgets || []) } } : node,
        ),
      );
    },
    [history],
  );

  const patchWidget = useCallback(
    (patch, key) => {
      if (!activeWidget) return;
      updateWidgets(
        activeWidget.nodeId,
        (widgets) =>
          widgets.map((widget) => {
            if (widget.id !== activeWidget.widgetId) return widget;
            return (
              normalizeWidget({
                ...widget,
                ...patch,
                style: patch.style ? { ...widget.style, ...patch.style } : widget.style,
                props: patch.props ? { ...widget.props, ...patch.props } : widget.props,
              }) || widget
            );
          }),
        key,
      );
    },
    [activeWidget, updateWidgets],
  );

  const patchWidgetBox = useCallback(
    (nodeId, widgetId, box, key = "widget-box") => {
      updateWidgets(
        nodeId,
        (widgets) => widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...box } : widget)),
        key,
      );
    },
    [updateWidgets],
  );

  const patchWidgetText = useCallback(
    (nodeId, widgetId, text) => {
      updateWidgets(
        nodeId,
        (widgets) => widgets.map((widget) => (widget.id === widgetId ? { ...widget, text } : widget)),
        `widget-text-${widgetId}`,
      );
    },
    [updateWidgets],
  );

  const deleteWidget = useCallback(
    (nodeId = activeWidget?.nodeId, widgetId = activeWidget?.widgetId) => {
      if (!nodeId || !widgetId) return;
      updateWidgets(nodeId, (widgets) => widgets.filter((widget) => widget.id !== widgetId));
      setActiveWidget(null);
    },
    [activeWidget, updateWidgets],
  );

  const duplicateWidget = useCallback(() => {
    if (!activeWidget) return;
    const screen = stateRef.current.nodes.find((node) => node.id === activeWidget.nodeId);
    const widget = screen?.data?.widgets?.find((item) => item.id === activeWidget.widgetId);
    if (!widget) return;
    const copy = makeWidget(widget.type, { x: widget.x + 16, y: widget.y + 16 }, { ...widget, id: newWidgetId() });
    updateWidgets(activeWidget.nodeId, (widgets) => [...widgets, copy]);
    setActiveWidget({ nodeId: activeWidget.nodeId, widgetId: copy.id });
  }, [activeWidget, updateWidgets]);

  const orderWidget = useCallback(
    (direction) => {
      if (!activeWidget) return;
      updateWidgets(activeWidget.nodeId, (widgets) => {
        const index = widgets.findIndex((widget) => widget.id === activeWidget.widgetId);
        if (index < 0) return widgets;
        const next = [...widgets];
        const [item] = next.splice(index, 1);
        if (direction === "front") next.push(item);
        else next.unshift(item);
        return next;
      });
    },
    [activeWidget, updateWidgets],
  );

  /** Datos de la pantalla seleccionada (`__width`/`__height` redimensionan el marco). */
  const patchScreenData = useCallback(
    (patch, key) => {
      const { __width, __height, ...rest } = patch;
      history.snapshot(key);
      setNodes((nds) =>
        nds.map((node) => {
          if (!node.selected || node.data?.shape !== SCREEN_SHAPE) return node;
          const next = { ...node, data: { ...node.data, ...rest } };
          if (Number.isFinite(__width)) next.width = Math.max(200, __width);
          if (Number.isFinite(__height)) next.height = Math.max(280, __height);
          // Al cambiar de dispositivo, el marco toma su tamaño si el anterior
          // no se había redimensionado a mano.
          if (rest.device) {
            const previous = deviceMeta(node.data.device);
            const following = deviceMeta(rest.device);
            const untouched =
              Math.abs((node.width || previous.width) - previous.width) < 2 &&
              Math.abs((node.height || previous.height) - previous.height) < 2;
            if (untouched) {
              next.width = following.width;
              next.height = following.height;
            }
          }
          return next;
        }),
      );
    },
    [history],
  );

  const replaceWidgetImage = useCallback(
    async (file) => {
      if (!file || !activeWidget || imageBusyRef.current) return;
      imageBusyRef.current = true;
      setUploading(true);
      try {
        const image = await readDiagramImage(file);
        patchWidget({ props: { image } }, "widget-image");
      } catch (error) {
        notify(error.message, "error");
      } finally {
        imageBusyRef.current = false;
        setUploading(false);
      }
    },
    [activeWidget, patchWidget, notify],
  );

  /* ---------------- Revisión del equipo ---------------- */

  const addComment = useCallback(
    ({ text, nodeId = null, widgetId = null }) => {
      const comment = makeComment({ text, author: currentUser, nodeId, widgetId });
      setComments((list) => [...list, comment]);
    },
    [currentUser],
  );

  const toggleComment = useCallback((id) => {
    setComments((list) => list.map((comment) => (comment.id === id ? { ...comment, resolved: !comment.resolved } : comment)));
  }, []);

  const deleteComment = useCallback((id) => {
    setComments((list) => list.filter((comment) => comment.id !== id));
  }, []);

  const clearResolvedComments = useCallback(() => {
    setComments((list) => list.filter((comment) => !comment.resolved));
  }, []);

  const focusComment = useCallback(
    (comment) => {
      if (comment.widget_id) selectWidget(comment.node_id, comment.widget_id);
      const node = stateRef.current.nodes.find((item) => item.id === comment.node_id);
      if (node) {
        rf.setCenter(node.position.x + (node.width || 393) / 2, node.position.y + (node.height || 852) / 2, {
          zoom: 0.7,
          duration: 400,
        });
      }
    },
    [rf, selectWidget],
  );

  const screenNodes = useMemo(
    () => nodes.filter((node) => node.data?.shape === SCREEN_SHAPE || node.type === "screen"),
    [nodes],
  );

  const activeScreen = useMemo(
    () =>
      nodes.find((node) => node.id === activeWidget?.nodeId) ||
      nodes.find((node) => node.selected && (node.type === "screen" || node.data?.shape === SCREEN_SHAPE)) ||
      null,
    [nodes, activeWidget],
  );
  const activeWidgetData = useMemo(
    () => activeScreen?.data?.widgets?.find((widget) => widget.id === activeWidget?.widgetId) || null,
    [activeScreen, activeWidget],
  );

  const openPrototype = useCallback((startId = null) => setPrototype({ open: true, startId }), []);

  const mockupContext = useMemo(
    () => ({
      activeWidget,
      selectWidget,
      patchWidgetBox,
      patchWidgetText,
      openComment: () => setReviewOpen(true),
      comments,
      playFrom: (nodeId) => openPrototype(nodeId),
    }),
    [activeWidget, selectWidget, patchWidgetBox, patchWidgetText, comments, openPrototype],
  );

  // Si la pantalla del elemento activo desaparece, se limpia la selección.
  useEffect(() => {
    if (!activeWidget) return;
    if (!nodes.some((node) => node.id === activeWidget.nodeId)) setActiveWidget(null);
  }, [activeWidget, nodes]);

  const onDragOver = useCallback((e) => {
    if (
      e.dataTransfer.types.includes(SHAPE_MIME) ||
      e.dataTransfer.types.includes(SCREEN_MIME) ||
      e.dataTransfer.types.includes(WIDGET_MIME) ||
      e.dataTransfer.types.includes("Files")
    ) {
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
      const screenKey = e.dataTransfer.getData(SCREEN_MIME);
      if (screenKey) {
        const device = deviceMeta(screenKey);
        addScreen(device.key, { x: p.x - device.width / 2, y: p.y - 40 });
        return;
      }
      const widgetKey = e.dataTransfer.getData(WIDGET_MIME);
      if (widgetKey) {
        addWidget(widgetKey, { point: p });
        return;
      }
      const shapeKey = e.dataTransfer.getData(SHAPE_MIME);
      if (!SHAPES.some((shape) => shape.key === shapeKey)) return;
      const shape = shapeMeta(shapeKey);
      addShape(shapeKey, { x: p.x - shape.w / 2, y: p.y - shape.h / 2 });
    },
    [rf, addShape, addImages, addScreen, addWidget],
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
        setComments(parsed.data.comments || []);
        setActiveWidget(null);
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
      // Con un elemento de pantalla activo, Supr borra ese elemento (no la pantalla).
      if (activeWidget && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteWidget();
        return;
      }
      if (activeWidget && e.key === "Escape") {
        setActiveWidget(null);
        return;
      }
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
  }, [undo, redo, copySelected, paste, duplicateSelected, selectAll, activeWidget, deleteWidget]);

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
        ...(screenAt(at())
          ? [{
              label: "Insertar elemento en la pantalla",
              hint: "Texto, botón, campo…",
              icon: FiSmartphone,
              onClick: () => addWidget("text", { point: at() }),
            }]
          : [{
              label: "Insertar pantalla (iPhone)",
              hint: "Mockup",
              icon: FiSmartphone,
              onClick: () => {
                const p = at();
                const device = deviceMeta("iphone-15-pro");
                addScreen(device.key, { x: p.x - device.width / 2, y: p.y - 40 });
              },
            }]),
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
  }, [contextMenu, rf, addShape, addWidget, addScreen, screenAt, paste, selectAll, reverseSelectedEdges, selectedNodes, duplicateSelected, copySelected, toggleLock, zOrder, patchSelectedStyle, deleteSelected]);

  /* ---------------- Render ---------------- */
  const stats = {
    nodes: nodes.length,
    edges: edges.length,
    screens: screenNodes.length,
    widgets: screenNodes.reduce((sum, node) => sum + (node.data.widgets?.length || 0), 0),
    comments: comments.length,
    openComments: comments.filter((comment) => !comment.resolved).length,
  };
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
      <MockupContext.Provider value={mockupContext}>
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
            <ToolButton
              title={paletteOpen && paletteMode === "shapes" ? "Ocultar formas" : "Mostrar formas"}
              active={paletteOpen && paletteMode === "shapes"}
              onClick={() => {
                if (paletteOpen && paletteMode === "shapes") setPaletteOpen(false);
                else {
                  setPaletteMode("shapes");
                  setPaletteOpen(true);
                }
                if (window.innerWidth < 1024) setPropsOpen(false);
              }}
            >
              <FiSidebar />
            </ToolButton>
            <ToolButton
              title="Pantallas y mockups"
              active={paletteOpen && paletteMode === "mockups"}
              onClick={() => {
                if (paletteOpen && paletteMode === "mockups") setPaletteOpen(false);
                else {
                  setPaletteMode("mockups");
                  setPaletteOpen(true);
                }
                if (window.innerWidth < 1024) setPropsOpen(false);
              }}
            >
              <FiSmartphone /><span className="hidden text-xs font-semibold xl:inline">Pantallas</span>
            </ToolButton>
            <ToolButton
              title={reviewOpen ? "Ocultar comentarios" : `Comentarios del equipo${stats.openComments ? ` · ${stats.openComments} abiertos` : ""}`}
              active={reviewOpen}
              onClick={() => setReviewOpen((value) => !value)}
            >
              <span className="relative">
                <FiMessageSquare />
                {stats.openComments > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-amber-950">
                    {stats.openComments}
                  </span>
                )}
              </span>
            </ToolButton>
            <ToolButton title="Probar el flujo" onClick={() => openPrototype()} disabled={!stats.screens}>
              <FiPlay /><span className="hidden text-xs font-semibold xl:inline">Probar</span>
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

        {integrity && !integrityHidden && (
          <IntegrityNotice
            report={integrity}
            onExportJson={() => download("json")}
            onClose={() => setIntegrityHidden(true)}
          />
        )}

        {/* ---------- Cuerpo ---------- */}
        <div className="relative flex min-h-0 flex-1">
          {paletteOpen && (paletteMode === "mockups" ? (
            <MockupPalette
              onAddScreen={(deviceKey) => addScreen(deviceKey)}
              onAddWidget={(type) => addWidget(type, { nodeId: activeWidget?.nodeId || activeScreen?.id || null })}
              activeScreenLabel={activeScreen?.data?.label || ""}
              onClose={() => setPaletteOpen(false)}
            />
          ) : (
            <ShapePalette onAddShape={(key) => addShape(key)} onInsertTemplate={insertTemplate} onAddImages={addImages} onAddIcon={addIcon} uploading={uploading} onClose={() => setPaletteOpen(false)} />
          ))}

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
              onPaneClick={() => {
                setContextMenu(null);
                setActiveWidget(null);
              }}
              onNodeClick={(_, node) => {
                if (activeWidget && activeWidget.nodeId !== node.id) setActiveWidget(null);
              }}
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
              deleteKeyCode={activeWidget ? null : ["Backspace", "Delete"]}
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
                      Arrastra una forma o una pantalla desde la paleta, haz doble clic aquí o inserta una plantilla para empezar.
                      Con «Pantallas» diseñas mockups de iPhone, Android o web y los conectas con flechas.
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
              mockup={{
                screen: activeScreen,
                widget: activeWidgetData,
                comments,
                onScreenData: patchScreenData,
                onPatchWidget: patchWidget,
                onDeleteWidget: () => deleteWidget(),
                onDuplicateWidget: duplicateWidget,
                onOrderWidget: orderWidget,
                onReplaceWidgetImage: replaceWidgetImage,
                onAddWidget: (type) => addWidget(type, { nodeId: activeScreen?.id || null }),
                onPlay: () => openPrototype(activeScreen?.id || null),
                onComment: () => setReviewOpen(true),
              }}
            />
          )}
        </div>

        {/* ---------- Barra de estado ---------- */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
          <span>
            {stats.nodes} nodos · {stats.edges} conexiones
            {stats.screens ? ` · ${stats.screens} pantallas · ${stats.widgets} elementos` : ""}
            {selectedNodes.length ? ` · ${selectedNodes.length} seleccionados` : ""}
          </span>
          <span className="flex items-center gap-1" title={storageMode === "local" ? "La API aún no tiene los endpoints de diagramas: se guarda en este navegador" : "Se guarda en la API"}>
            {storageMode === "local" ? <FiHardDrive /> : <FiCloud />}
            {storageMode === "local" ? "Guardado en este navegador" : "Guardado en la API"}
          </span>
          <span role="status" title={saveError || integrity?.detail || undefined} className={cx("flex items-center gap-1", saveError || integrity ? "text-red-600" : dirty || !initial.id ? "text-amber-600" : "text-emerald-600")}>
            {isSaving ? "Guardando…" : saveError ? "Error al guardar · autoguardado pausado" : integrity ? <><FiAlertTriangle /> Guardado incompleto en la API</> : dirty ? "Cambios sin guardar" : !initial.id ? "Diagrama sin guardar" : <><FiCheck /> Todo guardado{savedAt ? ` · ${new Date(savedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
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

      {reviewOpen && (
        <ReviewPanel
          comments={comments}
          screens={screenNodes}
          currentUser={currentUser}
          selection={{ nodeId: activeWidget?.nodeId || activeScreen?.id || null, widget: activeWidget?.widgetId || null }}
          onAdd={addComment}
          onResolve={toggleComment}
          onDelete={deleteComment}
          onClearResolved={clearResolvedComments}
          onFocus={focusComment}
          onClose={() => setReviewOpen(false)}
        />
      )}

      <PrototypePlayer
        open={prototype.open}
        startId={prototype.startId}
        nodes={nodes}
        edges={edges}
        onClose={() => setPrototype({ open: false, startId: null })}
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Vaciar el lienzo"
        message="Se quitarán todos los nodos y conexiones del diagrama. Puedes deshacerlo con Ctrl+Z mientras no cierres el editor."
      />
      </MockupContext.Provider>
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
 * @param {object|null} [integrity] Informe de `inspectDiagramPayload` cuando la
 *   API devolvió el diagrama sin contenido (ver `IntegrityNotice`).
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
