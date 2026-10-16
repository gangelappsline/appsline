/* eslint-disable react/prop-types */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiActivity, FiBarChart2, FiBox, FiBriefcase, FiCalendar, FiCheckSquare, FiCornerDownLeft,
  FiFolder, FiGitBranch, FiGrid, FiPlus, FiSearch, FiSettings, FiUsers,
} from "react-icons/fi";
import { fetchProjects } from "../../services/admin";
import { cx } from "../../utils/format";

/** Secciones navegables del panel (fuente única para la paleta). */
export const PALETTE_SECTIONS = [
  { to: "/admin/dashboard", label: "Dashboard", hint: "Resumen y productividad", icon: FiGrid, keywords: "inicio resumen métricas" },
  { to: "/admin/tasks", label: "Mi trabajo", hint: "Todas las tareas", icon: FiCheckSquare, keywords: "tareas pendientes trabajo mías" },
  { to: "/admin/calendar", label: "Calendario", hint: "Vencimientos y entregas", icon: FiCalendar, keywords: "fechas agenda eventos" },
  { to: "/admin/projects", label: "Proyectos", hint: "Portafolio de trabajo", icon: FiFolder, keywords: "proyectos portafolio tablero" },
  { to: "/admin/diagrams", label: "Diagramas", hint: "Diagramas de flujo de proyectos y tareas", icon: FiGitBranch, keywords: "diagramas flujo flowchart procesos" },
  { to: "/admin/clients", label: "Clientes", hint: "Cartera de clientes", icon: FiBriefcase, keywords: "clientes cartera contactos" },
  { to: "/admin/products", label: "Productos", hint: "Catálogo", icon: FiBox, keywords: "productos catálogo inventario" },
  { to: "/admin/users", label: "Usuarios", hint: "Equipo y roles", icon: FiUsers, keywords: "usuarios equipo roles permisos" },
  { to: "/admin/analytics", label: "Analítica", hint: "Análisis profundo del portafolio", icon: FiActivity, keywords: "analítica gráficos portafolio kpi salud radar clientes" },
  { to: "/admin/reports", label: "Reportes", hint: "Análisis y exportaciones", icon: FiBarChart2, keywords: "reportes analítica estadísticas exportar" },
  { to: "/admin/settings", label: "Configuración", hint: "Perfil y preferencias", icon: FiSettings, keywords: "configuración ajustes perfil cuenta" },
];

const QUICK_ACTIONS = [
  { to: "/admin/projects?action=new", label: "Nuevo proyecto", icon: FiPlus },
  { to: "/admin/users?action=new", label: "Nuevo usuario", icon: FiPlus },
  { to: "/admin/clients?action=new", label: "Nuevo cliente", icon: FiPlus },
];

/**
 * Paleta de comandos (Ctrl+K): navega a secciones, abre proyectos
 * recientes y ejecuta acciones rápidas. Todo con teclado.
 */
const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loadedProjects, setLoadedProjects] = useState(false);
  const inputRef = useRef(null);

  // Carga perezosa de proyectos solo cuando se abre la paleta.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 30);
    if (!loadedProjects) {
      setLoadedProjects(true);
      fetchProjects().then(setProjects).catch(() => setProjects([]));
    }
  }, [open, loadedProjects]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sections = PALETTE_SECTIONS.filter(
      (s) => !q || `${s.label} ${s.hint} ${s.keywords}`.toLowerCase().includes(q)
    ).map((s) => ({ ...s, type: "section" }));
    const projectHits = (q ? projects : projects.slice(0, 4))
      .filter((p) => !q || `${p.name || ""} ${p.client_name || ""}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({
        to: `/admin/projects/${p.id}`,
        label: p.name,
        hint: p.client_name || "Proyecto",
        icon: FiFolder,
        type: "project",
      }));
    const actions = QUICK_ACTIONS.filter(
      (a) => q && a.label.toLowerCase().includes(q)
    ).map((a) => ({ ...a, type: "action" }));
    return [...actions, ...sections, ...projectHits];
  }, [query, projects]);

  useEffect(() => setCursor(0), [query]);

  const go = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[cursor]); }
  };

  const groupLabel = (type) =>
    type === "action" ? "Acciones" : type === "section" ? "Secciones" : "Proyectos";

  let lastType = null;

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-4 pt-[12vh]">
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95 -translate-y-2" enterTo="opacity-100 scale-100 translate-y-0" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Panel className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4">
                <FiSearch className="shrink-0 text-lg text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Buscar secciones, proyectos o acciones..."
                  className="w-full bg-transparent py-4 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 sm:block">
                  ESC
                </kbd>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-2">
                {results.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    Sin coincidencias para “{query}”.
                  </p>
                )}
                {results.map((item, i) => {
                  const Icon = item.icon;
                  const showGroup = item.type !== lastType;
                  lastType = item.type;
                  return (
                    <Fragment key={`${item.type}-${item.to}-${i}`}>
                      {showGroup && (
                        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {groupLabel(item.type)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => go(item)}
                        onMouseEnter={() => setCursor(i)}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          i === cursor ? "bg-brand-50" : "bg-transparent"
                        )}
                      >
                        <span className={cx(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          i === cursor ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          <Icon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{item.label}</span>
                          {item.hint && <span className="block truncate text-xs text-slate-400">{item.hint}</span>}
                        </span>
                        {i === cursor && <FiCornerDownLeft className="shrink-0 text-slate-300" />}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[11px] text-slate-400">
                <span><kbd className="font-semibold">↑↓</kbd> navegar</span>
                <span><kbd className="font-semibold">↵</kbd> abrir</span>
                <span className="ml-auto"><kbd className="font-semibold">Ctrl K</kbd> en cualquier momento</span>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CommandPalette;
