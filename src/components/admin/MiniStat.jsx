/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

const TONES = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-500 ring-red-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * Métrica compacta para la franja superior de una vista
 * (calendario del proyecto, explorador de archivos...).
 *
 * @example <MiniStat icon={FiFolder} label="Archivos" value={12} hint="3 generales" />
 */
const MiniStat = ({ icon: Icon, label, value, hint, tone = "brand", className = "" }) => (
  <div className={cx("admin-card flex items-center gap-3 px-4 py-3.5", className)}>
    <span
      className={cx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
        TONES[tone] || TONES.brand
      )}
    >
      <Icon />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="truncate text-[11px] leading-4 text-slate-400">{hint}</p>}
    </div>
  </div>
);

export default MiniStat;
