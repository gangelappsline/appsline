/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

/** Tarjeta base del panel. */
const Card = ({ hover = false, className = "", children, ...rest }) => (
  <div className={cx("admin-card", hover && "admin-card-hover", className)} {...rest}>
    {children}
  </div>
);

/** Encabezado reutilizable para tarjetas y paneles. */
export const CardHeader = ({ title, subtitle, actions, className = "" }) => {
  if (!title && !actions) return null;
  return (
    <header className={cx("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
};

export default Card;
