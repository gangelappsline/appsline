import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiExternalLink } from "react-icons/fi";
import AOS from "aos";
import "aos/dist/aos.css";
import Layout from "../layouts/Layout";
import Acoman1 from "../assets/images/portfolio/acoman/1.png";
import Mexspacio1 from "../assets/images/portfolio/mexspacio/1.png";

const projects = [
  {
    id: 1,
    title: "Acoman",
    category: "web",
    year: "2024",
    description:
      "Plataforma de comercio electrónico completa con carrito de compras, pagos integrados y panel de administración.",
    technologies: ["React", "Node.js", "MongoDB", "Stripe"],
    image: Acoman1,
    link: "#",
  },
  {
    id: 2,
    title: "Mexspacios Inmobiliarios",
    category: "web",
    year: "2024",
    description: "Aplicación web para la gestión de propiedades inmobiliarias.",
    technologies: ["React", "PHP", "MySQL"],
    image: Mexspacio1,
    link: "https://mexspacioinmobiliarios.com.mx/",
  },
  {
    id: 3,
    title: "Caprichitos",
    category: "web",
    year: "2023",
    description:
      "Tienda de ropa de niños con catálogo de productos, sistema de pagos y gestión de inventario.",
    technologies: ["Vue.js", "Laravel", "MySQL"],
    image: null,
    link: "#",
  },
  {
    id: 4,
    title: "F-lex Despacho Jurídico",
    category: "ecommerce",
    year: "2023",
    description:
      "Plataforma de comercio electrónico para servicios legales con reservas en línea y pagos seguros.",
    technologies: ["Next.js", "Tailwind CSS", "PostgreSQL"],
    image: null,
    link: "#",
  },
  {
    id: 5,
    title: "Food Delivery",
    category: "mobile",
    year: "2023",
    description:
      "Aplicación para pedidos de comida a domicilio con geolocalización y seguimiento en tiempo real.",
    technologies: ["Flutter", "Dart", "Google Maps API"],
    image: null,
    link: "#",
  },
  {
    id: 6,
    title: "Western Pacific RE",
    category: "web",
    year: "2022",
    description:
      "Plataforma de gestión de bienes raíces con listados, búsqueda avanzada y contacto de agentes.",
    technologies: ["Angular", "Express.js", "MongoDB"],
    image: null,
    link: "#",
  },
];

const categories = [
  { key: "all", label: "Todos" },
  { key: "web", label: "Web" },
  { key: "mobile", label: "Móvil" },
  { key: "ecommerce", label: "E-commerce" },
];

const stats = [
  ["50+", "Proyectos entregados"],
  ["10+", "Años de experiencia"],
  ["98%", "Clientes que repiten"],
  ["6", "Industrias atendidas"],
];

/* eslint-disable react/prop-types */
/** Placeholder de marca para los proyectos que aún no tienen captura. */
const ProjectPlaceholder = ({ title }) => (
  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(0,163,254,.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(0,46,253,.3),transparent_55%)]">
    <div className="absolute inset-0 opacity-[.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:32px_32px]" />
    <span className="relative text-2xl font-semibold tracking-tight text-white/80">
      {title}
    </span>
  </div>
);

const Portfolio = () => {
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    AOS.init({ once: true, duration: 700, offset: 60 });
  }, []);

  const filteredProjects = useMemo(
    () =>
      filter === "all"
        ? projects
        : projects.filter((p) => p.category === filter),
    [filter]
  );

  const countFor = (key) =>
    key === "all"
      ? projects.length
      : projects.filter((p) => p.category === key).length;

  return (
    <Layout title="Portafolio">
      <div className="bg-ink-1000 text-white">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden border-b border-white/10 px-5 py-24 lg:px-8 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(0,96,252,.18),transparent_45%),radial-gradient(circle_at_10%_80%,rgba(0,163,254,.12),transparent_40%)]" />
          <div className="absolute inset-0 opacity-[.05] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative mx-auto max-w-7xl" data-aos="fade-up">
            <p className="section-kicker">Portafolio</p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-7xl">
              Proyectos que{" "}
              <span className="brand-text-gradient">generan resultados</span>
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-8 text-slate-400">
              Una selección de productos digitales que hemos diseñado y
              construido: plataformas web, apps móviles y experiencias de
              e-commerce pensadas para escalar.
            </p>

            <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {stats.map(([value, label]) => (
                <div key={label} className="bg-ink-1000 px-5 py-6">
                  <dt className="text-3xl font-semibold tracking-tight text-white">
                    {value}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-400">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------- Filtros + grid ---------- */}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div
            className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
            data-aos="fade-up"
          >
            <div>
              <p className="section-kicker">Casos de éxito</p>
              <h2 className="section-title">Nuestro trabajo reciente</h2>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist">
              {categories.map((cat) => {
                const active = filter === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(cat.key)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      active
                        ? "bg-brand-700 text-white shadow-brand-sm"
                        : "border border-white/10 bg-white/[.03] text-slate-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`ml-2 text-xs ${
                        active ? "text-white/70" : "text-slate-600"
                      }`}
                    >
                      {countFor(cat.key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const isExternal = project.link && project.link !== "#";
              return (
                <article
                  key={project.id}
                  data-aos="fade-up"
                  className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[.025] transition duration-300 hover:-translate-y-1.5 hover:border-brand-500/40 hover:bg-white/[.05] hover:shadow-brand"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink-950">
                    {project.image ? (
                      <img
                        src={project.image}
                        alt={`Vista previa de ${project.title}`}
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <ProjectPlaceholder title={project.title} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-1000 via-ink-1000/10 to-transparent opacity-80" />
                    <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-200 backdrop-blur">
                      {project.category}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold tracking-tight text-white">
                        {project.title}
                      </h3>
                      <span className="shrink-0 pt-1 text-xs text-slate-500">
                        {project.year}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-7 text-slate-400">
                      {project.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    <a
                      href={project.link}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer noopener" : undefined}
                      aria-disabled={!isExternal}
                      className={`mt-7 inline-flex items-center gap-2 text-sm font-semibold transition ${
                        isExternal
                          ? "text-brand-400 hover:gap-3 hover:text-white"
                          : "pointer-events-none text-slate-600"
                      }`}
                    >
                      {isExternal ? "Ver proyecto" : "Caso privado"}
                      {isExternal && <FiExternalLink />}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredProjects.length === 0 && (
            <p className="py-20 text-center text-slate-500">
              No hay proyectos en esta categoría todavía.
            </p>
          )}
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-32">
          <div
            className="flex flex-col items-start justify-between gap-8 rounded-[2rem] border border-brand-700/30 bg-brand-700/10 p-8 sm:p-12 lg:flex-row lg:items-center"
            data-aos="fade-up"
          >
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                ¿Tienes un proyecto en mente?
              </h2>
              <p className="mt-3 max-w-xl text-slate-400">
                Hablemos de cómo podemos ayudarte a construir algo increíble.
              </p>
            </div>
            <Link to="/solicitar-proyecto" className="btn-brand shrink-0">
              Iniciar proyecto <FiArrowUpRight />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Portfolio;
