/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

const TONES = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-500 ring-red-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * Tarjeta de métrica para tableros y resúmenes.
 * @example <StatCard label="Proyectos activos" value={12} icon={FiFolder} tone="brand" hint="3 vencen este mes" />
 */
const StatCard = ({ label, value, hint, icon: Icon, tone = "brand", progress = null }) => (
  <div className="admin-card admin-card-hover p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-1.5 text-xs leading-5 text-slate-400">{hint}</p>}
      </div>
      {Icon && (
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", TONES[tone] || TONES.brand)}>
          <Icon className="text-lg" />
        </span>
      )}
    </div>
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
