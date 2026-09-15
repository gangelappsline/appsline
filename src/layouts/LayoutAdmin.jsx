/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiLogOut, FiMenu, FiSearch, FiUser } from "react-icons/fi";
import Aside from "../components/partials/Aside";
import { useAuth } from "../routes/AuthContext";

const APP_NAME = "Appsline";

const LayoutAdmin = ({ title, subtitle, actions, children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.title = `${APP_NAME}${title ? ` · ${title}` : ""}`;
  }, [title]);

  // Cierra el menú de usuario al hacer clic fuera o con Escape.
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSidebarOpen(false);
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
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Aside open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------- Top bar ---------- */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <FiMenu className="text-xl" />
          </button>

          <div className="hidden min-w-0 flex-1 md:block">
            <div className="relative max-w-sm">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Buscar..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
          </div>

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
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-brand-sm">
                  {initials || "A"}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-slate-800">
                    {userName}
                  </span>
                  {user?.email && (
                    <span className="block max-w-[10rem] truncate text-xs text-slate-500">
                      {user.email}
                    </span>
                  )}
                </span>
                <FiChevronDown
                  className={`text-slate-400 transition ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-lg"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {userName}
                    </p>
                    {user?.email && (
                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <FiUser className="text-base text-slate-400" /> Mi perfil
                  </button>
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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            {(title || actions) && (
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {title && <h1 className="admin-title">{title}</h1>}
                  {subtitle && <p className="mt-1 admin-subtitle">{subtitle}</p>}
                </div>
                {actions && (
                  <div className="flex flex-wrap items-center gap-2">
                    {actions}
                  </div>
                )}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LayoutAdmin;
