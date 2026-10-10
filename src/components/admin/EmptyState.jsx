/* eslint-disable react/prop-types */
import { FiInbox } from "react-icons/fi";

/**
 * Estado vacío profesional para tablas, listas y tableros.
 * @example <EmptyState icon={FiFolder} title="Sin proyectos" action={<Button>Nuevo</Button>} />
 */
const EmptyState = ({
  icon: Icon = FiInbox,
  title = "Sin resultados",
  description,
  action,
  className = "",
}) => (
  <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
    <span className="flex items-center justify-center rounded-2xl bg-brand-50 p-4 text-2xl text-brand-500">
      <Icon />
    </span>
    <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
