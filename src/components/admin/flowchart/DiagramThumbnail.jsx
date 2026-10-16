/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { diagramBounds, normalizeDiagram } from "../../../utils/diagrams";

const center = (n) => ({
  x: n.position.x + (n.width || 160) / 2,
  y: n.position.y + (n.height || 60) / 2,
});

/**
 * Vista previa estática (SVG) de un diagrama para tarjetas y listados.
 * No usa React Flow: pinta formas simplificadas y líneas rectas.
 */
const DiagramThumbnail = ({ diagram, className = "", height = 120 }) => {
  const d = useMemo(() => normalizeDiagram(diagram), [diagram]);
  const nodes = d.data.nodes;
  const edges = d.data.edges;
  const box = useMemo(() => diagramBounds(nodes, 30), [nodes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const canvas = d.data.settings?.canvasColor || "#f8fafc";

  if (!nodes.length) {
    return (
      <div
        className={`flex items-center justify-center text-[11px] text-slate-400 ${className}`}
        style={{ height, background: canvas }}
      >
        Diagrama vacío
      </div>
    );
  }

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ height, width: "100%", background: canvas, display: "block" }}
      aria-hidden="true"
    >
      {edges.map((e) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const p = center(a);
        const q = center(b);
        return (
          <line
            key={e.id}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={e.data?.color || "#94a3b8"}
            strokeWidth={Math.max(2, (e.data?.width || 2) * 1.5)}
            strokeLinecap="round"
          />
        );
      })}
      {nodes.map((n) => {
        const w = n.width || 160;
        const h = n.height || 60;
        const s = n.data.style || {};
        const common = { fill: s.fill || "#fff", stroke: s.stroke || "#64748b", strokeWidth: 3 };
        const x = n.position.x;
        const y = n.position.y;
        if (n.data.shape === "text") return null;
        if (n.data.shape === "decision") {
          return (
            <polygon
              key={n.id}
              points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
              {...common}
            />
          );
        }
        if (n.data.shape === "terminal" || n.data.shape === "connector") {
          return <rect key={n.id} x={x} y={y} width={w} height={h} rx={h / 2} {...common} />;
        }
        return (
          <rect
            key={n.id}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={s.radius ?? 8}
            {...common}
            fillOpacity={n.data.shape === "swimlane" ? 0.4 : 1}
          />
        );
      })}
    </svg>
  );
};

export default DiagramThumbnail;
