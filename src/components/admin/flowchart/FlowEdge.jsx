/* eslint-disable react/prop-types */
import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
} from "@xyflow/react";
import { dashArray } from "../../../utils/diagramGeometry";
import { edgePath } from "./edgePaths";

/**
 * El editor comunica a las conexiones cuál se está editando (doble clic) sin
 * ensuciar `edge.data`.
 */
export const EdgeEditingContext = createContext({ editingId: null, setEditingId: () => {} });

const FlowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data = {},
  selected,
  markerEnd,
  markerStart,
}) => {
  const { setEdges } = useReactFlow();
  const { editingId, setEditingId, routingBounds, routingOffsets } = useContext(EdgeEditingContext);
  const editing = editingId === id;
  const [draft, setDraft] = useState(data.label || "");
  const inputRef = useRef(null);

  const [path, labelX, labelY] = edgePath(data.kind, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    bounds: routingBounds,
    routeOffset: routingOffsets?.[id],
  });

  useEffect(() => {
    if (editing) {
      setDraft(data.label || "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, data.label]);

  const commit = () => {
    setEditingId(null);
    if ((draft || "") !== (data.label || "")) {
      setEdges((edges) =>
        edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, label: draft } } : e)),
      );
    }
  };

  const width = Number(data.width || 2);
  const color = data.color || "#64748b";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={24}
        style={{
          stroke: selected ? "#0060fc" : color,
          strokeWidth: selected ? width + 1 : width,
          strokeDasharray: dashArray(data.dash, width),
          strokeLinecap: "round",
          strokeLinejoin: "round",
          opacity: data.opacity ?? 1,
        }}
      />
      {(data.label || editing) && (
        <EdgeLabelRenderer>
          <div
            data-flow-edge-label
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: 10,
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(id);
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                placeholder="Etiqueta"
                aria-label="Etiqueta de la conexión"
                className="rounded-md border border-brand-300 bg-white px-2 py-0.5 text-xs shadow outline-none ring-2 ring-brand-500/20"
                style={{ fontSize: `${data.fontSize || 12}px`, minWidth: 60 }}
              />
            ) : (
              <span
                className={[
                  "inline-block max-w-[220px] cursor-text rounded-md px-1.5 py-0.5 text-center font-semibold leading-tight shadow-sm",
                  selected ? "ring-2 ring-brand-500/40" : "ring-1 ring-slate-200/70",
                ].join(" ")}
                style={{
                  background: data.labelBg || "#fff",
                  color: data.labelColor || "#334155",
                  fontSize: `${data.fontSize || 12}px`,
                }}
              >
                {data.label}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(FlowEdge);
