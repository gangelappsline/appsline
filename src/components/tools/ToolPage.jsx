/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiChevronRight, FiLock } from "react-icons/fi";
import Layout from "../../layouts/Layout";
import { TOOLS, getTool, toolPath } from "../../tools/registry";

/**
 * Carcasa común de todas las páginas de herramientas:
 * breadcrumb + encabezado + contenido + herramientas relacionadas.
 */
const ToolPage = ({ slug, children }) => {
  const { t } = useTranslation();
  const tool = getTool(slug);
  if (!tool) return null;

  const Icon = tool.icon;
  const name = t(`tools.items.${tool.key}.name`);
  const desc = t(`tools.items.${tool.key}.desc`);
  const intro = t(`tools.items.${tool.key}.intro`, { defaultValue: desc });

  const related = TOOLS.filter(
    (item) => item.slug !== tool.slug && item.category === tool.category,
  ).slice(0, 3);

  return (
    <Layout title={`${name} | ${t("tools.pageTitle")}`} description={desc}>
      <div className="bg-[#080a0f] text-white">
        {/* --------------------------------------------------------- hero -- */}
        <section className="relative overflow-hidden border-b border-white/10 px-5 py-14 lg:px-8 lg:py-20">
          <div className="absolute left-1/3 top-0 h-80 w-80 rounded-full bg-[#0060FC]/10 blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link to="/" className="transition hover:text-white">
                {t("nav.home")}
              </Link>
              <FiChevronRight className="text-xs" />
              <Link to="/herramientas" className="transition hover:text-white">
                {t("nav.tools")}
              </Link>
              <FiChevronRight className="text-xs" />
              <span className="text-slate-300">{name}</span>
            </nav>

            <div className="mt-8 flex items-start gap-5">
              <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[.04] text-3xl text-[#00A3FE] sm:flex">
                <Icon />
              </span>
              <div>
                <h1 className="text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">
                  {name}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">{intro}</p>
              </div>
            </div>

            <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-4 py-2 text-xs text-slate-400">
              <FiLock className="text-[#00A3FE]" /> {t("tools.ui.privacy")}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ contenido -- */}
        <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">{children}</section>

        {/* ---------------------------------------------------- relacionadas -- */}
        {related.length > 0 && (
          <section className="border-t border-white/10 bg-[#0d1017]">
            <div className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("tools.ui.related")}
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {related.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.slug}
                      to={toolPath(item.slug)}
                      className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:border-[#002EFD]/50"
                    >
                      <ItemIcon className="text-2xl text-[#00A3FE]" />
                      <h3 className="mt-4 font-semibold">
                        {t(`tools.items.${item.key}.name`)}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                        {t(`tools.items.${item.key}.desc`)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ cta -- */}
        <section className="mx-auto max-w-5xl px-5 py-16 text-center lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("tools.ui.ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">{t("tools.ui.ctaText")}</p>
          <Link
            to="/solicitar-proyecto"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#002EFD] px-7 py-3.5 font-semibold transition hover:bg-[#0060FC]"
          >
            {t("nav.startProject")} <FiArrowUpRight />
          </Link>
        </section>
      </div>
    </Layout>
  );
};

export default ToolPage;
