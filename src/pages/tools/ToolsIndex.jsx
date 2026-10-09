import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiSearch } from "react-icons/fi";
import Layout from "../../layouts/Layout";
import { TOOLS, TOOL_CATEGORIES, toolPath } from "../../tools/registry";
import { inputClass } from "../../components/tools/ToolUI";

const ToolsIndex = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      TOOLS.filter((tool) => {
        const matchesCategory = category === "all" || tool.category === category;
        if (!matchesCategory) return false;
        if (!normalized) return true;
        const haystack = `${t(`tools.items.${tool.key}.name`)} ${t(
          `tools.items.${tool.key}.desc`,
        )} ${tool.slug}`.toLowerCase();
        return haystack.includes(normalized);
      }),
    [normalized, category, t],
  );

  return (
    <Layout title={t("tools.pageTitle")} description={t("tools.heroText")}>
      <div className="bg-[#080a0f] text-white">
        <section className="relative overflow-hidden border-b border-white/10 px-5 py-24 lg:px-8 lg:py-32">
          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#0060FC]/10 blur-3xl" />
          <div className="relative mx-auto max-w-7xl">
            <p className="section-kicker">{t("tools.eyebrow")}</p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-7xl">
              {t("tools.heroTitle")} <span className="text-[#00A3FE]">{t("tools.heroAccent")}</span>
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-8 text-slate-400">{t("tools.heroText")}</p>

            <div className="mt-10 flex max-w-xl items-center gap-3 rounded-full border border-white/10 bg-white/[.03] px-5">
              <FiSearch className="text-lg text-slate-500" />
              <input
                className={`${inputClass} border-0 bg-transparent px-0 focus:ring-0`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("tools.searchPlaceholder")}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="mb-10 flex flex-wrap gap-2">
            {["all", ...TOOL_CATEGORIES].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-5 py-2 text-sm transition ${
                  category === item
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {item === "all" ? t("tools.all") : t(`tools.categories.${item}`)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-slate-500">{t("tools.noResults")}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.slug}
                    to={toolPath(tool.slug)}
                    className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[.025] p-7 transition hover:border-[#002EFD]/50 hover:bg-white/[.04]"
                  >
                    <div className="flex items-start justify-between">
                      <Icon className="text-3xl text-[#00A3FE]" />
                      <FiArrowUpRight className="text-xl text-slate-600 transition group-hover:text-white" />
                    </div>
                    <h2 className="mt-8 text-xl font-semibold">
                      {t(`tools.items.${tool.key}.name`)}
                    </h2>
                    <p className="mt-3 flex-1 leading-7 text-slate-400">
                      {t(`tools.items.${tool.key}.desc`)}
                    </p>
                    <span className="mt-6 inline-flex w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500">
                      {t(`tools.categories.${tool.category}`)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-white/10 bg-[#0d1017]">
          <div className="mx-auto max-w-7xl px-5 py-20 text-center lg:px-8">
            <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("tools.ui.ctaTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400">{t("tools.ui.ctaText")}</p>
            <Link
              to="/solicitar-proyecto"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#002EFD] px-7 py-4 font-semibold transition hover:bg-[#0060FC]"
            >
              {t("nav.startProject")} <FiArrowUpRight />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default ToolsIndex;
