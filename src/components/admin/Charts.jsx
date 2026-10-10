/* eslint-disable react/prop-types */
import { useId } from "react";

/**
 * Gráficos SVG ligeros (sin dependencias) para Dashboard y Reportes.
 * Si algún día necesitas gráficos más avanzados, este es el único
 * archivo que habría que reemplazar.
 */

/** Anillo de progreso (0..1). */
export const ProgressRing = ({
  value = 0,
  size = 120,
  stroke = 14,
  color = "#0060FC",
  track = "#e2e8f0",
  label = null,
}) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const gid = useId();
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v * 100)}%`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00A3FE" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={radius} stroke={track} strokeWidth={stroke} fill="none" />
          <circle
            r={radius}
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - v)}
            className="transition-all duration-700"
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight text-slate-800 tabular-nums">
          {Math.round(v * 100)}%
        </span>
        {label && <span className="mt-0.5 max-w-[5.5rem] text-center text-[11px] leading-4 text-slate-500">{label}</span>}
      </div>
    </div>
  );
};

const BAR_COLORS = ["#0060FC", "#00A3FE", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b"];

/** Barras verticales simples con etiquetas. */
export const BarChart = ({ data = [], height = 170, color = null, money = false }) => {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-slate-400">Sin datos para mostrar.</p>;
  }
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const width = data.length * 64;
  const chartH = height - 44;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 min-w-full" role="img">
        {/* líneas guía */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={chartH - chartH * f + 18}
            y2={chartH - chartH * f + 18}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
        ))}
        {data.map((d, i) => {
          const w = 34;
          const x = i * 64 + 15;
          const h = Math.max(3, Math.round((Number(d.value || 0) / max) * chartH));
          const y = chartH - h + 18;
          const fill = d.color || color || BAR_COLORS[i % BAR_COLORS.length];
          return (
            <g key={d.label || i}>
              <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} opacity="0.92">
                <title>{`${d.label}: ${d.value}`}</title>
              </rect>
              <text x={x + w / 2} y={y - 6} fontSize="11" fontWeight="700" fill="#334155" textAnchor="middle">
                {money ? `$${Number(d.value || 0).toLocaleString("es-MX")}` : d.value}
              </text>
              <text x={x + w / 2} y={height - 6} fontSize="10.5" fill="#94a3b8" textAnchor="middle">
                {String(d.label || "").slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** Barras horizontales con porcentaje (ideales para rankings). */
export const RankBars = ({ data = [], color = "bg-brand-gradient" }) => {
  if (!data.length) {
    return <p className="py-6 text-center text-sm text-slate-400">Sin datos para mostrar.</p>;
  }
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = Math.round((Number(d.value || 0) / max) * 100);
        return (
          <div key={d.label || i}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-600">{d.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">{d.display ?? d.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-500 ${d.barClass || color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
