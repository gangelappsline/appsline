import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCode,
  FiLayers,
  FiSmartphone,
  FiZap,
} from "react-icons/fi";
import Layout from "../layouts/Layout";
import Mark from "../assets/images/new_appsline_icon.webp";

const Home = () => {
  const { t } = useTranslation();
  const services = [
    {
      icon: FiCode,
      title: t("home.servicesList.web.title"),
      text: t("home.servicesList.web.text"),
    },
    {
      icon: FiSmartphone,
      title: t("home.servicesList.mobile.title"),
      text: t("home.servicesList.mobile.text"),
    },
    {
      icon: FiLayers,
      title: t("home.servicesList.product.title"),
      text: t("home.servicesList.product.text"),
    },
  ];
  const steps = ["strategy", "design", "build", "scale"];

  return (
    <Layout title={t("nav.home")}>
      <div className="overflow-hidden bg-[#080a0f] text-white">
        <section className="relative min-h-[calc(100vh-5rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(1,88,255,.18),transparent_30%),radial-gradient(circle_at_15%_70%,rgba(89,66,255,.12),transparent_28%)]" />
          <div className="absolute inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-32">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[#001cbd] shadow-[0_0_16px_#001cbd]" />
                {t("home.eyebrow")}
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-8xl">
                {t("home.heroTitleStart")}{" "}
                <span className="bg-gradient-to-r from-[#001cbd] to-[#2e5bb6] bg-clip-text text-transparent">
                  {t("home.heroTitleAccent")}
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
                {t("home.heroSubtitle")}
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/solicitar-proyecto"
                  className="flex items-center justify-center gap-3 rounded-full bg-[#001cbd] px-7 py-4 font-semibold shadow-[0_15px_50px_rgba(1,88,255,.25)] transition hover:-translate-y-1 hover:bg-[#ff5572]"
                >
                  {t("home.primaryCta")} <FiArrowUpRight />
                </Link>
                <Link
                  to="/what-we-do"
                  className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-7 py-4 font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                >
                  {t("home.secondaryCta")} <FiArrowRight />
                </Link>
              </div>
            </div>
            <div className="relative mx-auto flex aspect-square w-full max-w-lg items-center justify-center">
              <div className="absolute inset-[5%] animate-pulse rounded-full border border-[#001cbd]/25" />
              <div className="absolute inset-[18%] rounded-full border border-dashed border-white/15" />
              <div className="absolute h-64 w-64 rounded-full bg-[#ff2952]/20 blur-3xl" />
              <div className="relative rounded-[3rem] border border-white/10 bg-white/[.04] p-12 shadow-2xl backdrop-blur-md">
                <img
                  src={Mark}
                  className="w-52 drop-shadow-[0_20px_45px_rgba(1,88,255,.35)]"
                  alt="Appsline"
                />
              </div>
              <div className="absolute right-0 top-[18%] rounded-2xl border border-white/10 bg-[#11141c]/90 px-5 py-4 text-sm shadow-xl">
                <span className="block text-2xl font-bold text-[#002EFD]">
                  10+
                </span>
                {t("home.years")}
              </div>
              <div className="absolute bottom-[12%] left-0 rounded-2xl border border-white/10 bg-[#11141c]/90 px-5 py-4 text-sm shadow-xl">
                <span className="block text-2xl font-bold">50+</span>
                {t("home.projects")}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0d1017] py-7">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-12 gap-y-4 px-5 text-sm font-semibold uppercase tracking-[.18em] text-slate-500">
            <span>React</span>
            <span>Laravel</span>
            <span>Flutter</span>
            <span>Node.js</span>
            <span>AWS</span>
            <span>UX/UI</span>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="section-kicker">{t("home.servicesEyebrow")}</p>
              <h2 className="section-title">{t("home.servicesTitle")}</h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-slate-400 lg:justify-self-end">
              {t("home.servicesIntro")}
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {services.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="group rounded-3xl border border-white/10 bg-white/[.025] p-7 transition hover:-translate-y-2 hover:border-[#001cbd]/50 hover:bg-white/[.05]"
              >
                <div className="mb-12 flex items-start justify-between">
                  <span className="rounded-2xl bg-[#001cbd]/10 p-4 text-2xl text-[#0158FF]">
                    <Icon />
                  </span>
                  <span className="text-sm text-slate-600">0{index + 1}</span>
                </div>
                <h3 className="text-2xl font-semibold">{title}</h3>
                <p className="mt-4 leading-7 text-slate-400">{text}</p>
                <Link
                  to="/what-we-do"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0158FF]"
                >
                  {t("home.learnMore")} <FiArrowUpRight />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0d1017]">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-2 lg:px-8 lg:py-32">
            <div>
              <p className="section-kicker">{t("home.processEyebrow")}</p>
              <h2 className="section-title">{t("home.processTitle")}</h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
                {t("home.processIntro")}
              </p>
            </div>
            <div>
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-6 border-t border-white/10 py-7"
                >
                  <span className="text-sm font-bold text-[#0158FF]">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {t(`home.steps.${step}.title`)}
                    </h3>
                    <p className="mt-2 text-slate-400">
                      {t(`home.steps.${step}.text`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#002EFD] to-[#c81754] px-7 py-16 text-center sm:px-12 lg:py-24">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[45px] border-white/10" />
            <FiZap className="mx-auto mb-6 text-3xl" />
            <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              {t("home.ctaTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
              {t("home.ctaText")}
            </p>
            <Link
              to="/solicitar-proyecto"
              className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 font-bold text-[#11131a] transition hover:scale-105"
            >
              {t("home.primaryCta")} <FiArrowUpRight />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};
export default Home;
