/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiChevronDown,
  FiChevronRight,
  FiExternalLink,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiSettings,
} from "react-icons/fi";
import Aside from "../components/partials/Aside";
import CommandPalette from "../components/admin/CommandPalette";
import { Avatar } from "../components/admin";
import { useAuth } from "../routes/AuthContext";

const APP_NAME = "Appsline";

/**
 * Layout del panel administrativo (tema claro, 100% Tailwind).
 *
 * @param {string} title - Título de la página (también alimenta <title>).
 * @param {string} subtitle - Descripción bajo el título.
 * @param {node} actions - Botones de acción a la derecha del encabezado.
 * @param {Array<{label: string, to?: string}>} breadcrumbs - Ruta de navegación.
 * @param {boolean} fluid - Sin ancho máximo (ideal para tableros kanban).
 */
const LayoutAdmin = ({ title, subtitle, actions, breadcrumbs = [], fluid = false, children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.title = `${APP_NAME}${title ? ` · ${title}` : ""}`;
  }, [title]);

  // Cierra menús al hacer clic fuera o con Escape; Ctrl+K abre la paleta.
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSidebarOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const userName = user?.name || "Admin";

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <Aside open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ---------- Top bar ---------- */}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label="Abrir menú"
            >
              <FiMenu className="text-xl" />
            </button>

            {/* Buscador global -> abre la paleta de comandos */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden min-w-0 flex-1 items-center gap-3 md:flex md:max-w-sm"
            >
              <span className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white">
                <FiSearch className="shrink-0" />
                <span className="truncate">Buscar secciones, proyectos...</span>
                <kbd className="ml-auto hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 lg:block">
                  Ctrl K
                </kbd>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              {/* Menú de usuario */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-100"
                >
                  <Avatar user={user} size="sm" />
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-[9rem] truncate text-sm font-semibold text-slate-800">
                      {userName}
                    </span>
                    {user?.email && (
                      <span className="block max-w-[9rem] truncate text-xs text-slate-500">
                        {user.email}
                      </span>
                    )}
                  </span>
                  <FiChevronDown className={`text-slate-400 transition ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-lg"
                  >
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
                      {user?.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
                    </div>
                    <Link
                      to="/admin/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <FiSettings className="text-base text-slate-400" /> Mi cuenta
                    </Link>
                    <a
                      href="/"
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <FiExternalLink className="text-base text-slate-400" /> Ver sitio público
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <FiLogOut className="text-base" /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ---------- Contenido ---------- */}
          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-4">
            <div className={`mx-auto w-full ${fluid ? "" : "max-w-9xl"}`}>
              {(title || actions || breadcrumbs.length > 0) && (
                <div className="mb-6">
                  {breadcrumbs.length > 0 && (
                    <nav aria-label="Ruta de navegación" className="mb-2 flex flex-wrap items-center gap-1 hidden text-[13px]">
                      {breadcrumbs.map((crumb, i) => {
                        const isLast = i === breadcrumbs.length - 1;
                        return (
                          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                            {i > 0 && <FiChevronRight className="text-slate-300" />}
                            {crumb.to && !isLast ? (
                              <Link to={crumb.to} className="font-medium text-slate-500 transition hover:text-brand-600">
                                {crumb.label}
                              </Link>
                            ) : (
                              <span className={isLast ? "font-semibold text-slate-800" : "text-slate-500"}>
                                {crumb.label}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </nav>
                  )}
                  {(title || actions) && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {title && <h1 className="admin-title">{title}</h1>}
                        {subtitle && <p className="admin-subtitle mt-1">{subtitle}</p>}
                      </div>
                      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                    </div>
                  )}
                </div>
              )}
              {children}
            </div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default LayoutAdmin;
