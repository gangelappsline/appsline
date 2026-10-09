import { Navigate, useParams } from "react-router-dom";
import { getTool } from "../tools/registry";

/**
 * Alias en inglés: /tools/<slug> -> /herramientas/<slug-es>.
 * Permite compartir enlaces con nombres en inglés sin duplicar páginas.
 */
const EN_ALIASES = {
  "qr-code-generator": "generador-de-qr",
  "qr-generator": "generador-de-qr",
  "pdf-to-word": "pdf-a-word",
  "pdf-summary": "resumen-de-pdf",
  "summarize-pdf": "resumen-de-pdf",
  "pdf-to-text": "extraer-texto-de-pdf",
  "image-to-webp": "imagen-a-webp",
  "webp-converter": "imagen-a-webp",
  "audio-to-text": "audio-a-texto",
  "speech-to-text": "audio-a-texto",
  "json-formatter": "formateador-json",
  "base64": "base64",
  "hash-generator": "generador-de-hash",
  "password-generator": "generador-de-contrasenas",
  "uuid-generator": "generador-de-uuid",
  "jwt-decoder": "decodificador-jwt",
  "color-converter": "conversor-de-color",
};

const ToolsAliasRedirect = () => {
  const { slug } = useParams();
  const target = EN_ALIASES[slug] || (getTool(slug) ? slug : null);
  return <Navigate to={target ? `/herramientas/${target}` : "/herramientas"} replace />;
};

export default ToolsAliasRedirect;
