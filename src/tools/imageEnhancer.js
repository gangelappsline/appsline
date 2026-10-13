/**
 * Motor de procesamiento de imágenes 100% en el navegador (Canvas 2D).
 *
 * Pipeline usado por la herramienta "Mejorar imagen":
 *   quitar fondo (IA o por color) -> suavizar bordes -> recorte ->
 *   reducción de ruido + color / mejora automática -> escalar -> nitidez ->
 *   fondo nuevo (transparente o color) -> exportar.
 *
 * Ninguna función envía datos a un servidor: todo trabaja con Canvas/ImageData.
 */

/* ------------------------------------------------------------------ carga -- */
export const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    const img = new Image();
    img.onload = () => {
      if (source instanceof Blob) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (source instanceof Blob) URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    img.src = url;
  });

export const createCanvas = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const imageToCanvas = (img, width = img.naturalWidth || img.width, height = img.naturalHeight || img.height) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const blobToCanvas = async (blob) => imageToCanvas(await loadImage(blob));
export const fileToCanvas = blobToCanvas;

export const canvasToBlob = (canvas, type = "image/png", quality = 0.92) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("export"))),
      type,
      quality,
    );
  });

const cloneCanvas = (source) => {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  return canvas;
};

/* ------------------------------------------- quitar fondo por color (rápido) */
/**
 * Elimina un fondo de color uniforme: estima el color de fondo a partir de
 * las 4 esquinas y hace transparente todo píxel parecido (con fundido suave
 * en el borde según `feather`). Ideal para fondos blancos / de un solo color.
 */
