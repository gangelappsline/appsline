/* eslint-disable react/prop-types */
import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { FiImage, FiLock } from "react-icons/fi";
import ShapeSvg from "./ShapeSvg";
import { nodeIcon } from "./icons";
import { shapeMeta } from "../../../utils/diagrams";
import { nodeAnchors } from "../../../utils/diagramGeometry";

/** Los cuatro puntos de conexión; cada uno acepta entradas y salidas (modo "loose"). */
const HANDLES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

const ALIGN = { left: "flex-start", center: "center", right: "flex-end" };
const VALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" };

/** Relleno interno para que el texto no toque el borde de las formas inclinadas. */
const paddingFor = (shape, w, h) => {
  switch (shape) {
    case "decision":
      return `${h * 0.20}px ${w * 0.23}px`;
    case "io":
      return `8px ${Math.min(32, w * 0.2)}px`;
    case "preparation":
      return `8px ${Math.min(36, w * 0.2)}px`;
    case "database":
      return `${Math.min(22, h * 0.25)}px 12px 10px`;
    case "swimlane":
      return "8px 14px";
    case "icon":
      return "6px";
    case "document":
      return "8px 14px 24px";
    case "note":
      return "12px 14px 10px";
    case "connector":
      return "4px";
    default:
      return "8px 14px";
  }
};

/**
 * Nodo genérico del diagrama: forma SVG + texto editable + 4 conectores +
 * controles de tamaño. Toda la apariencia sale de `data.style`.
 */
const FlowNode = ({ id, data, selected, width, height, dragging }) => {
  const { updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label || "");
  const inputRef = useRef(null);

  const meta = shapeMeta(data.shape);
  const w = width || meta.w;
  const h = height || meta.h;
  const style = data.style || {};
  const Icon = nodeIcon(style.icon);
  const isText = data.shape === "text";
  const isLane = data.shape === "swimlane";
  const isImage = data.shape === "image";
  const isIcon = data.shape === "icon";
  const anchors = nodeAnchors(data.shape, w, h, style.strokeWidth ?? 2);
  const locked = Boolean(data.locked);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, w, h, data.shape, style.strokeWidth, updateNodeInternals]);

  useEffect(() => {
    if (!editing) setDraft(data.label || "");
  }, [data.label, editing]);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if ((draft || "") !== (data.label || "")) updateNodeData(id, { label: draft });
  };

  const cancel = () => {
    setDraft(data.label || "");
    setEditing(false);
  };

  const textStyle = {
    color: style.textColor,
    fontSize: `${style.fontSize || 14}px`,
    fontWeight: style.fontWeight || 600,
    fontStyle: style.fontStyle || "normal",
    textAlign: style.align || "center",
    lineHeight: 1.3,
  };

  return (
    <div
      className="group/node relative"
      data-shape={data.shape}
      title={data.description || undefined}
      style={{ width: w, height: h, opacity: style.opacity ?? 1 }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!locked) setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={isText ? 60 : 44}
        minHeight={isText ? 28 : 32}
        keepAspectRatio={data.shape === "connector" || isIcon || (isImage && data.image?.lockAspectRatio !== false)}
        lineClassName="!border-brand-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-brand-500 !bg-white"
      />

      {/* Forma */}
      <div className="pointer-events-none absolute inset-0">
        <ShapeSvg shape={data.shape} width={w} height={h} style={style} />
        {(isText || isIcon) && selected && (
          <div className="absolute inset-0 rounded-md border border-dashed border-brand-300" />
        )}
      </div>

      {isImage && (
        <div className="pointer-events-none absolute inset-1.5 overflow-hidden" style={{ borderRadius: Math.max(0, (style.radius || 0) - 3) }}>
          {data.image ? (
            <img src={data.image.src} alt={data.image.alt || data.image.name} draggable={false} className="h-full w-full" style={{ objectFit: data.image.fit || "contain" }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-xs text-slate-400"><FiImage className="text-3xl" /> Agrega una imagen</div>
          )}
        </div>
      )}

      {/* Contenido centrado dentro de la geometría de cada forma. */}
      {(!isImage || data.label || editing) && (
        <div className="absolute inset-0 flex" style={{
          padding: isImage ? "8px" : paddingFor(data.shape, w, h),
          alignItems: isImage ? "flex-end" : isLane ? "flex-start" : VALIGN[style.valign || "middle"],
          justifyContent: ALIGN[style.align || "center"],
        }}>
          {editing ? (
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
                if (e.key === "Escape") cancel();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag nowheel w-full resize-none bg-transparent outline-none"
              style={{ ...textStyle, height: isLane || isImage ? 28 : "100%" }}
              aria-label="Editar texto en el lienzo"
            />
          ) : (
            <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden" style={{
              ...textStyle,
              flexDirection: isIcon ? "column" : "row",
              justifyContent: ALIGN[style.align || "center"],
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              maxHeight: "100%",
              ...(isImage ? { background: "rgba(255,255,255,.9)", borderRadius: 4, padding: "2px 6px" } : {}),
            }}>
              {Icon && !isImage && <Icon className="shrink-0" aria-hidden="true" style={{ fontSize: `${style.iconSize || (isIcon ? Math.min(w, h) * 0.4 : (style.fontSize || 14) * 1.25)}px`, color: style.stroke }} />}
              {data.label && <span className={isLane ? "min-w-0 truncate" : "min-w-0"}>{data.label}</span>}
            </div>
          )}
        </div>
      )}

      {locked && (
        <span
          title="Nodo bloqueado"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white shadow"
        >
          <FiLock />
        </span>
      )}

      {/* Conectores: se ven al pasar el cursor o al seleccionar el nodo */}
      {!isText &&
        HANDLES.map((handle) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="source"
            position={handle.position}
            isConnectable={!locked}
            style={{ left: anchors[handle.id].x, top: anchors[handle.id].y, right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" }}
            className={[
              "flow-handle !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent transition-opacity",
              selected || dragging ? "!opacity-100" : "!opacity-0 group-hover/node:!opacity-100",
            ].join(" ")}
          />
        ))}
    </div>
  );
};

export default memo(FlowNode);
