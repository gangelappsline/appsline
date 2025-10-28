import { useState } from 'react';
import { Link, NavLink } from "react-router-dom";
import Logo from "../assets/images/appsline_logo_1x.png";
import LanguageSelector from './LanguageSelector';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Para menú móvil

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-app-one">
              <img src={Logo} alt="Appsline" className="w-12" />
            </Link>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex space-x-8">
            <NavLink
              to="/"
              className="text-gray-700 hover:text-app-two px-3 py-2 rounded-md text-sm font-medium transition duration-300"
            >
              {t('nav.home')}
            </NavLink>
            <NavLink
              to="/about-us"
              className="text-gray-700 hover:text-app-two px-3 py-2 rounded-md text-sm font-medium transition duration-300"
            >
              {t('nav.about')}
            </NavLink>
            <NavLink
              to="/portfolio"
              className="text-gray-700 hover:text-app-two px-3 py-2 rounded-md text-sm font-medium transition duration-300"
            >
              {t('nav.projects')}
            </NavLink>
            <NavLink
              to="/login"
              className="text-gray-700 hover:text-app-two px-3 py-2 rounded-md text-sm font-medium transition duration-300"
            >
              {t('nav.login')}
            </NavLink>
            
          </nav>

          {/* Selector de Idioma y Menú Móvil */}
          <div className="flex items-center space-x-4">
            <LanguageSelector />

            {/* Botón de menú móvil */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="text-gray-700 hover:text-app-two focus:outline-none focus:text-app-two"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Menú Móvil */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              <Link
                to="/"
                className="text-gray-700 hover:text-app-two block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.home')}
              </Link>
              <Link
                to="/about-us"
                className="text-gray-700 hover:text-app-two block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.about')}
              </Link>
              <Link
                to="/portfolio"
                className="text-gray-700 hover:text-app-two block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.projects')}
              </Link>
              <Link
                to="/login"
                className="text-gray-700 hover:text-app-two block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.contact')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;