export const removeBackgroundByColor = (source, { tolerance = 35, feather = 30 } = {}) => {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Color de fondo: promedio de parches de 6x6 en las esquinas.
  const patch = 6;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const corners = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];
  for (const [cx, cy] of corners) {
    for (let y = Math.max(0, cy); y < Math.min(height, cy + patch); y += 1) {
      for (let x = Math.max(0, cx); x < Math.min(width, cx + patch); x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 10) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
    }
  }
  if (!count) return canvas;
  r /= count;
  g /= count;
  b /= count;

  // Distancia máxima en RGB ≈ 441. tolerance/feather llegan en escala 0..100.
  const low = (tolerance / 100) * 441;
  const high = low + Math.max(8, (feather / 100) * 441);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    // Distancia euclídea con peso perceptual (el ojo es más sensible al verde).
    const dist = Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) * 1.6;
    if (dist <= low) {
      data[i + 3] = 0;
    } else if (dist < high) {
      const factor = (dist - low) / (high - low);
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/* --------------------------------------------------- suavizar borde (alpha) */
/** Difumina solo el canal alfa para que el recorte no se vea “dentado”. */
export const refineAlphaEdges = (source, featherPx = 1) => {
  const radius = Number(featherPx) || 0;
  if (radius <= 0) return cloneCanvas(source);
  const blurred = createCanvas(source.width, source.height);
  const bctx = blurred.getContext("2d", { willReadFrequently: true });
  bctx.filter = `blur(${radius}px)`;
  bctx.drawImage(source, 0, 0);
  bctx.filter = "none";

  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blurredData = bctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const data = original.data;
  for (let i = 0; i < data.length; i += 4) {
    // El alfa difuminado suaviza la silueta; el RGB se conserva intacto.
    data[i + 3] = Math.min(data[i + 3], blurredData[i + 3]);
  }
  ctx.putImageData(original, 0, 0);
  return canvas;
};

/* ------------------------------------------------------------ recortar vacío */
/** Recorta los bordes transparentes dejando `padding` px alrededor del sujeto. */
export const trimTransparent = (source, padding = 8, threshold = 12) => {
  const { width, height } = source;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return cloneCanvas(source); // imagen totalmente transparente
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const canvas = createCanvas(maxX - minX + 1, maxY - minY + 1);
  canvas
    .getContext("2d", { willReadFrequently: true })
    .drawImage(source, minX, minY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/* --------------------------------------------------------- mejora automática */
/**
 * Mejora automática real: estira el histograma por canal usando los
 * percentiles 1% y 99% (recupera fotos lavadas / con niebla) sin quemar
 * luces ni sombras extremas.
 */
export const applyAutoEnhance = (source) => {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const total = canvas.width * canvas.height;
  const clip = Math.max(1, Math.floor(total * 0.01));

  for (let channel = 0; channel < 3; channel += 1) {
    const hist = new Uint32Array(256);
    for (let i = channel; i < data.length; i += 4) {
      if (data[i + 3 - channel] > 0) hist[data[i]] += 1;
    }
    let acc = 0;
    let low = 0;
    let high = 255;
    for (let v = 0; v < 256; v += 1) {
      acc += hist[v];
      if (acc >= clip) {
        low = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v -= 1) {
      acc += hist[v];
      if (acc >= clip) {
        high = v;
        break;
      }
    }
    if (high - low < 24) continue; // contraste ya correcto en este canal
    const scale = 255 / (high - low);
    for (let i = channel; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, Math.round((data[i] - low) * scale)));
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/* ------------------------------------------------------------- color / tono */
/** Brillo, contraste y saturación en escala -100..100 (0 = sin cambio). */
export const applyColorAdjustments = (source, { brightness = 0, contrast = 0, saturation = 0 } = {}) => {
  if (!brightness && !contrast && !saturation) return cloneCanvas(source);
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.filter = [
    `brightness(${1 + brightness / 100})`,
    `contrast(${1 + contrast / 100})`,
    `saturate(${Math.max(0, 1 + saturation / 100)})`,
  ].join(" ");
  ctx.drawImage(source, 0, 0);
  return canvas;
};

/* ------------------------------------------------------- reducción de ruido */
/** Mezcla una copia difuminada con la original: suaviza grano sin perder forma. */
export const applyDenoise = (source, amount = 0) => {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (strength <= 0) return cloneCanvas(source);
  const blurred = createCanvas(source.width, source.height);
  const bctx = blurred.getContext("2d", { willReadFrequently: true });
  bctx.filter = `blur(${Math.max(0.6, strength * 1.8)}px)`;
  bctx.drawImage(source, 0, 0);

  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.globalAlpha = strength * 0.45;
  ctx.drawImage(blurred, 0, 0);
  ctx.globalAlpha = 1;
  return canvas;
};

/* ------------------------------------------------------------------ nitidez */
/** Convolución de enfoque (sharpen). `amount` en escala 0..100. */
export const applySharpen = (source, amount = 0) => {
  const strength = (Math.max(0, Math.min(100, amount)) / 100) * 0.9;
  if (strength <= 0) return cloneCanvas(source);
  const { width, height } = source;
  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  const src = srcCtx.getImageData(0, 0, width, height);
  const out = new ImageData(width, height);
  const s = src.data;
  const o = out.data;
  const a = strength;
  // Kernel: centro 1+4a, vecinos -a (cruz). Conserva el alfa original.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (s[idx + 3] === 0) continue;
      const up = y > 0 ? idx - width * 4 : idx;
      const down = y < height - 1 ? idx + width * 4 : idx;
      const left = x > 0 ? idx - 4 : idx;
      const right = x < width - 1 ? idx + 4 : idx;
      for (let c = 0; c < 3; c += 1) {
        const value =
          s[idx + c] * (1 + 4 * a) -
          a * (s[up + c] + s[down + c] + s[left + c] + s[right + c]);
        o[idx + c] = Math.max(0, Math.min(255, value));
      }
      o[idx + 3] = s[idx + 3];
    }
  }
  const canvas = createCanvas(width, height);
  canvas.getContext("2d", { willReadFrequently: true }).putImageData(out, 0, 0);
  return canvas;
};

/* -------------------------------------------------------------------- escala */
/**
 * Redimensiona en pasos (nunca más de 1.75x por paso al ampliar, ni más de
 * 2x al reducir) para que el remuestreo del navegador conserve más detalle
 * que un único salto grande.
 */
export const resizeCanvas = (source, targetWidth, targetHeight) => {
  let current = cloneCanvas(source);
  const tw = Math.max(1, Math.round(targetWidth));
  const th = Math.max(1, Math.round(targetHeight));
  let guard = 0;
  while ((current.width !== tw || current.height !== th) && guard < 32) {
    guard += 1;
    const ratioW = tw / current.width;
    const ratioH = th / current.height;
    // Cada eje avanza como máximo 1.75x al ampliar o 2x al reducir por paso.
    const factorW = ratioW > 1 ? Math.min(ratioW, 1.75) : Math.max(ratioW, 0.5);
    const factorH = ratioH > 1 ? Math.min(ratioH, 1.75) : Math.max(ratioH, 0.5);
    let nextW = Math.round(current.width * factorW);
    let nextH = Math.round(current.height * factorH);
    nextW = ratioW > 1 ? Math.min(tw, nextW) : Math.max(tw, nextW);
    nextH = ratioH > 1 ? Math.min(th, nextH) : Math.max(th, nextH);
    if (nextW === current.width && nextH === current.height) break;
    const next = createCanvas(nextW, nextH);
    const ctx = next.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, nextW, nextH);
    current = next;
  }
  if (current.width !== tw || current.height !== th) {
    const finalCanvas = createCanvas(tw, th);
    const fctx = finalCanvas.getContext("2d", { willReadFrequently: true });
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(current, 0, 0, tw, th);
    return finalCanvas;
  }
  return current;
};

/* -------------------------------------------------------------- fondo sólido */
export const compositeOverColor = (source, color) => {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = color || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
};
