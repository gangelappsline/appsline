const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|jfif|pjpeg|pjp|png|apng|svgz?|tiff?|webp)$/i;
const WEBP_MIME_TYPES = new Set(["image/webp", "image/x-webp"]);
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const WEBP_QUALITY = 0.85;

export const isImageFile = (file) => {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  if (!GENERIC_MIME_TYPES.has(type)) return false;
  return IMAGE_EXTENSION.test(String(file.name || ""));
};

const isWebpFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  if (WEBP_MIME_TYPES.has(type)) return true;
  return GENERIC_MIME_TYPES.has(type) && /\.webp$/i.test(String(file?.name || ""));
};

const decodeImage = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  const cleanup = () => URL.revokeObjectURL(objectUrl);

  image.onload = () => {
    cleanup();
    resolve(image);
  };
  image.onerror = () => {
    cleanup();
    reject(new Error(`No se pudo procesar la imagen “${file.name || "sin nombre"}”.`));
  };
  image.src = objectUrl;
});

const canvasToWebp = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error("No se pudo convertir la imagen a WebP en este navegador."));
      } else if (blob.type !== "image/webp") {
        reject(new Error("Este navegador no pudo generar imágenes WebP."));
      } else {
        resolve(blob);
      }
    },
    "image/webp",
    WEBP_QUALITY
  );
});

/** Devuelve la imagen original si ya es WebP; las demás imágenes se convierten a WebP al 85%. */
export const toWebpIfImage = async (file) => {
  if (!file || !isImageFile(file)) return file;

  const originalName = String(file.name || "imagen");
  const baseName = originalName.replace(/\.[^.]+$/, "") || "imagen";
  if (isWebpFile(file)) {
    if (/\.webp$/i.test(originalName) && file.type === "image/webp") return file;
    if (typeof File === "undefined") return file;
    return new File([file], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified || Date.now(),
    });
  }
  if (typeof document === "undefined" || typeof File === "undefined") {
    throw new Error("La conversión de imágenes solo está disponible en el navegador.");
  }

  const image = await decodeImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error(`La imagen “${file.name || "sin nombre"}” no tiene dimensiones válidas.`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen para convertirla a WebP.");

    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToWebp(canvas);
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified || Date.now(),
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

/** Convierte secuencialmente las imágenes de una carga mixta y deja intactos los demás archivos. */
export const prepareFilesForUpload = async (files) => {
  const prepared = [];
  for (const file of Array.from(files || [])) {
    prepared.push(await toWebpIfImage(file));
  }
  return prepared;
};

/** Prepara imágenes incluidas en FormData sin alterar el resto de sus campos. */
export const prepareFormDataImages = async (formData) => {
  const prepared = new FormData();
  for (const [key, value] of formData.entries()) {
    const nextValue = typeof value === "string" ? value : await toWebpIfImage(value);
    prepared.append(key, nextValue);
  }
  return prepared;
};
