import {
  FiGrid,
  FiFileText,
  FiImage,
  FiAlignLeft,
  FiMic,
  FiCode,
  FiHash,
  FiKey,
  FiShield,
  FiDroplet,
  FiLink,
  FiType,
} from "react-icons/fi";

/**
 * Registro central de las herramientas públicas de Appsline.
 *
 * Cada herramienta define:
 *  - slug:     segmento de la URL (siempre bajo /herramientas/:slug)
 *  - key:      clave de i18n -> tools.items.<key>.{name,desc,intro}
 *  - icon:     icono de react-icons
 *  - category: clave de i18n -> tools.categories.<category>
 *  - featured: se muestra directamente en el menú principal
 *
 * El componente de la página se resuelve en main.jsx mediante el slug.
 */
export const TOOL_CATEGORIES = ["documents", "media", "developers"];

export const TOOLS = [
  // ---------------------------------------------------------------- documentos
  {
    slug: "pdf-a-word",
    key: "pdfToWord",
    icon: FiFileText,
    category: "documents",
    featured: true,
  },
  {
    slug: "resumen-de-pdf",
    key: "pdfSummary",
    icon: FiAlignLeft,
    category: "documents",
    featured: true,
  },
  {
    slug: "extraer-texto-de-pdf",
    key: "pdfToText",
    icon: FiType,
    category: "documents",
  },
  // -------------------------------------------------------------------- medios
  {
    slug: "imagen-a-webp",
    key: "imageToWebp",
    icon: FiImage,
    category: "media",
    featured: true,
  },
  {
    slug: "audio-a-texto",
    key: "audioToText",
    icon: FiMic,
    category: "media",
    featured: true,
  },
  {
    slug: "generador-de-qr",
    key: "qrGenerator",
    icon: FiGrid,
    category: "media",
    featured: true,
  },
  // --------------------------------------------------------------- desarrollo
  {
    slug: "formateador-json",
    key: "jsonFormatter",
    icon: FiCode,
    category: "developers",
    featured: true,
  },
  {
    slug: "base64",
    key: "base64",
    icon: FiLink,
    category: "developers",
  },
  {
    slug: "generador-de-hash",
    key: "hashGenerator",
    icon: FiHash,
    category: "developers",
  },
  {
    slug: "generador-de-contrasenas",
    key: "passwordGenerator",
    icon: FiShield,
    category: "developers",
  },
  {
    slug: "generador-de-uuid",
    key: "uuidGenerator",
    icon: FiKey,
    category: "developers",
  },
  {
    slug: "decodificador-jwt",
    key: "jwtDecoder",
    icon: FiShield,
    category: "developers",
  },
  {
    slug: "conversor-de-color",
    key: "colorConverter",
    icon: FiDroplet,
    category: "developers",
  },
];

export const toolPath = (slug) => `/herramientas/${slug}`;

export const getTool = (slug) => TOOLS.find((tool) => tool.slug === slug);

export const toolsByCategory = () =>
  TOOL_CATEGORIES.map((category) => ({
    category,
    tools: TOOLS.filter((tool) => tool.category === category),
  }));
