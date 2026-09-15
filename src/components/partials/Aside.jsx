/* eslint-disable react/prop-types */
import { NavLink } from "react-router-dom";
import {
  FiBox,
  FiFolder,
  FiGrid,
  FiHelpCircle,
  FiUsers,
  FiX,
} from "react-icons/fi";
import LogoFull from "../../assets/images/appsline_logo_white.webp";

const navSections = [
  {
    title: "General",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: FiGrid }],
  },
  {
    title: "Gestión",
    items: [
      { to: "/admin/projects", label: "Proyectos", icon: FiFolder },
      { to: "/admin/products", label: "Productos", icon: FiBox },
      { to: "/admin/users", label: "Usuarios", icon: FiUsers },
    ],
  },
];

/**
 * Barra lateral del panel administrativo.
 * En escritorio es fija; en móvil se comporta como drawer controlado
 * por `open` / `onClose` desde LayoutAdmin.
 */
const Aside = ({ open = false, onClose = () => {} }) => {
  const linkClass = ({ isActive }) =>
    `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-white/10 text-white"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <>
      {/* Overlay móvil */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-white/5 bg-ink-950 transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
          <NavLink to="/admin/dashboard" className="flex items-center">
            <img
              src={LogoFull}
              alt="Appsline"
              className="h-8 object-contain"
            />
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <FiX />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink to={to} className={linkClass} onClick={onClose}>
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-400" />
                          )}
                          <Icon
                            className={`text-lg transition ${
                              isActive
                                ? "text-brand-400"
                                : "text-slate-500 group-hover:text-brand-400"
                            }`}
                          />
                          {label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Tarjeta de ayuda */}
        <div className="px-3 pb-4">
          <div className="rounded-xl border border-white/10 bg-brand-700/15 p-4">
            <FiHelpCircle className="text-lg text-brand-400" />
            <p className="mt-2.5 text-sm font-semibold text-white">
              ¿Necesitas ayuda?
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Escríbenos y el equipo de soporte te responderá.
            </p>
            <a
              href="mailto:soporte@appsline.com.mx"
              className="mt-3 inline-block text-xs font-semibold text-brand-400 transition hover:text-white"
            >
              Contactar soporte →
            </a>
          </div>
        </div>

        <div className="border-t border-white/5 px-5 py-3.5 text-[11px] text-slate-600">
          © {new Date().getFullYear()} Appsline
        </div>
      </aside>
    </>
  );
};

export default Aside;
