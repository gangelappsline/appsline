/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/15 disabled:cursor-not-allowed disabled:opacity-60",
  subtle:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
};

const TONES = {
  brand: "text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500/25",
  red: "text-red-600 hover:bg-red-50 focus-visible:ring-red-500/20",
  slate: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-500/15",
};

/**
 * Botón del panel con estado de carga integrado.
 * @example <Button loading={saving} onClick={save}>Guardar</Button>
 */
const Button = ({
  variant = "primary",
  tone = "brand",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cx(
      VARIANTS[variant] || VARIANTS.primary,
      variant === "subtle" && (TONES[tone] || TONES.brand),
      className
    )}
    {...rest}
  >
    {loading && (
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )}
    {children}
  </button>
);

export default Button;
