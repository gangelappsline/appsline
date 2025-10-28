import LogoWhite from "../assets/images/appsline_logo_white.png";

const Footer = () => {
  return (
    <footer className="w-full bg-gradient-to-r from-app-one via-app-two to-app-three text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Logo */}
          <div className="flex items-center">
            <img src={LogoWhite} className="w-32" alt="Appsline Logo" />
          </div>

          {/* Derechos de autor y enlace sutil */}
          <div className="text-center md:text-right">
            <p className="text-sm text-gray-200">&copy; 2024 Appsline. Todos los derechos reservados.</p>
            <a
              href="#contact"
              className="text-sm text-gray-300 hover:text-white transition duration-300 mt-1 inline-block"
            >
              Contacto
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;