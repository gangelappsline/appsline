/* eslint-disable react/prop-types */
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { FiLock, FiMessageSquare, FiPlay } from "react-icons/fi";
import WidgetBody, { BrowserBar, DeviceChrome } from "./MockupWidget";
import { deviceMeta, screenInsets, widgetHandleId } from "../../../utils/mockups";

/**
 * Contexto que comunica las pantallas con el editor sin ensuciar `node.data`:
 * qué elemento está activo, cómo se escribe su texto y cómo se mueve/redimensiona.
 */
export const MockupContext = createContext({
  activeWidget: null,
  selectWidget: () => {},
  patchWidgetBox: () => {},
  patchWidgetText: () => {},
  openComment: () => {},
  comments: [],
  playFrom: () => {},
  readOnly: false,
});

const HANDLES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

const HANDLE_STYLE = {
  top: { left: "50%", top: 0, transform: "translate(-50%,-50%)" },
  right: { left: "100%", top: "50%", transform: "translate(-50%,-50%)" },
  bottom: { left: "50%", top: "100%", transform: "translate(-50%,-50%)" },
  left: { left: 0, top: "50%", transform: "translate(-50%,-50%)" },
};

const snapTo = (value, grid) => (grid > 1 ? Math.round(value / grid) * grid : Math.round(value));

/** ¿El fondo es oscuro? Decide el color de la barra de estado y del texto guía. */
const isDark = (background) => {
  const value = String(background || "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split("").map((c) => c + c).join("");
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 140;
  }
  return /#0b1220|#0f172a|#1d4ed8|#4c1d95|#7c3aed|#0060fc|#334155|#111827/i.test(value);
};

const EDITABLE_TYPES = new Set([
  "heading", "text", "link", "badge", "button", "button-secondary", "card",
  "list", "table", "chart", "appbar", "tabbar", "select", "modal", "input",
  "textarea", "checkbox", "radio", "toggle", "browser-bar", "search",
]);

