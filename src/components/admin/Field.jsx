/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

/**
 * Campo de formulario con etiqueta, ayuda y error.
 * @example <Field label="Nombre" required hint="..."><input className="admin-input" /></Field>
 */
const Field = ({ label, required = false, hint, error, children, className = "" }) => (
  <label className={cx("block", className)}>
    {label && (
      <span className="admin-label">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
    )}
    {children}
    {hint && !error && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
  </label>
);

export default Field;
