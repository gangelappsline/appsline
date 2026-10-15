/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";
import { Sparkline, TrendBadge } from "./DataViz";

const TONES = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-500 ring-red-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

const SPARK_COLORS = {
  brand: "#0060FC",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#f43f5e",
  violet: "#8b5cf6",
  sky: "#0ea5e9",
  slate: "#64748b",
};

/**
 * Tarjeta de métrica para tableros y resúmenes.
 *
 * @param {string} label  Etiqueta de la métrica.
 * @param {ReactNode} value Valor mostrado (número o texto).
 * @param {number} [trend] Variación porcentual respecto al periodo anterior.
 * @param {boolean} [invert] Invierte el color de la tendencia (útil para métricas
 *   donde "subir" es malo, como las tareas vencidas).
 * @param {number[]} [spark] Serie corta para la miniatura de tendencia.
 * @param {number} [progress] Porcentaje de barra (0-100).
 *
 * @example <StatCard label="Proyectos activos" value={12} icon={FiFolder} tone="brand" trend={8.4} />
 */
const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  progress = null,
  trend = null,
  trendSuffix = "%",
  invert = false,
  spark = null,
  className = "",
}) => (
  <div className={cx("admin-card admin-card-hover relative overflow-hidden p-5", className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {trend !== null && trend !== undefined && (
            <TrendBadge value={trend} suffix={trendSuffix} invert={invert} />
          )}
          {hint && <p className="text-xs leading-5 text-slate-400">{hint}</p>}
        </div>
      </div>
      {Icon && (
        <span
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
            TONES[tone] || TONES.brand
          )}
        >
          <Icon className="text-lg" />
        </span>
      )}
    </div>

    {spark && spark.length > 1 && (
      <div className="pointer-events-none absolute bottom-0 right-0 opacity-70">
        <Sparkline values={spark} color={SPARK_COLORS[tone] || SPARK_COLORS.brand} width={96} height={38} />
      </div>
    )}

    {typeof progress === "number" && (
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    )}
  </div>
);

export default StatCard;