const MockupNode = ({ id, data, selected, width, height, dragging }) => {
  const { getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const {
    activeWidget,
    selectWidget,
    patchWidgetBox,
    patchWidgetText,
    openComment,
    comments = [],
    playFrom,
    readOnly = false,
  } = useContext(MockupContext);

  const deviceInfo = deviceMeta(data.device);
  const w = width || deviceInfo.width;
  const h = height || deviceInfo.height;
  const bezel = deviceInfo.bezel || 0;
  const inset = screenInsets(deviceInfo);
  const innerRadius = Math.max(0, (deviceInfo.radius || 0) - bezel);
  const widgets = useMemo(() => data.widgets || [], [data.widgets]);
  const locked = Boolean(data.locked) || readOnly;
  const activeId = activeWidget?.nodeId === id ? activeWidget.widgetId : null;
  const activeWidgetData = widgets.find((widget) => widget.id === activeId) || null;

  const [draft, setDraft] = useState(null);
  const draftRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const dragRef = useRef(null);
  const surfaceRef = useRef(null);
  const textRef = useRef(null);

  const nodeComments = comments.filter((comment) => comment.node_id === id);

  useEffect(() => {
    // React Flow mide los conectores: hay que recalcular cuando cambia la
    // geometría de los elementos (un botón movido mueve su flecha).
    updateNodeInternals(id);
  }, [id, widgets, w, h, updateNodeInternals]);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      textRef.current.select();
    }
  }, [editing]);

  const dark = isDark(data.background);

  /* ------------------------- mover / redimensionar ------------------------- */

  const startInteraction = useCallback(
    (event, widget, mode) => {
      if (locked || event.button !== 0) return;
      // El zoom se lee del lienzo para que el arrastre siga al puntero a
      // cualquier nivel de acercamiento.
      const scale = Number(getZoom?.()) || 1;
      dragRef.current = {
        mode,
        id: widget.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
        scale,
      };
      const initial = { id: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h };
      draftRef.current = initial;
      setDraft(initial);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.stopPropagation();
    },
    [locked, getZoom],
  );

  const moveInteraction = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / (drag.scale || 1);
      const dy = (event.clientY - drag.startY) / (drag.scale || 1);
      if (drag.mode === "resize") {
        const resized = {
          id: drag.id,
          x: drag.origin.x,
          y: drag.origin.y,
          w: Math.max(4, snapTo(drag.origin.w + dx, 1)),
          h: Math.max(1, snapTo(drag.origin.h + dy, 1)),
        };
        draftRef.current = resized;
        setDraft(resized);
        return;
      }
      const alignCenter = event.altKey;
      let x = snapTo(drag.origin.x + dx, event.shiftKey ? 1 : 1);
      let y = snapTo(drag.origin.y + dy, event.shiftKey ? 1 : 1);
      if (event.shiftKey) {
        // Shift restringe al eje con más recorrido.
        if (Math.abs(dx) > Math.abs(dy)) y = drag.origin.y;
        else x = drag.origin.x;
      }
      if (alignCenter) {
        const size = surfaceRef.current?.getBoundingClientRect();
        const contentWidth = size ? size.width / (drag.scale || 1) : 0;
        if (Math.abs(x + (drag.origin.w || 0) / 2 - contentWidth / 2) < 8) {
          x = snapTo(contentWidth / 2 - (drag.origin.w || 0) / 2, 1);
        }
      }
      const moved = { id: drag.id, x, y, w: drag.origin.w, h: drag.origin.h };
      draftRef.current = moved;
      setDraft(moved);
    },
    [],
  );

  const endInteraction = useCallback(
    (event) => {
      const drag = dragRef.current;
      const current = draftRef.current;
      dragRef.current = null;
      draftRef.current = null;
      event?.currentTarget?.releasePointerCapture?.(drag?.pointerId);
      if (drag && current) {
        const box = { x: current.x, y: current.y, w: current.w, h: current.h };
        const changed =
          box.x !== drag.origin.x || box.y !== drag.origin.y || box.w !== drag.origin.w || box.h !== drag.origin.h;
        if (changed) patchWidgetBox(id, drag.id, box);
      }
      setDraft(null);
    },
    [id, patchWidgetBox],
  );

  /* ------------------------------ texto ------------------------------ */

  const commitEditing = () => {
    if (!editing) return;
    const widget = widgets.find((item) => item.id === editing.id);
    if (widget && editing.value !== widget.text) patchWidgetText(id, editing.id, editing.value);
    setEditing(null);
  };

  const displayWidget = (widget) => {
    if (editing?.id === widget.id) return { ...widget, text: editing.value };
    if (draft?.id === widget.id) return { ...widget, x: draft.x, y: draft.y, w: draft.w, h: draft.h };
    return widget;
  };

  // El área útil se mide desde el interior del marco: el `surface` ya está
  // dentro del bisel, así que aquí solo descuenta la barra del navegador.
  const innerWidth = Math.max(1, w - bezel * 2);
  const innerHeight = Math.max(1, h - bezel * 2);
  const browserBar = deviceInfo.browserBar ? 44 : 0;
  const contentBox = {
    position: "absolute",
    top: browserBar,
    left: 0,
    width: innerWidth,
    height: Math.max(1, innerHeight - browserBar),
    overflow: "hidden",
  };
  const safeTopGuide = (deviceInfo.safeArea?.top || 0) - inset.top;
  const safeBottomGuide = (deviceInfo.safeArea?.bottom || 0) - inset.bottom;

  return (
    <div
      className="group/screen relative"
      data-shape="screen"
      data-device={deviceInfo.key}
      style={{ width: w, height: h, opacity: data.style?.opacity ?? 1 }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={200}
        minHeight={280}
        keepAspectRatio={false}
        lineClassName="!border-brand-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-brand-500 !bg-white"
      />

      {/* Nombre de la pantalla, fuera del dispositivo */}
      <div
        data-export="hide"
        className="nodrag absolute left-0 flex items-center gap-1.5 text-[11px] font-semibold"
        style={{ top: -22, color: dark ? "#e2e8f0" : "#475569" }}
      >
        <span className="max-w-[220px] truncate">{data.label || "Pantalla"}</span>
        <span className="rounded bg-slate-900/80 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
          {deviceInfo.label}
        </span>
        {data.start && (
          <span className="flex items-center gap-0.5 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            <FiPlay /> Inicio
          </span>
        )}
      </div>

      {/* Marco del dispositivo */}
      <div
        data-export-clean={selected ? "true" : undefined}
        style={{
          width: w,
          height: h,
          borderRadius: deviceInfo.radius,
          padding: bezel,
          boxSizing: "border-box",
          background: deviceInfo.platform === "web" ? "#e2e8f0" : "#0b1220",
          boxShadow: selected
            ? "0 0 0 2px #0060fc, 0 22px 50px rgba(15,23,42,.25)"
            : "0 18px 40px rgba(15,23,42,.18)",
        }}
      >
        <div
          ref={surfaceRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: innerRadius,
            overflow: "hidden",
            background: data.background,
            display: "flex",
            flexDirection: "column",
          }}
          onPointerDown={() => {
            if (activeId) selectWidget(id, null);
          }}
        >
          {deviceInfo.browserBar && <BrowserBar text={data.url || "app.appsline.com.mx"} />}

          {data.backgroundImage?.src && (
            <img
              src={data.backgroundImage.src}
              alt=""
              draggable={false}
              style={{ position: "absolute", top: browserBar, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            />
          )}

          <div style={contentBox}>
            {/* Guías de área segura mientras la pantalla está seleccionada */}
            {selected && safeTopGuide > 0 && (
              <div data-export="hide" style={{ position: "absolute", left: 0, right: 0, top: safeTopGuide, borderTop: "1px dashed rgba(0,96,252,.45)", pointerEvents: "none" }} />
            )}
            {selected && safeBottomGuide > 0 && (
              <div data-export="hide" style={{ position: "absolute", left: 0, right: 0, bottom: safeBottomGuide, borderTop: "1px dashed rgba(0,96,252,.45)", pointerEvents: "none" }} />
            )}

            {widgets.length === 0 && (
              <div
                data-export="hide"
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
                style={{ color: dark ? "#e2e8f0" : "#94a3b8", fontSize: 12 }}
              >
                <FiPlay style={{ fontSize: 18, opacity: 0.5 }} />
                <span className="font-semibold">Pantalla vacía</span>
                <span className="max-w-[70%] text-[10px] leading-4 opacity-80">
                  Agrega imágenes, textos, botones o campos desde la paleta.
                </span>
              </div>
            )}

            {widgets.map((widget, index) => {
              const view = displayWidget(widget);
              const isActive = activeId === widget.id;
              const isEditing = editing?.id === widget.id;
              const commonStyle = {
                position: "absolute",
                left: view.x,
                top: view.y,
                width: view.w,
                height: view.h,
                zIndex: index + 1,
                transform: widget.style?.rotate ? `rotate(${widget.style.rotate}deg)` : undefined,
                opacity: widget.locked ? 0.85 : 1,
                outline: isActive ? "2px solid #0060fc" : "none",
                outlineOffset: isActive ? 1 : 0,
                cursor: locked || widget.locked ? "default" : "move",
                touchAction: "none",
                borderRadius: Math.min(8, widget.style?.radius || 0),
              };
              return (
                <div
                  key={widget.id}
                  data-widget-id={widget.id}
                  data-export-clean={isActive ? "true" : undefined}
                  className="nodrag nopan"
                  style={commonStyle}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    selectWidget(id, widget.id, event);
                    if (isEditing) return;
                    startInteraction(event, widget, "move");
                  }}
                  onPointerMove={moveInteraction}
                  onPointerUp={endInteraction}
                  onPointerCancel={endInteraction}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (locked || widget.locked || !EDITABLE_TYPES.has(widget.type)) return;
                    setEditing({ id: widget.id, value: widget.text || "" });
                  }}
                  title={widget.text || undefined}
                >
                  <WidgetBody widget={view} />

                  {isEditing && (
                    <textarea
                      ref={textRef}
                      value={editing.value}
                      onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                      onBlur={commitEditing}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Escape") setEditing(null);
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commitEditing();
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      data-export="hide"
                      className="nodrag nowheel absolute inset-0 h-full w-full resize-none rounded-[inherit] border-0 bg-white/95 p-1 text-slate-900 outline-none ring-2 ring-brand-500"
                      style={{
                        fontSize: widget.style?.fontSize || 14,
                        fontWeight: widget.style?.fontWeight || 500,
                        lineHeight: widget.style?.lineHeight || 1.35,
                      }}
                      aria-label="Editar texto del elemento"
                    />
                  )}

                  {isActive && !locked && !widget.locked && !isEditing && (
                    <span
                      data-export="hide"
                      className="nodrag absolute rounded-sm border-2 border-brand-500 bg-white"
                      style={{ width: 10, height: 10, right: -5, bottom: -5, cursor: "nwse-resize", zIndex: 5 }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        startInteraction(event, widget, "resize");
                      }}
                      onPointerMove={moveInteraction}
                      onPointerUp={endInteraction}
                      onPointerCancel={endInteraction}
                      title="Redimensionar"
                    />
                  )}

                  {/* Conector: una flecha puede salir de este botón/campo.
                      Se dibuja siempre para que una pantalla bloqueada conserve
                      los conectores de sus flechas. */}
                  <Handle
                    id={widgetHandleId(widget.id)}
                    type="source"
                    position={Position.Right}
                    isConnectable={!locked}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      border: "2px solid #0060fc",
                      background: "#ffffff",
                      opacity: selected || isActive ? 1 : 0,
                      pointerEvents: selected || isActive ? "all" : "none",
                      transition: "opacity .15s",
                      zIndex: 6,
                    }}
                    title="Conecta este elemento con otra pantalla"
                  />
                </div>
              );
            })}
          </div>

          <DeviceChrome device={deviceInfo} statusBar={data.statusBar !== false} />

          {/* Pines de comentarios del equipo */}
          {nodeComments.length > 0 && (
            <button
              type="button"
              data-export="hide"
              onClick={(event) => {
                event.stopPropagation();
                openComment(nodeComments[0].id);
              }}
              className="nodrag absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow"
              title={`${nodeComments.length} comentario(s) en esta pantalla`}
            >
              <FiMessageSquare /> {nodeComments.length}
            </button>
          )}
        </div>
      </div>

      {locked && (
        <span
          data-export="hide"
          title="Pantalla bloqueada"
          className="absolute -right-1.5 -top-8 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white shadow"
        >
          <FiLock />
        </span>
      )}

      {/* Conectores de la pantalla completa */}
      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          isConnectable={!locked}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: "2px solid #0060fc",
            background: "#ffffff",
            position: "absolute",
            ...HANDLE_STYLE[handle.id],
            opacity: selected || dragging ? 1 : 0,
            pointerEvents: locked ? "none" : "all",
            transition: "opacity .15s",
            zIndex: 7,
          }}
          title={`Conectar pantalla (${handle.id})`}
        />
      ))}

      {selected && !readOnly && (
        <button
          type="button"
          data-export="hide"
          onClick={(event) => {
            event.stopPropagation();
            playFrom(id);
          }}
          className="nodrag absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow hover:bg-slate-50"
          title="Probar el flujo desde esta pantalla"
        >
          <FiPlay /> Probar desde aquí
        </button>
      )}

      {activeWidgetData && activeId && (
        <span className="sr-only">{`Elemento activo: ${activeWidgetData.type}`}</span>
      )}
    </div>
  );
};

export default memo(MockupNode);
