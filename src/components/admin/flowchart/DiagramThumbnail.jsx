/* eslint-disable react/prop-types */
import { useId, useMemo } from "react";
import { diagramBounds, normalizeDiagram } from "../../../utils/diagrams";
import { dashArray, edgeAnchor, edgeRoutingOffsets } from "../../../utils/diagramGeometry";
import ShapeSvg from "./ShapeSvg";
import { edgePath } from "./edgePaths";
import { nodeIcon } from "./icons";
import { deviceMeta, SCREEN_SHAPE, screenInsets } from "../../../utils/mockups";

/** SVG estático: conserva formas, conectores, iconos e imágenes del documento. */
const DiagramThumbnail = ({ diagram, className = "", height = 120 }) => {
  const uid = useId().replace(/:/g, "");
  const d = useMemo(() => normalizeDiagram(diagram), [diagram]);
  const { nodes, edges } = d.data;
  const offsets = useMemo(() => edgeRoutingOffsets(edges), [edges]);
  const routingBounds = useMemo(() => diagramBounds(nodes.filter((node) => node.data.shape !== "swimlane"), 0), [nodes]);
  const box = useMemo(() => diagramBounds(nodes, Math.max(64, ...Object.values(offsets)) + 24), [nodes, offsets]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const canvas = d.data.settings.canvasColor;
  if (!nodes.length) return <div className={`flex items-center justify-center text-[11px] text-slate-400 ${className}`} style={{ height, background: canvas }}>Diagrama vacío</div>;

  /** Aproximación vectorial de una pantalla de mockup para la miniatura. */
  const swatch = (background) => {
    const value = String(background || "");
    if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
    return /#0b1220|#0f172a|#1d4ed8|#4c1d95|#7c3aed|#0060fc/i.test(value) ? "#1e293b" : "#e2e8f0";
  };

  /** Lado del contorno que usa el trazado (los conectores de elementos salen por la derecha). */
  const sideFor = (handle) => (["top", "right", "bottom", "left"].includes(handle) ? handle : "right");

  const renderScreen = (node) => {
    const device = deviceMeta(node.data.device);
    const inset = screenInsets(device);
    const w = node.width || device.width;
    const h = node.height || device.height;
    const bezel = device.bezel || 0;
    const radius = Math.min(device.radius || 0, Math.min(w, h) / 2);
    return (
      <g key={node.id} transform={`translate(${node.position.x} ${node.position.y})`} opacity={node.data.style?.opacity ?? 1}>
        <rect x={0} y={0} width={w} height={h} rx={radius} fill={device.platform === "web" ? "#e2e8f0" : "#0b1220"} />
        <rect
          x={bezel}
          y={bezel}
          width={Math.max(1, w - bezel * 2)}
          height={Math.max(1, h - bezel * 2)}
          rx={Math.max(0, radius - bezel)}
          fill={swatch(node.data.background)}
        />
        {(node.data.widgets || []).slice(0, 60).map((widget, index) => {
          const style = widget.style || {};
          const x = inset.left + widget.x;
          const y = inset.top + widget.y;
          const fill = style.fill === "transparent" || !style.fill ? "rgba(148,163,184,.45)" : style.fill;
          const isImage = widget.type === "image" || widget.type === "video" || widget.type === "map" || widget.type === "gallery";
          const isLine = widget.type === "divider" || widget.type === "progress" || widget.type === "slider";
          return (
            <rect
              key={`${node.id}-w-${index}`}
              x={x}
              y={y}
              width={Math.max(1, widget.w)}
              height={Math.max(1, isLine ? Math.max(2, widget.h) : widget.h)}
              rx={Math.min(6, style.radius || 0)}
              fill={isImage ? "#cbd5e1" : fill}
              opacity={widget.type === "text" || widget.type === "heading" ? 0.55 : 0.95}
            />
          );
        })}
        {node.data.label && (
          <text x={0} y={-6} fill="#64748b" fontSize={11} fontWeight={600}>{String(node.data.label).slice(0, 32)}</text>
        )}
      </g>
    );
  };

  const renderNode = (node, index) => {
    const { width: w, height: h, data } = node;
    const s = data.style;
    const Icon = nodeIcon(s.icon);
    const standalone = data.shape === "icon";
    const iconSize = s.iconSize || (standalone ? 40 : 18);
    const image = data.shape === "image" && data.image;
    const clipId = `image-${uid}-${index}`;
    return (
      <g key={node.id} transform={`translate(${node.position.x} ${node.position.y})`} opacity={s.opacity}>
        <ShapeSvg shape={data.shape} width={w} height={h} style={{ ...s, shadow: false }} />
        {image && <>
          <defs><clipPath id={clipId}><rect x={6} y={6} width={Math.max(1, w - 12)} height={Math.max(1, h - 12)} rx={Math.max(0, s.radius - 3)} /></clipPath></defs>
          <image href={image.src} x={6} y={6} width={Math.max(1, w - 12)} height={Math.max(1, h - 12)} preserveAspectRatio={image.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} clipPath={`url(#${clipId})`} />
        </>}
        {Icon && !image && <g transform={`translate(${(w - iconSize) / 2} ${standalone ? Math.max(4, (h - iconSize) / 2 - (data.label ? 10 : 0)) : 8})`}><Icon size={iconSize} color={s.stroke} /></g>}
        {data.label && <text
          x={data.shape === "swimlane" ? 14 : w / 2}
          y={data.shape === "swimlane" ? 23 : image ? h - 12 : standalone ? h - 12 : Icon ? h - 14 : h / 2}
          textAnchor={data.shape === "swimlane" ? "start" : "middle"}
          dominantBaseline="middle"
          fill={s.textColor}
          fontSize={Math.min(s.fontSize || 14, 14)}
          fontWeight={s.fontWeight}
        >{data.label.length > 25 ? `${data.label.slice(0, 24)}…` : data.label}</text>}
      </g>
    );
  };

  return (
    <svg width="100%" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid meet" className={className} style={{ height, background: canvas, display: "block" }} aria-hidden="true">
      {nodes.filter((node) => node.data.shape === "swimlane").map(renderNode)}
      {nodes.filter((node) => node.data.shape === SCREEN_SHAPE || node.type === "screen").map(renderScreen)}
      {edges.map((edge, index) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return null;
        const p = edgeAnchor(source, edge.sourceHandle);
        const q = edgeAnchor(target, edge.targetHandle);
        const [path, labelX, labelY] = edgePath(edge.data.kind, { sourceX: p.x, sourceY: p.y, targetX: q.x, targetY: q.y, sourcePosition: sideFor(edge.sourceHandle), targetPosition: sideFor(edge.targetHandle), bounds: routingBounds, routeOffset: offsets[edge.id] });
        const s = edge.data;
        const markerId = `arrow-${uid}-${index}`;
        return <g key={edge.id}>
          <defs>
            {["Start", "End"].map((side) => <marker key={side} id={`${markerId}-${side}`} viewBox="-6 -6 12 12" refX="5" refY="0" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse">
              <path d={s[`marker${side}`] === "arrow" ? "M -5 -4 L 5 0 L -5 4" : "M -5 -4 L 5 0 L -5 4 Z"} fill={s[`marker${side}`] === "arrow" ? "none" : s.color} stroke={s.color} strokeWidth="1.2" />
            </marker>)}
          </defs>
          <path d={path} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={dashArray(s.dash, s.width)} markerStart={s.markerStart !== "none" ? `url(#${markerId}-Start)` : undefined} markerEnd={s.markerEnd !== "none" ? `url(#${markerId}-End)` : undefined} />
          {s.label && <g transform={`translate(${labelX}, ${labelY})`}>
            <rect x={-Math.min(110, s.label.length * 3.5 + 6)} y={-10} width={Math.min(220, s.label.length * 7 + 12)} height={20} rx={4} fill={s.labelBg} />
            <text textAnchor="middle" dominantBaseline="middle" fill={s.labelColor} fontSize={s.fontSize}>{s.label}</text>
          </g>}
        </g>;
      })}
      {nodes.filter((node) => node.data.shape !== "swimlane" && node.data.shape !== SCREEN_SHAPE).map(renderNode)}
    </svg>
  );
};

export default DiagramThumbnail;
