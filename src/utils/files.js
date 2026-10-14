/**
 * Utilidades de archivos del panel administrativo.
 *
 * La API puede devolver los adjuntos con nombres de campo distintos
 * (`name` / `file_name`, `url` / `path`, `size` / `file_size`, etc.) y sin
 * una URL absoluta. Aquí se centraliza la lectura tolerante, la detección
 * del tipo por extensión/MIME y el armado de la URL de descarga, para que
 * las vistas solo pinten el resultado de `normalizeProjectFile()`.
 */
import {
  FiArchive,
  FiCode,
  FiFile,
  FiFileText,
  FiGrid,
  FiImage,
  FiMonitor,
  FiMusic,
  FiVideo,
} from "react-icons/fi";
import { API_URL } from "../services/api";

/* ------------------------------------------------------------------ */
/* Tipos de archivo                                                    */
/* ------------------------------------------------------------------ */

/**
 * Catálogo de tipos con su etiqueta, icono y colores.
 * `groups` se usa para los filtros rápidos del explorador.
 */
export const FILE_KINDS = {
  image: {
    label: "Imagen",
    group: "images",
    icon: FiImage,
    iconClass: "bg-sky-50 text-sky-600",
    textClass: "text-sky-600",
  },
  pdf: {
    label: "PDF",
    group: "documents",
    icon: FiFileText,
    iconClass: "bg-red-50 text-red-500",
    textClass: "text-red-500",
  },
  doc: {
    label: "Documento",
    group: "documents",
    icon: FiFileText,
    iconClass: "bg-brand-50 text-brand-600",
    textClass: "text-brand-600",
  },
  sheet: {
    label: "Hoja de cálculo",
    group: "documents",
    icon: FiGrid,
    iconClass: "bg-emerald-50 text-emerald-600",
    textClass: "text-emerald-600",
  },
  slide: {
    label: "Presentación",
    group: "documents",
    icon: FiMonitor,
    iconClass: "bg-amber-50 text-amber-600",
    textClass: "text-amber-600",
  },
  archive: {
    label: "Comprimido",
    group: "others",
    icon: FiArchive,
    iconClass: "bg-amber-50 text-amber-600",
    textClass: "text-amber-600",
  },
  audio: {
    label: "Audio",
    group: "others",
    icon: FiMusic,
    iconClass: "bg-violet-50 text-violet-600",
    textClass: "text-violet-600",
  },
  video: {
    label: "Video",
    group: "others",
    icon: FiVideo,
    iconClass: "bg-violet-50 text-violet-600",
    textClass: "text-violet-600",
  },
  code: {
    label: "Código",
    group: "others",
    icon: FiCode,
    iconClass: "bg-slate-100 text-slate-600",
    textClass: "text-slate-600",
  },
  other: {
    label: "Archivo",
    group: "others",
    icon: FiFile,
    iconClass: "bg-slate-100 text-slate-500",
    textClass: "text-slate-500",
  },
};

export const fileKindMeta = (kind) => FILE_KINDS[kind] || FILE_KINDS.other;

/** Filtros rápidos del explorador de archivos (clave -> etiqueta). */
export const FILE_GROUPS = {
  all: "Todos",
  images: "Imágenes",
  documents: "Documentos",
  others: "Otros",
};

export const groupOfKind = (kind) => fileKindMeta(kind).group;

const EXTENSION_KINDS = {
  jpg: "image",
  jpeg: "image",
  jfif: "image",
  pjpeg: "image",
  png: "image",
  apng: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  svgz: "image",
  ico: "image",
  tif: "image",
  tiff: "image",
  heic: "image",
  heif: "image",
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  rtf: "doc",
  txt: "doc",
  md: "doc",
  pages: "doc",
  xls: "sheet",
  xlsx: "sheet",
  ods: "sheet",
  csv: "sheet",
  numbers: "sheet",
  ppt: "slide",
  pptx: "slide",
  odp: "slide",
  key: "slide",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  bz2: "archive",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  mp4: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  webm: "video",
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  json: "code",
  html: "code",
  css: "code",
  scss: "code",
  php: "code",
  py: "code",
  rb: "code",
  java: "code",
  sql: "code",
  xml: "code",
  yml: "code",
  yaml: "code",
  sh: "code",
};

