import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiChevronDown, FiMenu, FiX } from "react-icons/fi";
import Mark from "../assets/images/appsline_logo_white.webp";
import LanguageSelector from "./LanguageSelector";
import { toolPath, toolsByCategory } from "../tools/registry";

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const closeTimer = useRef(null);

  const groups = toolsByCategory();
  const isToolsRoute = location.pathname.startsWith("/herramientas");

  // Cierra el menú al cambiar de ruta.
  useEffect(() => {
    setOpen(false);
    setToolsOpen(false);
    setMobileToolsOpen(false);
  }, [location.pathname]);

  // Cierra el desplegable al hacer clic fuera o con Escape.
  useEffect(() => {
    const onClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setToolsOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setToolsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const links = [
    ["/", t("nav.home")],
    ["/about-us", t("nav.about")],
    ["/what-we-do", t("nav.whatWeDo")],
    ["/portfolio", t("nav.projects")],
  ];

  const navClass = ({ isActive }) =>
    `transition hover:text-white ${isActive ? "text-white" : "text-slate-400"}`;

  const openDropdown = () => {
    clearTimeout(closeTimer.current);
    setToolsOpen(true);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setToolsOpen(false), 180);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0f]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Appsline">
          <img src={Mark} alt="" className="h-14 object-contain" />
          <span className="hidden text-xl font-bold tracking-tight">Appsline</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={navClass} end={to === "/"}>
              {label}
            </NavLink>
          ))}

          {/* ----------------------------------------- Herramientas / Tools -- */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={openDropdown}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              onClick={() => setToolsOpen((value) => !value)}
              aria-expanded={toolsOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1.5 transition hover:text-white ${
                isToolsRoute || toolsOpen ? "text-white" : "text-slate-400"
              }`}
            >
              {t("nav.tools")}
              <FiChevronDown
                className={`text-xs transition-transform ${toolsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {toolsOpen && (
              <div className="absolute left-1/2 top-full z-50 w-[min(92vw,720px)] -translate-x-1/2 pt-4">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1017] shadow-2xl shadow-black/60">
                  <div className="grid gap-6 p-6 sm:grid-cols-3">
                    {groups.map(({ category, tools }) => (
                      <div key={category}>
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">
                          {t(`tools.categories.${category}`)}
                        </p>
                        <ul className="space-y-1">
                          {tools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                              <li key={tool.slug}>
                                <Link
                                  to={toolPath(tool.slug)}
                                  onClick={() => setToolsOpen(false)}
                                  className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
                                >
                                  <Icon className="mt-0.5 shrink-0 text-base text-[#00A3FE]" />
                                  <span className="text-sm leading-5">
                                    {t(`tools.items.${tool.key}.name`)}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/herramientas"
                    onClick={() => setToolsOpen(false)}
                    className="flex items-center justify-between border-t border-white/10 bg-white/[.02] px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/[.05]"
                  >
                    {t("tools.seeAll")} <FiArrowUpRight />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <NavLink to="/login" className={navClass}>
            {t("nav.login")}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link
            to="/solicitar-proyecto"
            className="hidden items-center gap-2 rounded-full bg-[#002EFD] px-5 py-2.5 text-sm font-semibold hover:bg-[#00A3FE] sm:flex"
          >
            {t("nav.startProject")} <FiArrowUpRight />
          </Link>
          <button
            className="rounded-lg p-2 text-xl md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={t("nav.menu")}
          >
            {open ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- móvil -- */}
      {open && (
        <nav className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-white/10 px-5 py-5 md:hidden">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="block border-b border-white/5 py-3 text-slate-300"
            >
              {label}
            </NavLink>
          ))}

          <div className="border-b border-white/5">
            <button
              type="button"
              onClick={() => setMobileToolsOpen((value) => !value)}
              className="flex w-full items-center justify-between py-3 text-left text-slate-300"
              aria-expanded={mobileToolsOpen}
            >
              {t("nav.tools")}
              <FiChevronDown
                className={`transition-transform ${mobileToolsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {mobileToolsOpen && (
              <div className="pb-4">
                {groups.map(({ category, tools }) => (
                  <div key={category} className="mb-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">
                      {t(`tools.categories.${category}`)}
                    </p>
                    <ul className="space-y-1">
                      {tools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <li key={tool.slug}>
                            <Link
                              to={toolPath(tool.slug)}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-2.5 rounded-lg py-2 text-sm text-slate-400"
                            >
                              <Icon className="text-[#00A3FE]" />
                              {t(`tools.items.${tool.key}.name`)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <Link
                  to="/herramientas"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00A3FE]"
                >
                  {t("tools.seeAll")} <FiArrowUpRight />
                </Link>
              </div>
            )}
          </div>

          <NavLink
            to="/login"
            onClick={() => setOpen(false)}
            className="block border-b border-white/5 py-3 text-slate-300"
          >
            {t("nav.login")}
          </NavLink>

          <Link
            to="/solicitar-proyecto"
            onClick={() => setOpen(false)}
            className="mt-5 block rounded-full bg-[#002EFD] px-5 py-3 text-center font-semibold"
          >
            {t("nav.startProject")}
          </Link>
        </nav>
      )}
    </header>
  );
};

export default Header;
