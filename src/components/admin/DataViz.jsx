/* eslint-disable react/prop-types */
/**
 * Librería de visualización de datos del panel administrativo.
 *
 * Todos los gráficos son SVG puro (sin dependencias externas), responsivos
 * vía `viewBox`, con tooltips, animaciones suaves y paletas coherentes con
 * la marca (azul Appsline + acentos).
 *
 * Uso:
 *   import { AreaChart, DonutChart, RadarChart } from "../../components/admin";
 */
import { useId, useMemo, useState } from "react";
import { cx, formatNumber } from "../../utils/format";

/* ------------------------------------------------------------------ */
/* Paleta y utilidades compartidas                                    */
/* ------------------------------------------------------------------ */

export const SERIES_COLORS = [
  "#0060FC", // azul de marca
  "#00A3FE", // cian
  "#8b5cf6", // violeta
  "#10b981", // esmeralda
  "#f59e0b", // ámbar
  "#f43f5e", // rosa
  "#0ea5e9", // cielo
  "#6366f1", // índigo
  "#14b8a6", // teal
  "#a855f7", // púrpura
];

export const CHART_TONES = {
  brand: "#0060FC",
  cyan: "#00A3FE",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b",
};

/** Redondea el eje a un valor "bonito" (1, 2, 5 x 10^n). */
export const niceMax = (value, fallback = 10) => {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const n = v / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * base;
};

/** Escala de ticks para un eje 0..max. */
export const makeTicks = (max, count = 4) =>
  Array.from({ length: count + 1 }, (_, i) => (max / count) * i);

/** Ruta SVG con curvas suaves (spline monótono) para una serie de puntos. */
export const smoothPath = (points) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const n = points.length;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x || 1;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }
  const tangents = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  tangents[n - 1] = slope[n - 2];

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${points[i].x + h} ${points[i].y + tangents[i] * h}, ${
      points[i + 1].x - h
    } ${points[i + 1].y - tangents[i + 1] * h}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return d;
};

/** Interpolación de color (hex -> hex) para degradados. */
const shade = (hex, amount) => {
  const clean = String(hex || "#0060FC").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const mixDark = (c) => Math.round(c * (1 - amount));
  const target = amount >= 0 ? mix : mixDark;
  return `rgb(${target(r)}, ${target(g)}, ${target(b)})`;
};

/** Estado vacío reutilizable dentro de los gráficos. */
const ChartEmpty = ({ message = "Sin datos para mostrar.", height = 200 }) => (
  <div
    className="flex items-center justify-center rounded-xl bg-slate-50/70 text-sm text-slate-400"
    style={{ height }}
  >
    {message}
  </div>
);

/* ------------------------------------------------------------------ */
/* AreaChart / LineChart                                               */
/* ------------------------------------------------------------------ */

/**
 * Gráfico de líneas/áreas multi-serie con tooltips.
 *
 * @param {Array<{label:string, [key:string]:number}>} data
 * @param {Array<{key:string,label:string,color?:string}>} series
 * @example
 *   <AreaChart
 *     data={[{ label: "Ene", created: 12, completed: 8 }]}
 *     series={[{ key: "created", label: "Creadas" }, { key: "completed", label: "Completadas" }]}
 *   />
 */
