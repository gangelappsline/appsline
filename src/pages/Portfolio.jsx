import { useEffect, useState } from "react";
import Layout from "../layouts/Layout";
import AOS from 'aos';
import 'aos/dist/aos.css';
import Acoman1 from "../assets/images/portfolio/acoman/1.png";
import Mexspacio1 from "../assets/images/portfolio/mexspacio/1.png";

const Portfolio = () => {
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    AOS.init({ once: true, duration: 800 });
  }, []);

  const projects = [
    {
      id: 1,
      title: "Acoman",
      category: "web",
      description: "Plataforma de comercio electrónico completa con carrito de compras, pagos integrados y panel de administración.",
      technologies: ["React", "Node.js", "MongoDB", "Stripe"],
      image: Acoman1,
      link: "#",
    },
    {
      id: 2,
      title: "Mexspacios Inmobiliarios",
      category: "web",
      description: "Aplicación web para la gestión de propiedades inmobiliarias.",
      technologies: ["React", "PHP", "MySQL"],
      image: Mexspacio1,
      link: "https://mexspacioinmobiliarios.com.mx/",
    },
    {
      id: 3,
      title: "Caprichitos",
      category: "web",
      description: "Tienda de ropa de niños con catálogo de productos, sistema de pagos y gestión de inventario.",
      technologies: ["Vue.js", "Laravel", "MySQL"],
      image: "https://via.placeholder.com/400x250",
      link: "#",
    },
    {
      id: 4,
      title: "F-lex Despacho Juridico",
      category: "ecommerce",
      description: "Plataforma de comercio electrónico para servicios legales con reservas en línea y pagos seguros.",
      technologies: ["Next.js", "Tailwind CSS", "PostgreSQL"],
      image: "https://via.placeholder.com/400x250",
      link: "#",
    },
    {
      id: 5,
      title: "Food Delivery",
      category: "mobile",
      description: "Aplicación para pedidos de comida a domicilio con geolocalización y seguimiento en tiempo real.",
      technologies: ["Flutter", "Dart", "Google Maps API"],
      image: "https://via.placeholder.com/400x250",
      link: "#",
    },
    {
      id: 6,
      title: "Western Pacific RE",
      category: "web",
      description: "Plataforma de gestión de bienes raíces con listados, búsqueda avanzada y contacto de agentes.",
      technologies: ["Angular", "Express.js", "MongoDB"],
      image: "https://via.placeholder.com/400x250",
      link: "#",
    },
  ];

  const filteredProjects = filter === "all" ? projects : projects.filter(p => p.category === filter);

  const categories = [
    { key: "all", label: "Todos" },
    { key: "web", label: "Web" },
    { key: "mobile", label: "Móvil" },
    { key: "ecommerce", label: "E-commerce" },
  ];

  return (
    <Layout title="Portafolio">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-app-one via-app-two to-app-three text-white min-h-[50vh] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto" data-aos="fade-up">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Nuestro Portafolio
          </h1>
          <p className="text-lg md:text-2xl mb-8 opacity-90">
            Descubre ejemplos de nuestros proyectos en desarrollo web y móvil. Soluciones innovadoras que impulsan el éxito de nuestros clientes.
          </p>
        </div>
      </section>

      {/* Filtros */}
      <section className="py-8 bg-white" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  filter === cat.key
                    ? "bg-app-two text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-app-two hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid de Proyectos */}
      <section className="py-16 bg-gray-50" data-aos="fade-up">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                data-aos="zoom-in"
              >
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-app-one">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Tecnologías:</h4>
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech, index) => (
                        <span
                          key={index}
                          className="bg-app-two text-white text-xs px-2 py-1 rounded"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={project.link}
                    className="inline-block bg-app-three text-app-one px-4 py-2 rounded-lg font-semibold hover:bg-app-one hover:text-white transition"
                  >
                    Ver Proyecto
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 bg-app-two text-white text-center" data-aos="fade-up">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">¿Tienes un proyecto en mente?</h2>
          <p className="text-lg mb-8 opacity-90">
            Hablemos de cómo podemos ayudarte a crear algo increíble.
          </p>
          <a
            href="#contact"
            className="bg-app-three text-app-one px-8 py-3 rounded-lg font-semibold hover:bg-white transition"
          >
            Contactar Ahora
          </a>
        </div>
      </section>
    </Layout>
  );
};

export default Portfolio;