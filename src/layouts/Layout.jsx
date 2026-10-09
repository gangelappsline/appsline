/* eslint-disable react/prop-types */
import { useEffect } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import SEO from "../components/SEO";

const Layout = ({ 
  title, 
  description = "Creamos productos digitales que hacen crecer tu negocio.",
  image = "https://appsline.com.mx/ruta-a-tu-logo.png",
  children 
}) => {
  useEffect(() => { document.title = `${title} · Appsline`; }, [title]);
  return (
    <div className="min-h-screen bg-[#080a0f]">
      <SEO title={title} description={description} image={image} />
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
};
export default Layout;
