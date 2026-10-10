/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

const TONES = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

const DOTS = {
  brand: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  slate: "bg-slate-400",
};

/**
 * Etiqueta de estado/categoría.
 * @example <Badge tone="green" dot>En curso</Badge>
 */
const Badge = ({ tone = "slate", dot = false, className = "", children }) => (
  <span
    className={cx(
      "inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
      TONES[tone] || TONES.slate,
      className
    )}
  >
    {dot && <span className={cx("h-1.5 w-1.5 rounded-full", DOTS[tone] || DOTS.slate)} />}
    {children}
  </span>
);

export default Badge;
