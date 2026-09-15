import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiHeart, FiTarget, FiUsers, FiZap } from "react-icons/fi";
import Layout from "../layouts/Layout";

const AboutUs = () => {
  const { t } = useTranslation();
  const values = [
    { icon: FiZap, key: "innovation" }, { icon: FiHeart, key: "commitment" },
    { icon: FiUsers, key: "team" }, { icon: FiTarget, key: "impact" },
  ];
  return <Layout title={t("about.pageTitle")}><div className="bg-[#080a0f] text-white">
    <section className="relative overflow-hidden border-b border-white/10 px-5 py-24 lg:py-36"><div className="absolute right-[-10%] top-[-40%] h-[600px] w-[600px] rounded-full bg-[#ff2952]/10 blur-3xl"/><div className="relative mx-auto max-w-7xl"><p className="section-kicker">{t("about.eyebrow")}</p><h1 className="max-w-5xl text-5xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-7xl">{t("about.heroTitle")} <span className="text-[#ff5372]">{t("about.heroAccent")}</span></h1><p className="mt-8 max-w-2xl text-xl leading-8 text-slate-400">{t("about.heroText")}</p></div></section>
    <section className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-2 lg:px-8 lg:py-32"><div><p className="section-kicker">{t("about.storyEyebrow")}</p><h2 className="section-title">{t("about.storyTitle")}</h2></div><div className="space-y-6 text-lg leading-8 text-slate-400"><p>{t("about.storyOne")}</p><p>{t("about.storyTwo")}</p></div></section>
    <section className="border-y border-white/10 bg-[#0d1017]"><div className="mx-auto grid max-w-7xl gap-5 px-5 py-24 md:grid-cols-2 lg:px-8">{["mission", "vision"].map((key) => <article key={key} className="rounded-3xl border border-white/10 bg-white/[.03] p-8 sm:p-10"><span className="text-sm font-bold uppercase tracking-[.2em] text-[#ff5a77]">{t(`about.${key}.label`)}</span><h2 className="mt-5 text-3xl font-semibold">{t(`about.${key}.title`)}</h2><p className="mt-5 text-lg leading-8 text-slate-400">{t(`about.${key}.text`)}</p></article>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32"><p className="section-kicker">{t("about.valuesEyebrow")}</p><h2 className="section-title">{t("about.valuesTitle")}</h2><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{values.map(({icon: Icon,key}) => <article key={key} className="rounded-3xl border border-white/10 p-7"><Icon className="text-2xl text-[#ff5a77]"/><h3 className="mt-8 text-xl font-semibold">{t(`about.values.${key}.title`)}</h3><p className="mt-3 leading-7 text-slate-400">{t(`about.values.${key}.text`)}</p></article>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-32"><div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] border border-[#001cbd]/30 bg-[#001cbd]/10 p-8 sm:p-12 lg:flex-row lg:items-center"><div><h2 className="text-3xl font-semibold sm:text-4xl">{t("about.ctaTitle")}</h2><p className="mt-3 text-slate-400">{t("about.ctaText")}</p></div><Link to="/solicitar-proyecto" className="flex shrink-0 items-center gap-2 rounded-full bg-[#001cbd] px-7 py-4 font-semibold">{t("nav.startProject")} <FiArrowUpRight/></Link></div></section>
  </div></Layout>;
};
export default AboutUs;