const MIME_KINDS = [
  [/^image\//, "image"],
  [/^audio\//, "audio"],
  [/^video\//, "video"],
  [/pdf/, "pdf"],
  [/word|opendocument\.text|rtf|plain/, "doc"],
  [/sheet|excel|csv/, "sheet"],
  [/presentation|powerpoint/, "slide"],
  [/zip|compressed|tar|rar|7z/, "archive"],
  [/json|javascript|typescript|xml|html|css/, "code"],
];

/** Extensión en minúsculas de un nombre o ruta ("Logo PNG" -> "png"). */
export const extensionOf = (value = "") => {
  const clean = String(value || "").split(/[?#]/)[0];
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match ? match[1].toLowerCase() : "";
};

/** Tipo de archivo (clave de `FILE_KINDS`) a partir del MIME o del nombre. */
export const kindOfFile = ({ mime, name } = {}) => {
  const type = String(mime || "").toLowerCase();
  const byMime = MIME_KINDS.find(([pattern]) => pattern.test(type));
  if (byMime) return byMime[1];
  const ext = extensionOf(name);
  return EXTENSION_KINDS[ext] || "other";
};

/* ------------------------------------------------------------------ */
/* Lectura tolerante de los campos del API                             */
/* ------------------------------------------------------------------ */

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "" && value !== "null") {
      return value.trim();
    }
  }
  return "";
};

const firstNumber = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

/** Nombre visible del archivo (con respaldo en la URL y en `name` anidado). */
export const fileNameOf = (file = {}) => {
  const nested = file.file || {};
  const explicit = firstString(
    file.name,
    file.file_name,
    file.original_name,
    file.filename,
    file.original_filename,
    file.title,
    nested.name
  );
  if (explicit) return explicit;
  const url = firstString(file.url, file.file_url, file.path, file.file_path, nested.url);
  const base = url.split(/[?#]/)[0].split("/").filter(Boolean).pop();
  return base ? decodeURIComponent(base) : "Archivo sin nombre";
};

export const fileSizeOf = (file = {}) =>
  firstNumber(
    file.size,
    file.file_size,
    file.bytes,
    file.filesize,
    file.file?.size,
    // Algunos backends anidan el peso: { size: { bytes: 123 } }
    file.size?.bytes
  );

export const fileMimeOf = (file = {}) =>
  firstString(file.mime_type, file.mime, file.content_type, file.type, file.file?.type);

export const fileDateOf = (file = {}) =>
  firstString(
    file.created_at,
    file.uploaded_at,
    file.updated_at,
    file.date,
    file.file?.created_at
  );

const fileUploaderOf = (file = {}) =>
  file.uploaded_by || file.user || file.author || file.owner || null;

/* ------------------------------------------------------------------ */
/* URL de descarga / previsualización                                  */
/* ------------------------------------------------------------------ */

const apiOrigin = (() => {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    return new URL(API_URL || "/api", base).origin;
  } catch {
    return "";
  }
})();

/**
 * URL absoluta del archivo. La API suele responder rutas relativas
 * (`/storage/files/logo.png`), que se resuelven contra el host del API
 * (no contra el del panel, que vive en otro dominio).
 */
export const resolveFileUrl = (file = {}) => {
  const nested = file.file || {};
  const raw = firstString(
    file.url,
    file.file_url,
    file.download_url,
    file.public_url,
    file.path,
    file.file_path,
    file.link,
    nested.url,
    typeof file === "string" ? file : ""
  );
  if (!raw) return "";
  if (/^(data|blob):/i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `${window.location.protocol}${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${apiOrigin}${raw}`;
  return `${apiOrigin}/${raw.replace(/^\.?\//, "")}`;
};

/* ------------------------------------------------------------------ */
/* Normalización                                                       */
/* ------------------------------------------------------------------ */

/**
 * Convierte un adjunto del API en el objeto que consumen las vistas.
 *
 * @param {object} raw - Adjunto tal cual lo devuelve el API.
 * @param {object} [options]
 *   `task`  Tarea a la que pertenece (`{ id, title }`) cuando el archivo
 *           se cargó desde `/tasks/{id}/files`.
 *   `scope` `"project"` para archivos generales del proyecto.
 */
export const normalizeProjectFile = (raw = {}, { task = null, scope = null } = {}) => {
  const name = fileNameOf(raw);
  const mime = fileMimeOf(raw);
  const owner = raw._task || task || (raw.task && typeof raw.task === "object" ? raw.task : null);
  const kind = kindOfFile({ mime, name });
  const url = resolveFileUrl(raw);
  const id = raw.id ?? raw.file_id ?? raw.uuid ?? `${name}-${fileSizeOf(raw)}`;
  return {
    id,
    key: `${scope || (owner?.id ? "task" : "project")}-${owner?.id ?? "shared"}-${id}`,
    name,
    kind,
    kindLabel: fileKindMeta(kind).label,
    extension: extensionOf(name),
    mime,
    size: fileSizeOf(raw),
    createdAt: fileDateOf(raw),
    uploader: fileUploaderOf(raw),
    url,
    // Tarea a la que está ligado el archivo (null = archivo general del proyecto).
    task: owner
      ? { id: owner.id, title: owner.title || owner.name || `Tarea #${owner.id}` }
      : null,
    scope: scope || (owner?.id ? "task" : "project"),
    raw,
  };
};

/** ¿Se puede previsualizar dentro del panel (sin descargar)? */
export const isPreviewable = (file) =>
  Boolean(file?.url) && (file.kind === "image" || file.kind === "pdf");

/** Peso legible: 1536 -> "1.5 KB". */
export const formatBytes = (bytes) => {
  const num = Number(bytes) || 0;
  if (num <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  const value = num / 1024 ** index;
  const rounded = value >= 10 || index === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded.replace(/\.0$/, "")} ${units[index]}`;
};

/** Fuerza la descarga del archivo (abre en pestaña nueva si el host lo bloquea). */
export const downloadFile = (file) => {
  const href = typeof file === "string" ? file : file?.url;
  if (!href || typeof document === "undefined") return false;
  const link = document.createElement("a");
  link.href = href;
  link.download = (typeof file === "string" ? "" : file?.name) || "";
  link.rel = "noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
};
