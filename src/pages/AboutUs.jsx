import { useEffect } from "react";
import Layout from "../layouts/Layout";
import AOS from 'aos';
import 'aos/dist/aos.css';

const AboutUs = () => {
  useEffect(() => {
    AOS.init({ once: true, duration: 800 });
  }, []);

  return (
    <Layout title="Sobre Nosotros">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-app-one via-app-two to-app-three text-white min-h-[60vh] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto" data-aos="fade-up">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Sobre Appsline
          </h1>
          <p className="text-lg md:text-2xl mb-8 opacity-90">
            Especialistas en desarrollo web y móvil, transformando ideas en soluciones tecnológicas innovadoras.
          </p>
        </div>
      </section>

      {/* Nuestra Historia */}
      <section className="py-16 bg-white" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-app-one">Nuestra Historia</h2>
              <p className="text-gray-600 mb-4">
                Fundada en 2020, Appsline nació de la pasión por la tecnología y el deseo de ayudar a empresas a digitalizarse. Comenzamos como un pequeño equipo de desarrolladores visionarios, y hoy somos líderes en el desarrollo de aplicaciones web y móviles personalizadas.
              </p>
              <p className="text-gray-600">
                Desde nuestros inicios, hemos trabajado con startups y empresas establecidas, entregando soluciones que no solo cumplen con las expectativas, sino que las superan. Nuestra experiencia en tecnologías modernas nos permite crear productos escalables y de alta calidad.
              </p>
            </div>
            <div className="bg-gray-100 p-8 rounded-lg">
              <img
                src="https://via.placeholder.com/500x300"
                alt="Equipo de Appsline"
                className="w-full rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Misión, Visión y Valores */}
      <section className="py-16 bg-gray-50" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-app-one">Misión, Visión y Valores</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition" data-aos="zoom-in">
              <h3 className="text-xl font-bold mb-4 text-app-one">Misión</h3>
              <p className="text-gray-600">
                Proporcionar soluciones tecnológicas innovadoras y personalizadas que impulsen el crecimiento y la eficiencia de nuestros clientes, utilizando las mejores prácticas en desarrollo web y móvil.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition" data-aos="zoom-in">
              <h3 className="text-xl font-bold mb-4 text-app-one">Visión</h3>
              <p className="text-gray-600">
                Ser la empresa líder en desarrollo de software en América Latina, reconocida por nuestra calidad, innovación y compromiso con el éxito de nuestros clientes.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition" data-aos="zoom-in">
              <h3 className="text-xl font-bold mb-4 text-app-one">Valores</h3>
              <ul className="text-gray-600 space-y-2">
                <li>• Innovación constante</li>
                <li>• Calidad y excelencia</li>
                <li>• Trabajo en equipo</li>
                <li>• Transparencia y honestidad</li>
                <li>• Compromiso con el cliente</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Nuestro Equipo */}
      <section className="py-16 bg-white" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-app-one">Nuestro Equipo</h2>
            <p className="text-gray-600 mt-4">
              Un equipo multidisciplinario de expertos apasionados por la tecnología.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center" data-aos="fade-up">
              <img
                src="https://via.placeholder.com/200x200"
                alt="Desarrollador"
                className="w-32 h-32 rounded-full mx-auto mb-4 shadow-lg"
              />
              <h3 className="text-xl font-bold text-app-one">Antonio Bolivar</h3>
              <p className="text-gray-600">Director de Negocios</p>
            </div>
            <div className="text-center" data-aos="fade-up">
              <img
                src="https://via.placeholder.com/200x200"
                alt="Diseñadora"
                className="w-32 h-32 rounded-full mx-auto mb-4 shadow-lg"
              />
              <h3 className="text-xl font-bold text-app-one">Ángel García</h3>
              <p className="text-gray-600">Director de Tecnología</p>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios Destacados */}
      <section className="py-16 bg-gray-50" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-app-one">Nuestros Servicios</h2>
            <p className="text-gray-600 mt-4">
              Ofrecemos soluciones completas en desarrollo web y móvil.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition" data-aos="fade-right">
              <h3 className="text-xl font-bold mb-4 text-app-one">Desarrollo Web</h3>
              <p className="text-gray-600">
                Creamos sitios web responsivos, e-commerce y aplicaciones web utilizando tecnologías modernas como React, Node.js y más.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition" data-aos="fade-left">
              <h3 className="text-xl font-bold mb-4 text-app-one">Desarrollo Móvil</h3>
              <p className="text-gray-600">
                Desarrollamos apps nativas para iOS y Android, así como híbridas con React Native, enfocadas en la experiencia del usuario.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Estadísticas */}
      <section className="py-16 bg-app-one text-white" data-aos="fade-up">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Nuestros Logros</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div data-aos="zoom-in">
              <h3 className="text-4xl font-bold mb-2">50+</h3>
              <p className="text-gray-200">Proyectos Completados</p>
            </div>
            <div data-aos="zoom-in">
              <h3 className="text-4xl font-bold mb-2">10+</h3>
              <p className="text-gray-200">Años de Experiencia</p>
            </div>
            <div data-aos="zoom-in">
              <h3 className="text-4xl font-bold mb-2">50+</h3>
              <p className="text-gray-200">Clientes Satisfechos</p>
            </div>
            <div data-aos="zoom-in">
              <h3 className="text-4xl font-bold mb-2">24/7</h3>
              <p className="text-gray-200">Soporte Técnico</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 bg-app-two text-white text-center" data-aos="fade-up">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">¿Listo para trabajar con nosotros?</h2>
          <p className="text-lg mb-8 opacity-90">
            Contáctanos y descubre cómo podemos ayudar a tu empresa a crecer.
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

export default AboutUs;