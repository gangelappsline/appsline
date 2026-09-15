import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiCloud, FiCode, FiCompass, FiPenTool, FiSettings, FiSmartphone } from "react-icons/fi";
import Layout from "../layouts/Layout";

const WhatWeDo = () => {
  const { t } = useTranslation();
  const services = [
    ["web", FiCode, ["React", "Laravel", "Node.js"]], ["mobile", FiSmartphone, ["iOS", "Android", "Flutter"]],
    ["design", FiPenTool, ["UX Research", "UI Design", "Prototyping"]], ["consulting", FiCompass, ["Discovery", "Roadmap", "Architecture"]],
    ["cloud", FiCloud, ["AWS", "DevOps", "CI/CD"]], ["support", FiSettings, ["QA", "Analytics", "Evolution"]],
  ];
  return <Layout title={t("whatWeDo.pageTitle")}><div className="bg-[#080a0f] text-white">
    <section className="relative overflow-hidden border-b border-white/10 px-5 py-24 lg:py-36"><div className="absolute left-1/2 top-0 h-96 w-96 rounded-full bg-[#0060FC]/10 blur-3xl"/><div className="relative mx-auto max-w-7xl"><p className="section-kicker">{t("whatWeDo.eyebrow")}</p><h1 className="max-w-5xl text-5xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-7xl">{t("whatWeDo.heroTitle")} <span className="text-[#00A3FE]">{t("whatWeDo.heroAccent")}</span></h1><p className="mt-8 max-w-2xl text-xl leading-8 text-slate-400">{t("whatWeDo.heroText")}</p></div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32"><div className="mb-14 grid gap-8 lg:grid-cols-2 lg:items-end"><div><p className="section-kicker">{t("whatWeDo.servicesEyebrow")}</p><h2 className="section-title">{t("whatWeDo.servicesTitle")}</h2></div><p className="text-lg leading-8 text-slate-400">{t("whatWeDo.servicesIntro")}</p></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map(([key, Icon, tags], index) => <article key={key} className="rounded-3xl border border-white/10 bg-white/[.025] p-7 transition hover:border-[#002EFD]/40"><div className="flex justify-between"><Icon className="text-3xl text-[#00A3FE]"/><span className="text-sm text-slate-600">0{index+1}</span></div><h3 className="mt-9 text-2xl font-semibold">{t(`whatWeDo.services.${key}.title`)}</h3><p className="mt-4 leading-7 text-slate-400">{t(`whatWeDo.services.${key}.text`)}</p><div className="mt-7 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{tag}</span>)}</div></article>)}</div></section>
    <section className="border-y border-white/10 bg-[#0d1017]"><div className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="section-kicker">{t("whatWeDo.methodEyebrow")}</p><h2 className="section-title">{t("whatWeDo.methodTitle")}</h2></div><div className="grid gap-5 sm:grid-cols-2">{["discover","define","create","improve"].map((key,index)=><div key={key} className="border-l border-[#002EFD]/50 pl-6 py-2"><span className="text-xs font-bold text-[#00A3FE]">0{index+1}</span><h3 className="mt-3 text-xl font-semibold">{t(`whatWeDo.method.${key}.title`)}</h3><p className="mt-2 text-slate-400">{t(`whatWeDo.method.${key}.text`)}</p></div>)}</div></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 text-center lg:px-8 lg:py-32"><h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">{t("whatWeDo.ctaTitle")}</h2><p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">{t("whatWeDo.ctaText")}</p><Link to="/solicitar-proyecto" className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#002EFD] px-7 py-4 font-semibold">{t("nav.startProject")} <FiArrowUpRight/></Link></section>
  </div></Layout>;
};
export default WhatWeDo;
