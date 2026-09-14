import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiMenu, FiX } from "react-icons/fi";
import Mark from "../assets/images/appsline_logo_2x-no_background.png";
import LanguageSelector from "./LanguageSelector";

const Header = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const links = [
    ["/", t("nav.home")],
    ["/about-us", t("nav.about")],
    ["/what-we-do", t("nav.whatWeDo")],
    ["/portfolio", t("nav.projects")],
  ];
  const navClass = ({ isActive }) =>
    `transition hover:text-white ${isActive ? "text-white" : "text-slate-400"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0f]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Appsline">
          <img src={Mark} alt="" className="h-9 w-10 object-contain" />
          <span className="text-xl font-bold tracking-tight">Appsline</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {links.map(([to, label]) => <NavLink key={to} to={to} className={navClass}>{label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link to="/solicitar-proyecto" className="hidden items-center gap-2 rounded-full bg-[#ff365d] px-5 py-2.5 text-sm font-semibold hover:bg-[#ff5372] sm:flex">
            {t("nav.startProject")} <FiArrowUpRight />
          </Link>
          <button className="rounded-lg p-2 text-xl md:hidden" onClick={() => setOpen(!open)} aria-label={t("nav.menu")}>
            {open ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 px-5 py-5 md:hidden">
          {links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className="block border-b border-white/5 py-3 text-slate-300">{label}</NavLink>)}
          <Link to="/solicitar-proyecto" className="mt-5 block rounded-full bg-[#ff365d] px-5 py-3 text-center font-semibold">{t("nav.startProject")}</Link>
        </nav>
      )}
    </header>
  );
};

export default Header;
