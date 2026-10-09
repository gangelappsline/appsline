// src/components/SEO.jsx
import { Helmet } from 'react-helmet-async';

export default function SEO({ 
  title = "Appsline | Estrategia, Innovación y Desarrollo Tecnológico",
  description = "Creamos productos digitales que hacen crecer tu negocio.",
  image = "https://api.appsline.com.mx/images/new_appsline_icon.webp",
  url = "https://appsline.com.mx/",
}) {
  return (
    <Helmet>
      {/* Título y descripción básicos */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Etiquetas Open Graph (para Facebook, WhatsApp, LinkedIn) */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      {/* Datos Estructurados (para que Google use tu logo) */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "url": "https://appsline.com.mx",
          "logo": "https://appsline.com.mx/assets/new_appsline_icon-DJ-nnqMn.webp"
        })}
      </script>
    </Helmet>
  );
}