/** Imágenes portables: solo ráster embebido; nunca SVG, HTML ni URLs ejecutables. */
export const DIAGRAM_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAX_DIAGRAM_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_EMBEDDED_LENGTH = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(DIAGRAM_IMAGE_ACCEPT.split(","));
const dimension = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export const normalizeDiagramImage = (image) => {
  if (!image || typeof image !== "object" || typeof image.src !== "string") return null;
  if (image.src.length > MAX_EMBEDDED_LENGTH || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(image.src)) return null;
  return {
    src: image.src,
    name: String(image.name || "Imagen").slice(0, 255),
    alt: String(image.alt || "").slice(0, 2000),
    fit: image.fit === "cover" ? "cover" : "contain",
    lockAspectRatio: image.lockAspectRatio !== false,
    naturalWidth: dimension(image.naturalWidth, 240),
    naturalHeight: dimension(image.naturalHeight, 180),
  };
};

export const validateDiagramImageFile = (file) => {
  if (!file || !IMAGE_TYPES.has(file.type)) throw new Error("Usa una imagen PNG, JPG o WebP.");
  if (!file.size) throw new Error("La imagen está vacía.");
  if (file.size > MAX_DIAGRAM_IMAGE_BYTES) throw new Error("La imagen supera el límite de 5 MB.");
};

/** Se reduce a 1600 px y se comprime antes de guardarla en el JSON del diagrama. */
export async function readDiagramImage(file) {
  validateDiagramImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("No se pudo leer la imagen. Elige un archivo PNG, JPG o WebP válido.");
    }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("La imagen es demasiado grande (máximo 40 megapíxeles).");
    }
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite procesar esta imagen.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = normalizeDiagramImage({
      src: canvas.toDataURL("image/webp", 0.85),
      name: file.name,
      alt: file.name.replace(/\.[^.]+$/, ""),
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
    });
    if (!result) throw new Error("La imagen sigue siendo demasiado pesada. Reduce su tamaño antes de agregarla.");
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const diagramImageSize = (image) => {
  const ratio = Math.min(1, 280 / image.naturalWidth, 220 / image.naturalHeight);
  return {
    width: Math.max(44, Math.round(image.naturalWidth * ratio)),
    height: Math.max(32, Math.round(image.naturalHeight * ratio)),
  };
};
