import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight } from "react-icons/fi";
import Mark from "../assets/images/appsline_logo_2x-no_background.png";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/10 bg-[#080a0f] text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          <div><Link to="/" className="flex items-center gap-3"><img src={Mark} className="h-10 w-11 object-contain" alt=""/><span className="text-2xl font-bold">Appsline</span></Link><p className="mt-4 max-w-sm text-slate-400">{t("footer.tagline")}</p></div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 md:justify-end">
            <Link to="/about-us" className="text-slate-300 hover:text-white">{t("nav.about")}</Link>
            <Link to="/what-we-do" className="text-slate-300 hover:text-white">{t("nav.whatWeDo")}</Link>
            <Link to="/portfolio" className="text-slate-300 hover:text-white">{t("nav.projects")}</Link>
            <Link to="/solicitar-proyecto" className="flex items-center gap-1 text-[#ff6a83]">{t("nav.startProject")} <FiArrowUpRight/></Link>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Appsline.</span><span>{t("footer.rights")}</span></div>
      </div>
    </footer>
  );
};
export default Footer;
