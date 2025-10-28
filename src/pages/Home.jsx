import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../layouts/Layout";
import AOS from "aos";
import "aos/dist/aos.css";
import { Link, useNavigate } from "react-router-dom";

const Home = () => {
  const { t } = useTranslation();
  const apiUrl = "https://fakestoreapi.com";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentService, setCurrentService] = useState(0);
  const [publicProjects, setPublicProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({ once: true, duration: 800 });
    fetchPublicProjects();
  }, []);

  const fetchPublicProjects = async () => {
    setProjectsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/public/projects`
      );
      if (response.ok) {
        const data = await response.json();
        setPublicProjects(
          Array.isArray(data.data) ? data.data : data.projects || []
        );
      }
    } catch (error) {
      console.error("Error fetching public projects:", error);
      setPublicProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const emailHandleEvent = (event) => {
    setEmail(event.target.value);
  };

  const sendForm = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, description }),
      });
      if (response.ok) {
        alert("Mensaje enviado exitosamente");
        setName("");
        setEmail("");
        setDescription("");
      } else {
        alert("Error al enviar el mensaje");
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const services = [
    {
      title: "Desarrollo Web",
      description:
        "Creamos sitios web modernos, responsivos y escalables con las últimas tecnologías.",
      icon: "🌐",
    },
    {
      title: "Desarrollo Móvil",
      description:
        "Aplicaciones nativas y híbridas para iOS y Android con experiencia de usuario excepcional.",
      icon: "📱",
    },
    {
      title: "Consultoría Tecnológica",
      description:
        "Asesoramiento experto para optimizar procesos y elegir las mejores soluciones.",
      icon: "💡",
    },
  ];

  const projects = [
    {
      name: "E-commerce App",
      tech: "React, Node.js",
      image: "https://via.placeholder.com/300x200",
    },
    {
      name: "Sistema de Gestión",
      tech: "Vue.js, Laravel",
      image: "https://via.placeholder.com/300x200",
    },
    {
      name: "App Móvil Fitness",
      tech: "React Native",
      image: "https://via.placeholder.com/300x200",
    },
  ];

  const testimonials = [
    {
      name: "Juan Pérez",
      company: "TechCorp",
      text: "Appsline transformó nuestro negocio con una app increíble.",
    },
    {
      name: "María López",
      company: "StartupXYZ",
      text: "Profesionales y entregas a tiempo. Recomendados al 100%.",
    },
  ];

  const faqs = [
    {
      question: "¿Cuánto tiempo toma un proyecto?",
      answer: "Depende de la complejidad, pero generalmente 4-12 semanas.",
    },
    {
      question: "¿Ofrecen soporte post-lanzamiento?",
      answer: "Sí, incluimos mantenimiento y soporte continuo.",
    },
  ];

  return (
    <Layout title={t("nav.home")}>
      {/* Hero Section - Estilo moderno */}
      <section className="relative bg-gradient-to-br from-[#f0f1ff] to-[#e0e5ff] min-h-screen overflow-hidden">
        {/* Elementos decorativos */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[10%] left-[5%] w-4 h-4 rounded-full bg-app-two opacity-60"></div>
          <div className="absolute top-[15%] right-[20%] w-6 h-6 rounded-full border border-app-two"></div>
          <div className="absolute top-[50%] left-[10%] w-8 h-8 rounded-full border-2 border-red-500"></div>
          <div className="absolute bottom-[30%] left-[20%] w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="absolute bottom-[20%] right-[10%] w-5 h-5 rounded-full bg-blue-500 opacity-30"></div>

          {/* Línea ondulada */}
          <svg
            className="absolute bottom-[25%] left-[45%]"
            width="100"
            height="20"
            viewBox="0 0 100 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 10C20 20, 40 0, 60 10C80 20, 100 0, 120 10"
              stroke="#3b82f6"
              strokeWidth="2"
            />
          </svg>

          {/* Círculo decorativo */}
          <div className="absolute top-[20%] left-[30%] w-40 h-40 rounded-full border border-dashed border-app-three opacity-20"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center min-h-screen">
          <div
            className="md:w-1/2 pt-20 md:pt-0 text-left"
            data-aos="fade-right"
          >
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-md mb-6">
              <div className="w-4 h-4 rounded-full bg-app-two mr-2"></div>
              <span className="text-xs font-medium text-gray-700">
                BEST WEB & MOBILE DEVELOPMENT
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 text-gray-900">
              {t("home.heroTitle")}
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-xl">
              {t("home.heroSubtitle")}
            </p>

            <div className="flex space-x-4">
              <button className="bg-app-two hover:bg-app-one text-white px-8 py-4 rounded-lg font-semibold transition-all flex items-center shadow-lg">
                {t("home.services")}
                <svg
                  className="ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
              </button>
              <button className="border border-app-two text-app-two px-8 py-4 rounded-lg font-semibold hover:bg-app-two hover:text-white transition-all">
                {t("home.contact")}
              </button>
            </div>
          </div>

          <div className="md:w-1/2 mt-12 md:mt-0" data-aos="fade-left">
            {/* Imagen del profesional con fondo curvo */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-app-one via-app-two to-app-three rounded-bl-[30%] rounded-tr-[30%]"></div>
              <img
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8OHx8cHJvZmVzc2lvbmFsJTIwbWFufGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=600&q=60"
                alt="Professional Developer"
                className="relative z-10 rounded-bl-[20%] rounded-tr-[20%] object-cover h-full w-full max-h-[600px]"
              />
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-yellow-300 rounded-full opacity-70"></div>
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-app-three rounded-full opacity-70"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Barra inferior con tecnologías - Ancho completo */}
      <div className="w-full bg-app-two text-white py-4 overflow-hidden">
        <div className="marquee-container">
          <div className="marquee-content">
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Technology
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">Business</span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              IT Solution
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Technology
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Work Process
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">Business</span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="marquee-content">
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Technology
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">Business</span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              IT Solution
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Technology
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">
              Work Process
            </span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="mx-4 text-xl md:text-2xl font-bold">Business</span>
            <svg
              className="inline-block w-6 h-6 mx-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Nueva Sección: Carrusel de Proyectos */}
      <section className="py-16 bg-gray-50" data-aos="fade-up">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-app-one mb-4">
              Proyectos que hemos realizado
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Conoce algunos de los proyectos en los que hemos trabajado y la
              confianza que nuestros clientes han depositado en nosotros.
            </p>
          </div>

          {projectsLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-two"></div>
            </div>
          ) : publicProjects.length > 0 ? (
            <div className="relative overflow-hidden">
              {/* Carrusel infinito */}
              <div className="flex animate-scroll">
                {/* Primera serie de logos */}
                <div className="flex space-x-8 min-w-full">
                  {publicProjects.map((project, index) => (
                    <div
                      key={`first-${project.id || index}`}
                      className="flex-shrink-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-100"
                      style={{ width: "250px", height: "180px" }}
                    >
                      {project.logo ? (
                        <img
                          src={project.logo}
                          alt={project.name || `Proyecto ${index + 1}`}
                          className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-app-one/10 to-app-two/10 rounded-lg">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-app-one mb-1">
                              {project.client_name
                                ? project.client_name
                                    .substring(0, 2)
                                    .toUpperCase()
                                : "PR"}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {project.client_name ||
                                project.name ||
                                "Proyecto"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gradientes para fade effect */}
              <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none"></div>
              <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none"></div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-gray-500">
                Próximamente mostraremos nuestros proyectos destacados
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Servicios Section */}
      <section className="py-16 bg-white" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-app-one">
            Nuestros Servicios
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <div
                key={index}
                className="bg-gray-50 p-6 rounded-lg shadow hover:shadow-lg transition"
                data-aos="zoom-in"
              >
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-app-one">
                  {service.title}
                </h3>
                <p className="text-gray-600">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Nosotros con Tecnologías */}
      <section className="py-16 bg-gray-100" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4 text-app-one">
                Sobre Appsline
              </h2>
              <p className="text-gray-600 mb-4">
                Somos una empresa dedicada al desarrollo de software innovador.
                Con años de experiencia en web y móvil, ayudamos a empresas a
                digitalizarse y crecer.
              </p>
              <ul className="space-y-2 text-gray-600">
                <li>✓ Equipo experto en tecnologías modernas</li>
                <li>✓ Enfoque en calidad y escalabilidad</li>
                <li>✓ Soporte continuo y mantenimiento</li>
              </ul>
            </div>
            <div className="bg-app-two p-8 rounded-lg text-white">
              <h3 className="text-2xl font-bold mb-4">Nuestra Misión</h3>
              <p>
                Crear soluciones tecnológicas que simplifiquen la vida de
                nuestros clientes y impulsen su éxito.
              </p>
            </div>
          </div>

          {/* Nueva sección de tecnologías */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-8 text-app-one">
              Tecnologías que dominamos
            </h3>

            {/* Contenedor de tecnologías con animación */}
            <div
              className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-12 min-h-[400px] overflow-hidden group"
              style={{ perspective: "1000px" }}
            >
              {/* Tecnologías flotantes animadas */}
              <div className="tech-floating-container">
                {/* React */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "0s",
                    "--x": "10%",
                    "--y": "20%",
                    "--duration": "8s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"
                      alt="React"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* Node.js */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "1s",
                    "--x": "70%",
                    "--y": "15%",
                    "--duration": "10s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg"
                      alt="Node.js"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* Python */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "2s",
                    "--x": "80%",
                    "--y": "60%",
                    "--duration": "9s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg"
                      alt="Python"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* TypeScript */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "0.5s",
                    "--x": "20%",
                    "--y": "70%",
                    "--duration": "11s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg"
                      alt="TypeScript"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* Next.js */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "3s",
                    "--x": "50%",
                    "--y": "10%",
                    "--duration": "7s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg"
                      alt="Next.js"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* MongoDB */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "1.5s",
                    "--x": "5%",
                    "--y": "50%",
                    "--duration": "12s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg"
                      alt="MongoDB"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* Docker */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "4s",
                    "--x": "75%",
                    "--y": "35%",
                    "--duration": "6s",
                  }}
                >
                  <div className="flex flex-col items-center p-4  rounded-xl transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg"
                      alt="Docker"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* Flutter */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "2.5s",
                    "--x": "40%",
                    "--y": "80%",
                    "--duration": "9s",
                  }}
                >
                  <div className="flex flex-col items-center p-4 transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flutter/flutter-original.svg"
                      alt="Flutter"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* AWS */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "3.5s",
                    "--x": "60%",
                    "--y": "25%",
                    "--duration": "10s",
                  }}
                >
                  <div className="flex flex-col items-center p-4 transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original.svg"
                      alt="AWS"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>

                {/* PostgreSQL */}
                <div
                  className="tech-item"
                  style={{
                    "--delay": "5s",
                    "--x": "25%",
                    "--y": "40%",
                    "--duration": "8s",
                  }}
                >
                  <div className="flex flex-col items-center p-4 transition-all duration-300 transform hover:scale-110">
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg"
                      alt="PostgreSQL"
                      className="w-16 h-16 mb-2"
                    />
                  </div>
                </div>
              </div>

              {/* Overlay con texto central */}
              <div className="absolute hidden inset-0  items-center justify-center pointer-events-none">
                <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                  <h4 className="text-2xl font-bold text-gray-800 mb-2">
                    Stack Tecnológico Moderno
                  </h4>
                  <p className="text-gray-600">
                    Utilizamos las mejores herramientas del mercado
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Nueva sección: Proyectos Destacados */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-8 text-app-one">
              Proyectos Destacados
            </h3>

            {projectsLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-two"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-8">
                {publicProjects
                  .filter(
                    (project) =>
                      project.name &&
                      ["Cumbre Salvaje", "Acoman", "Yummi"].includes(
                        project.name
                      )
                  )
                  .slice(0, 3)
                  .map((project, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg overflow-hidden shadow hover:shadow-lg transition group"
                      data-aos="zoom-in"
                    >
                      <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-6">
                        {project.logo ? (
                          <img
                            src={project.logo}
                            alt={project.name}
                            className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-app-one/10 to-app-two/10 rounded-lg">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-app-one mb-2">
                                {project.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="text-sm text-gray-600">
                                {project.name}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-6 flex flex-col justify-between items-center">
                        <h3 className="text-xl font-bold text-app-one mb-2">
                          {project.name}
                        </h3>
                        <div className="flex justify-center items-center text-sm text-app-two font-medium text-center">
                          <Link
                            href={project.link}
                            className="flex px-4 py-3 text-white bg-app-one rounded-full items-center"
                          >
                            <svg
                              className="w-4 h-4 mr-2"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Ver Proyecto
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-16 bg-gray-100" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-app-one">
            Lo que dicen nuestros clientes
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-lg shadow"
                data-aos="fade-right"
              >
                <p className="text-gray-600 mb-4">"{testimonial.text}"</p>
                <div className="font-bold text-app-one">{testimonial.name}</div>
                <div className="text-gray-500">{testimonial.company}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white" data-aos="fade-up">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-app-one">
            Preguntas Frecuentes
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
                data-aos="fade-up"
              >
                <h3 className="font-bold text-app-one mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nueva Sección: Call to Action para Videollamada */}
      <section
        className="py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden"
        data-aos="fade-up"
      >
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-app-two/5"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-app-one/5"></div>
          <div className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full bg-app-three"></div>
          <div className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full bg-app-two"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Contenido principal */}
            <div className="space-y-8">
              {/* Badge premium */}
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-app-one to-app-two text-white text-sm font-semibold shadow-lg">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
                CONSULTA GRATUITA DISPONIBLE
              </div>

              <div className="space-y-6">
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Convierte tus{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-app-one to-app-two">
                    ideas en realidad
                  </span>
                </h2>

                <p className="text-xl text-gray-600 leading-relaxed">
                  ¿Tienes una idea brillante pero no sabes por dónde empezar?
                  Agenda una videollamada gratuita de 30 minutos con nuestros
                  expertos y descubre cómo transformar tu visión en una solución
                  digital exitosa.
                </p>

                {/* Beneficios */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Análisis técnico personalizado
                      </h4>
                      <p className="text-gray-600">
                        Evaluamos la viabilidad técnica de tu proyecto y te
                        damos recomendaciones específicas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Estimación de costos y tiempos
                      </h4>
                      <p className="text-gray-600">
                        Conoce el presupuesto real y los plazos de desarrollo de
                        tu proyecto.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Hoja de ruta estratégica
                      </h4>
                      <p className="text-gray-600">
                        Te ayudamos a definir las fases de desarrollo y
                        priorizar funcionalidades clave.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button
                    onClick={() => navigate("/solicitar-proyecto")}
                    className="group bg-gradient-to-r from-app-one to-app-two text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
                  >
                    <svg
                      className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Agendar Videollamada Gratuita
                  </button>
                </div>

                {/* Testimonial rápido */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                  <div className="flex items-start space-x-4">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&q=80"
                      alt="Cliente satisfecho"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-gray-700 italic">
                        "En solo 30 minutos entendieron perfectamente mi idea y
                        me dieron un plan claro para desarrollarla. ¡Increíble!"
                      </p>
                      <div className="mt-2">
                        <p className="font-semibold text-gray-900">
                          Carlos Mendoza
                        </p>
                        <p className="text-sm text-gray-500">
                          CEO, TechStartup
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Imagen/Video mockup */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-app-one/10 to-app-two/10 rounded-3xl p-8 backdrop-blur-sm">
                {/* Mockup de videollamada */}
                <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="bg-gray-800 px-4 py-3 flex items-center space-x-2">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-gray-300 text-sm">
                        Videollamada con Appsline
                      </span>
                    </div>
                  </div>

                  <div className="aspect-video bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center relative">
                    <img
                      src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&q=80"
                      alt="Equipo en videollamada"
                      className="rounded-lg object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-4 shadow-lg">
                        <svg
                          className="w-8 h-8 text-app-one"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Elementos decorativos flotantes */}
                <div className="absolute -top-4 -right-4 bg-app-three rounded-full p-3 shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-app-two rounded-full p-3 shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
              </div>

              {/* Stats flotantes */}
              <div className="absolute top-8 -left-8 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-app-one">500+</div>
                  <div className="text-sm text-gray-600">
                    Proyectos exitosos
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 -right-8 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-app-two">98%</div>
                  <div className="text-sm text-gray-600">Satisfacción</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section className="py-16 bg-app-one text-white" data-aos="fade-up">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Contáctanos</h2>
          <form
            className="grid md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendForm();
            }}
          >
            <input
              type="text"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-3 rounded-lg text-black"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={emailHandleEvent}
              className="p-3 rounded-lg text-black"
              required
            />
            <textarea
              placeholder="Descripción del proyecto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="p-3 rounded-lg text-black md:col-span-2"
              rows="4"
              required
            />
            <button
              type="submit"
              className="bg-app-three text-app-one px-6 py-3 rounded-lg font-semibold hover:bg-white transition md:col-span-2"
              disabled={loading}
            >
              {loading ? "Enviando..." : "Enviar Mensaje"}
            </button>
          </form>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