export const AreaChart = ({
  data = [],
  series = [],
  height = 260,
  yFormatter = (v) => formatNumber(v),
  tooltipFormatter = null,
  showGrid = true,
  showLegend = true,
  showValues = false,
  stacked = false,
  curve = true,
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);

  const resolvedSeries = useMemo(() => {
    if (series.length) return series;
    const keys = data.length
      ? Object.keys(data[0]).filter((k) => k !== "label" && typeof data[0][k] === "number")
      : [];
    return keys.map((key, i) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));
  }, [data, series]);

  const W = 900;
  const H = Math.max(180, height);
  const pad = { top: 18, right: 18, bottom: 30, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const stats = useMemo(() => {
    let max = 0;
    if (stacked) {
      data.forEach((d) => {
        const sum = resolvedSeries.reduce((s, se) => s + (Number(d[se.key]) || 0), 0);
        if (sum > max) max = sum;
      });
    } else {
      resolvedSeries.forEach((se) => {
        data.forEach((d) => {
          const v = Number(d[se.key]) || 0;
          if (v > max) max = v;
        });
      });
    }
    const top = niceMax(max || 10, 10);
    return { max: top, ticks: makeTicks(top, 4) };
  }, [data, resolvedSeries, stacked]);

  if (!data.length || !resolvedSeries.length) {
    return <ChartEmpty message={emptyMessage} height={height} />;
  }

  const n = data.length;
  const xAt = (i) => (n === 1 ? pad.left + innerW / 2 : pad.left + (i / (n - 1)) * innerW);
  const yAt = (v) => pad.top + innerH - ((Number(v) || 0) / stats.max) * innerH;

  const showEvery = n > 12 ? Math.ceil(n / 6) : 1;

  const stackOffsets = [];
  if (stacked) {
    const running = new Array(n).fill(0);
    resolvedSeries.forEach((se) => {
      stackOffsets.push(running.slice());
      data.forEach((d, i) => {
        running[i] += Number(d[se.key]) || 0;
      });
    });
  }

  const hoverData = hover !== null ? data[hover] : null;

  return (
    <div className={cx("relative", className)}>
      {showLegend && resolvedSeries.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {resolvedSeries.map((se) => (
            <span key={se.key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: se.color || SERIES_COLORS[0] }}
              />
              {se.label}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {resolvedSeries.map((se, si) => (
            <linearGradient
              key={`g-${si}`}
              id={`${uid}-g${si}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={se.color || SERIES_COLORS[si % SERIES_COLORS.length]}
                stopOpacity="0.32"
              />
              <stop
                offset="100%"
                stopColor={se.color || SERIES_COLORS[si % SERIES_COLORS.length]}
                stopOpacity="0.02"
              />
            </linearGradient>
          ))}
        </defs>

        {/* Rejilla + eje Y */}
        {showGrid &&
          stats.ticks.map((t) => (
            <g key={`t-${t}`}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#eef2f7"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={yAt(t) + 4}
                fontSize="11"
                fill="#94a3b8"
                textAnchor="end"
              >
                {yFormatter(t)}
              </text>
            </g>
          ))}

        {/* Líneas base */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />

        {/* Series */}
        {resolvedSeries.map((se, si) => {
          const color = se.color || SERIES_COLORS[si % SERIES_COLORS.length];
          const pts = data.map((d, i) => {
            const v = Number(d[se.key]) || 0;
            const base = stacked ? stackOffsets[si][i] : 0;
            return { x: xAt(i), y: yAt(base + v) };
          });
          const line = curve ? smoothPath(pts) : pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
          const area = `${line} L ${pts[pts.length - 1].x} ${pad.top + innerH} L ${pts[0].x} ${
            pad.top + innerH
          } Z`;
          return (
            <g key={se.key}>
              <path d={area} fill={`url(#${uid}-g${si})`} />
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {showValues &&
                pts.map((p, i) => (
                  <text
                    key={`v-${i}`}
                    x={p.x}
                    y={p.y - 9}
                    fontSize="10.5"
                    fontWeight="700"
                    fill="#475569"
                    textAnchor="middle"
                  >
                    {yFormatter(data[i][se.key])}
                  </text>
                ))}
              {hover !== null && (
                <circle
                  cx={pts[hover]?.x}
                  cy={pts[hover]?.y}
                  r="5"
                  fill="#fff"
                  stroke={color}
                  strokeWidth="3"
                />
              )}
            </g>
          );
        })}

        {/* Crosshair */}
        {hover !== null && (
          <line
            x1={xAt(hover)}
            x2={xAt(hover)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="#0060FC"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
        )}

        {/* Eje X */}
        {data.map((d, i) =>
          i % showEvery === 0 || i === n - 1 ? (
            <text
              key={`x-${i}`}
              x={xAt(i)}
              y={H - 8}
              fontSize="11"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {String(d.label ?? d.date ?? "").slice(0, 12)}
            </text>
          ) : null
        )}

        {/* Zonas de captura del mouse */}
        {data.map((d, i) => (
          <rect
            key={`hit-${i}`}
            x={xAt(i) - (n > 1 ? innerW / (n - 1) / 2 : innerW / 2)}
            y={pad.top}
            width={n > 1 ? innerW / (n - 1) : innerW}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoverData && (
        <div
          className="pointer-events-none absolute z-10 min-w-[9rem] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur"
          style={{
            left: `${(xAt(hover) / W) * 100}%`,
            top: `${Math.max(2, ((yAt(Math.max(...resolvedSeries.map((se) => Number(hoverData[se.key]) || 0))) - 14) / H) * 100)}%`,
          }}
        >
          <p className="mb-1.5 font-semibold text-slate-700">
            {hoverData.label ?? hoverData.date ?? ""}
          </p>
          <ul className="space-y-1">
            {resolvedSeries.map((se, si) => (
              <li key={se.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: se.color || SERIES_COLORS[si % SERIES_COLORS.length] }}
                  />
                  {se.label}
                </span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {tooltipFormatter
                    ? tooltipFormatter(hoverData[se.key], se, hoverData)
                    : yFormatter(hoverData[se.key])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Alias en línea del gráfico de áreas (sin relleno). */
export const LineChart = (props) => {
  const { series = [], data = [], ...rest } = props;
  return (
    <AreaChart
      {...rest}
      data={data}
      series={series.map((s) => ({ ...s }))}
      showValues={rest.showValues}
    />
  );
};

/* ------------------------------------------------------------------ */
/* DonutChart                                                          */
/* ------------------------------------------------------------------ */

/**
 * Dona con leyenda y valor central.
 * @param {Array<{label:string,value:number,color?:string}>} data
 */
export const DonutChart = ({
  data = [],
  size = 200,
  thickness = 30,
  centerLabel,
  centerValue,
  formatter = (v) => formatNumber(v),
  showLegend = true,
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  const [hover, setHover] = useState(null);
  const items = useMemo(
    () => data.filter((d) => Number(d.value) > 0).map((d, i) => ({
      ...d,
      color: d.color || SERIES_COLORS[i % SERIES_COLORS.length],
    })),
    [data]
  );
  const total = items.reduce((s, d) => s + Number(d.value || 0), 0);

  if (!items.length || total <= 0) {
    return <ChartEmpty message={emptyMessage} height={Math.max(140, size * 0.7)} />;
  }

  const cx0 = size / 2;
  const cy0 = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - thickness;

  const arcPath = (start, end) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (r, a) => [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)];
    const [x1, y1] = p(rOuter, start);
    const [x2, y2] = p(rOuter, end);
    const [x3, y3] = p(rInner, end);
    const [x4, y4] = p(rInner, start);
    return [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");
  };

  let cursor = -Math.PI / 2;
  const gap = items.length > 1 ? 0.03 : 0;
  const arcs = items.map((d, i) => {
    const sweep = (Number(d.value) / total) * Math.PI * 2;
    const start = cursor + gap / 2;
    const end = cursor + sweep - gap / 2;
    cursor += sweep;
    return { ...d, path: arcPath(start, end), index: i, pct: (Number(d.value) / total) * 100 };
  });

  const active = hover !== null ? arcs[hover] : null;

  return (
    <div className={cx("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
          {arcs.map((a) => (
            <path
              key={a.label}
              d={a.path}
              fill={a.color}
              opacity={hover === null || hover === a.index ? 1 : 0.35}
              className="cursor-pointer transition-opacity duration-200"
              onMouseEnter={() => setHover(a.index)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${a.label}: ${formatter(a.value)} (${Math.round(a.pct)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {active ? formatter(active.value) : centerValue ?? formatter(total)}
          </span>
          <span className="mt-0.5 max-w-[7rem] text-[11px] leading-4 text-slate-500">
            {active ? active.label : centerLabel}
          </span>
        </div>
      </div>

      {showLegend && (
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {arcs.map((a) => (
            <li
              key={a.label}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-slate-50"
              onMouseEnter={() => setHover(a.index)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="truncate text-slate-600">{a.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="font-semibold tabular-nums text-slate-800">{formatter(a.value)}</span>
                <span className="w-9 text-right text-xs tabular-nums text-slate-400">
                  {Math.round(a.pct)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* BarsChart (vertical, con objetivo opcional)                         */
/* ------------------------------------------------------------------ */

/**
 * Barras verticales con línea de objetivo y etiquetas.
 * @param {Array<{label:string,value:number,color?:string}>} data
 */
export const BarsChart = ({
  data = [],
  height = 240,
  color = SERIES_COLORS[0],
  goal = null,
  formatter = (v) => formatNumber(v),
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  const [hover, setHover] = useState(null);
  if (!data.length) return <ChartEmpty message={emptyMessage} height={height} />;

  const W = 900;
  const H = height;
  const pad = { top: 24, right: 16, bottom: 34, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => Number(d.value) || 0), goal || 0), 10);
  const band = innerW / data.length;
  const barW = Math.min(46, band * 0.56);

  return (
    <div className={cx("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        {makeTicks(max, 4).map((t) => (
          <g key={`t-${t}`}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={pad.top + innerH - (t / max) * innerH}
              y2={pad.top + innerH - (t / max) * innerH}
              stroke="#eef2f7"
            />
            <text
              x={pad.left - 10}
              y={pad.top + innerH - (t / max) * innerH + 4}
              fontSize="11"
              fill="#94a3b8"
              textAnchor="end"
            >
              {formatter(t)}
            </text>
          </g>
        ))}

        {goal !== null && (
          <g>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={pad.top + innerH - (goal / max) * innerH}
              y2={pad.top + innerH - (goal / max) * innerH}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={W - pad.right}
              y={pad.top + innerH - (goal / max) * innerH - 6}
              fontSize="10.5"
              fontWeight="700"
              fill="#f43f5e"
              textAnchor="end"
            >
              Meta {formatter(goal)}
            </text>
          </g>
        )}

        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const h = Math.max(2, (v / max) * innerH);
          const x = pad.left + band * i + (band - barW) / 2;
          const y = pad.top + innerH - h;
          const fill = d.color || color;
          const isHover = hover === i;
          return (
            <g key={`${d.label}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="8"
                fill={fill}
                opacity={hover === null || isHover ? 0.95 : 0.45}
                className="transition-all duration-200"
              />
              <text
                x={x + barW / 2}
                y={y - 8}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
                textAnchor="middle"
              >
                {formatter(v)}
              </text>
              <text
                x={pad.left + band * i + band / 2}
                y={H - 10}
                fontSize="11"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {String(d.label || "").slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* StackedBars (barras apiladas horizontales)                           */
/* ------------------------------------------------------------------ */

/**
 * Barras horizontales apiladas por categoría.
 * @param {Array<{label:string, segments:{key:string,value:number,color?:string}[]}>} data
 */
export const StackedBars = ({
  data = [],
  legend = [],
  formatter = (v) => formatNumber(v),
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  if (!data.length) return <ChartEmpty message={emptyMessage} height={160} />;
  const max = Math.max(
    ...data.map((d) => d.segments.reduce((s, seg) => s + (Number(seg.value) || 0), 0)),
    1
  );

  return (
    <div className={cx("space-y-4", className)}>
      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {data.map((row) => {
        const total = row.segments.reduce((s, seg) => s + (Number(seg.value) || 0), 0);
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-700">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {formatter(total)}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {row.segments.map((seg, i) => {
                const w = ((Number(seg.value) || 0) / max) * 100;
                if (w <= 0) return null;
                return (
                  <div
                    key={seg.key || i}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${w}%`, background: seg.color }}
                    title={`${seg.label || seg.key}: ${formatter(seg.value)}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* RadarChart (salud multidimensional del proyecto)                     */
/* ------------------------------------------------------------------ */

/**
 * Radar de 3 a 6 ejes (avance, calidad, ritmo, presupuesto...).
 * @param {Array<{label:string,value:number,max?:number}>} axes
 */
export const RadarChart = ({
  axes = [],
  size = 240,
  color = SERIES_COLORS[0],
  levels = 4,
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  if (axes.length < 3) return <ChartEmpty message={emptyMessage} height={size * 0.7} />;

  const cx0 = size / 2;
  const cy0 = size / 2;
  const r = size / 2 - 34;
  const maxValue = Math.max(
    ...axes.map((a) => Number(a.max) || 0),
    ...axes.map((a) => Number(a.value) || 0),
    1
  );
  const pointAt = (i, ratio) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx0 + r * ratio * Math.cos(angle), cy0 + r * ratio * Math.sin(angle)];
  };
  const polygon = (ratio) =>
    axes.map((_, i) => pointAt(i, ratio).map((v) => v.toFixed(2)).join(",")).join(" ");

  return (
    <div className={cx("flex flex-col items-center gap-3 sm:flex-row", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img">
        {Array.from({ length: levels }, (_, l) => {
          const ratio = (l + 1) / levels;
          return (
            <polygon
              key={l}
              points={polygon(ratio)}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}
        {axes.map((_, i) => {
          const [x, y] = pointAt(i, 1);
          return <line key={i} x1={cx0} y1={cy0} x2={x} y2={y} stroke="#eef2f7" strokeWidth="1" />;
        })}
        <polygon
          points={axes
            .map((a, i) =>
              pointAt(i, Math.max(0, Math.min(1, (Number(a.value) || 0) / maxValue)))
                .map((v) => v.toFixed(2))
                .join(",")
            )
            .join(" ")}
          fill={color}
          fillOpacity="0.18"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, Math.max(0, Math.min(1, (Number(a.value) || 0) / maxValue)));
          return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />;
        })}
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {axes.map((a) => {
          const pct = Math.round(((Number(a.value) || 0) / maxValue) * 100);
          return (
            <li key={a.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-600">{a.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </span>
                <span className="w-10 text-right font-semibold tabular-nums text-slate-800">
                  {Math.round(Number(a.value) || 0)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* GaugeChart (medidor semicircular)                                    */
/* ------------------------------------------------------------------ */

/**
 * Medidor de 0 a 1 con zonas de color.
 * @param {number} value 0..1
 * @param {Array<{to:number,color:string}>} segments
 */
export const GaugeChart = ({
  value = 0,
  size = 180,
  segments = [
    { to: 0.5, color: "#f43f5e" },
    { to: 0.8, color: "#f59e0b" },
    { to: 1, color: "#10b981" },
  ],
  label,
  sublabel,
  className = "",
}) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const stroke = 14;
  const r = size / 2 - stroke / 2 - 4;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const totalLen = Math.PI * r;
  let offset = 0;

  const arc = (from, to, color) => {
    const len = (to - from) * totalLen;
    const el = (
      <circle
        key={`${from}-${to}`}
        cx={cx0}
        cy={cy0}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${len} ${totalLen - len}`}
        strokeDashoffset={-offset * totalLen}
        transform={`rotate(180 ${cx0} ${cy0})`}
      />
    );
    offset = to;
    return el;
  };

  let prev = 0;
  const arcs = segments.map((s) => {
    const el = arc(prev, Math.max(prev, Math.min(1, s.to)), s.color);
    prev = Math.max(prev, Math.min(1, s.to));
    return el;
  });

  const angle = Math.PI * (1 - v);
  const needleX = cx0 + (r - stroke / 2 - 4) * Math.cos(angle);
  const needleY = cy0 - (r - stroke / 2 - 4) * Math.sin(angle);

  return (
    <div className={cx("flex flex-col items-center", className)}>
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`} role="img">
        {arcs}
        <line
          x1={cx0}
          y1={cy0}
          x2={needleX}
          y2={needleY}
          stroke="#334155"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx0} cy={cy0} r="5" fill="#334155" />
      </svg>
      <p className="-mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {Math.round(v * 100)}%
      </p>
      {label && <p className="text-sm font-medium text-slate-600">{label}</p>}
      {sublabel && <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Heatmap (calendario de intensidad)                                   */
/* ------------------------------------------------------------------ */

/**
 * Mapa de calor estilo calendario (GitHub contributions).
 * @param {Array<{date:string,value:number}>} data
 */
export const Heatmap = ({
  data = [],
  weeks = 14,
  color = SERIES_COLORS[0],
  formatter = (v) => formatNumber(v),
  className = "",
  emptyMessage = "Sin actividad registrada.",
}) => {
  const map = useMemo(() => {
    const m = new Map();
    data.forEach((d) => {
      const key = String(d.date || d.label || "").slice(0, 10);
      if (key) m.set(key, (m.get(key) || 0) + (Number(d.value) || 0));
    });
    return m;
  }, [data]);

  if (!map.size) return <ChartEmpty message={emptyMessage} height={140} />;

  const max = Math.max(...map.values(), 1);
  const days = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    days.push({ key, value: map.get(key) || 0, date: d });
  }
  const columns = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  const intensity = (v) => {
    if (v <= 0) return "#eef2f7";
    const ratio = v / max;
    if (ratio <= 0.25) return shade(color, 0.7);
    if (ratio <= 0.5) return shade(color, 0.45);
    if (ratio <= 0.75) return shade(color, 0.2);
    return color;
  };

  return (
    <div className={cx("overflow-x-auto", className)}>
      <div className="inline-flex gap-[3px]">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((d) => (
              <div
                key={d.key}
                title={`${d.key}: ${formatter(d.value)}`}
                className="h-3 w-3 rounded-[3px] transition-transform hover:scale-125"
                style={{ background: intensity(d.value) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{weeks} semanas</span>
        <span className="flex items-center gap-1">
          Menos
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <span
              key={r}
              className="h-3 w-3 rounded-[3px]"
              style={{ background: r === 0 ? "#eef2f7" : shade(color, 1 - r) }}
            />
          ))}
          Más
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* BubbleChart (presupuesto vs avance)                                  */
/* ------------------------------------------------------------------ */

/**
 * Diagrama de burbujas: presupuesto (X) vs avance (Y).
 * @param {Array<{x:number,y:number,r?:number,label:string,color?:string,meta?:string}>} points
 */
export const BubbleChart = ({
  points = [],
  height = 300,
  xLabel = "Presupuesto",
  yLabel = "Avance %",
  xFormatter = (v) => formatNumber(v),
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  const [hover, setHover] = useState(null);
  if (!points.length) return <ChartEmpty message={emptyMessage} height={height} />;

  const W = 900;
  const H = height;
  const pad = { top: 20, right: 20, bottom: 46, left: 54 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const maxX = niceMax(Math.max(...points.map((p) => Number(p.x) || 0)), 10);
  const maxY = niceMax(Math.max(...points.map((p) => Number(p.y) || 0), 100), 100);
  const maxR = Math.max(...points.map((p) => Number(p.r) || 0), 1);

  const xAt = (v) => pad.left + ((Number(v) || 0) / maxX) * innerW;
  const yAt = (v) => pad.top + innerH - ((Number(v) || 0) / maxY) * innerH;
  const rAt = (v) => 8 + (Math.sqrt(Number(v) || 0) / Math.sqrt(maxR)) * 22;

  return (
    <div className={cx("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        {makeTicks(maxY, 4).map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="#eef2f7"
            />
            <text x={pad.left - 10} y={yAt(t) + 4} fontSize="11" fill="#94a3b8" textAnchor="end">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {makeTicks(maxX, 4).map((t) => (
          <text
            key={`x-${t}`}
            x={xAt(t)}
            y={pad.top + innerH + 20}
            fontSize="11"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {xFormatter(t)}
          </text>
        ))}

        {/* Línea de paridad (avance = tiempo transcurrido ideal) */}
        <line
          x1={pad.left}
          y1={yAt(0)}
          x2={xAt(maxX)}
          y2={yAt(maxX > 0 ? 100 : 0)}
          stroke="#cbd5e1"
          strokeDasharray="5 5"
          strokeWidth="1"
        />

        {points.map((p, i) => (
          <g
            key={p.label || i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <circle
              cx={xAt(p.x)}
              cy={yAt(p.y)}
              r={rAt(p.r)}
              fill={p.color || SERIES_COLORS[0]}
              fillOpacity={hover === null || hover === i ? 0.35 : 0.12}
              stroke={p.color || SERIES_COLORS[0]}
              strokeWidth="1.5"
              className="cursor-pointer transition-all duration-200"
            >
              <title>{`${p.label}: ${xFormatter(p.x)} · ${Math.round(p.y)}%`}</title>
            </circle>
            {hover === i && (
              <text
                x={xAt(p.x)}
                y={yAt(p.y) - rAt(p.r) - 6}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
                textAnchor="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

        <text x={W / 2} y={H - 8} fontSize="11" fill="#94a3b8" textAnchor="middle">
          {xLabel}
        </text>
        <text
          x={16}
          y={H / 2}
          fontSize="11"
          fill="#94a3b8"
          textAnchor="middle"
          transform={`rotate(-90 16 ${H / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sparkline                                                            */
/* ------------------------------------------------------------------ */

/** Miniatura de tendencia para tarjetas. */
export const Sparkline = ({
  values = [],
  color = SERIES_COLORS[0],
  width = 120,
  height = 36,
  className = "",
}) => {
  const gid = useId().replace(/:/g, "");
  if (!values.length) return null;
  const max = Math.max(...values.map((v) => Number(v) || 0), 1);
  const min = Math.min(...values.map((v) => Number(v) || 0), 0);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => ({
    x: i * step,
    y: height - 3 - (((Number(v) || 0) - min) / span) * (height - 6),
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* FunnelChart                                                          */
/* ------------------------------------------------------------------ */

/** Embudo de conversión (pipeline comercial). */
export const FunnelChart = ({
  data = [],
  formatter = (v) => formatNumber(v),
  className = "",
  emptyMessage = "Sin datos para mostrar.",
}) => {
  if (!data.length) return <ChartEmpty message={emptyMessage} height={180} />;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const colors = SERIES_COLORS;

  return (
    <div className={cx("space-y-2.5", className)}>
      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const pct = (v / max) * 100;
        const prev = i > 0 ? Number(data[i - 1].value) || 0 : null;
        const conv = prev ? Math.round((v / prev) * 100) : null;
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{d.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                {conv !== null && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
                    {conv}%
                  </span>
                )}
                <span className="font-semibold tabular-nums text-slate-800">{formatter(v)}</span>
              </span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-lg bg-slate-50">
              <div
                className="flex h-full items-center justify-end rounded-lg pr-2 text-[11px] font-semibold text-white transition-all duration-700"
                style={{
                  width: `${Math.max(pct, 6)}%`,
                  background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${
                    colors[(i + 1) % colors.length]
                  })`,
                }}
              >
                {Math.round(pct)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* TrendBadge (variación de KPI)                                        */
/* ------------------------------------------------------------------ */

/** Etiqueta de tendencia con flecha y color semántico. */
export const TrendBadge = ({
  value = 0,
  suffix = "%",
  invert = false,
  className = "",
}) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) {
    return (
      <span className={cx("text-xs font-semibold text-slate-400", className)}>
        0{suffix}
      </span>
    );
  }
  const up = n > 0;
  const good = invert ? !up : up;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        good ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
        className
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(n).toFixed(1)}
      {suffix}
    </span>
  );
};

export default {
  AreaChart,
  LineChart,
  DonutChart,
  BarsChart,
  StackedBars,
  RadarChart,
  GaugeChart,
  Heatmap,
  BubbleChart,
  Sparkline,
  FunnelChart,
  TrendBadge,
};
