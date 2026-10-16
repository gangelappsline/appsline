/* eslint-disable react/prop-types */
/**
 * Piezas de presentación del explorador de archivos del proyecto:
 * tarjetas, filas de tabla, chips de tarea, iconos por tipo y acciones.
 */
import {
  FaFile,
  FaFileArchive,
  FaFileAudio,
  FaFileCode,
  FaFileCsv,
  FaFileAlt,
  FaFileExcel,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileVideo,
  FaFileWord,
} from "react-icons/fa";
import { FiCopy, FiDownload, FiEye, FiPaperclip, FiTrash2 } from "react-icons/fi";
import { Badge } from "../../../components/admin";
import { cx, formatDate } from "../../../utils/format";
import { badgeKindOf, canPreviewFile, fileKindMeta, formatBytes } from "../../../utils/files";

/** Botón del conmutador cuadrícula/lista. */
export const LayoutButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    title={`Vista ${label.toLowerCase()}`}
    aria-label={`Vista ${label.toLowerCase()}`}
    aria-pressed={active}
    className={cx(
      "rounded-lg p-2 transition",
      active
        ? "bg-brand-50 text-brand-700"
        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    )}
  >
    <Icon />
  </button>
);

/**
 * Iconos "reales" por tipo de archivo: glifo y colores de la aplicación
 * con la que todo el mundo los reconoce (Word azul, Excel verde,
 * PowerPoint naranja, PDF rojo...), en lugar de un icono gris genérico.
 * La clave sale de `badgeKindOf` (extensión primero, `kind` como respaldo).
 */
const FILE_BADGE_META = {
  pdf: { icon: FaFilePdf, iconClass: "bg-red-50 text-[#e5322d]", textClass: "text-[#e5322d]" },
  word: { icon: FaFileWord, iconClass: "bg-[#e8effa] text-[#2b579a]", textClass: "text-[#2b579a]" },
  excel: { icon: FaFileExcel, iconClass: "bg-[#e6f4ec] text-[#217346]", textClass: "text-[#217346]" },
  powerpoint: {
    icon: FaFilePowerpoint,
    iconClass: "bg-[#fdeee9] text-[#d24726]",
    textClass: "text-[#d24726]",
  },
  csv: { icon: FaFileCsv, iconClass: "bg-emerald-50 text-emerald-600", textClass: "text-emerald-600" },
  text: { icon: FaFileAlt, iconClass: "bg-slate-100 text-slate-500", textClass: "text-slate-500" },
  image: { icon: FaFileImage, iconClass: "bg-sky-50 text-sky-600", textClass: "text-sky-600" },
  audio: { icon: FaFileAudio, iconClass: "bg-violet-50 text-violet-600", textClass: "text-violet-600" },
  video: { icon: FaFileVideo, iconClass: "bg-fuchsia-50 text-fuchsia-600", textClass: "text-fuchsia-600" },
  archive: { icon: FaFileArchive, iconClass: "bg-amber-50 text-amber-600", textClass: "text-amber-600" },
  code: { icon: FaFileCode, iconClass: "bg-slate-100 text-slate-600", textClass: "text-slate-600" },
  generic: { icon: FaFile, iconClass: "bg-slate-100 text-slate-500", textClass: "text-slate-500" },
};

const fileBadgeMeta = (file) => FILE_BADGE_META[badgeKindOf(file)] || FILE_BADGE_META.generic;

/**
 * Icono cuadrado con los colores del tipo de archivo.
 * Acepta el archivo normalizado (`file`) o, como antes, solo `kind` (más
 * `name`/`extension` cuando se tenga, p. ej. en el modal de carga).
 */
export const FileIcon = ({ file, kind, name, extension, large = false }) => {
  const meta = fileBadgeMeta(file || { kind, name, extension });
  const Icon = meta.icon;
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-xl",
        meta.iconClass,
        large ? "h-14 w-14 text-[26px]" : "h-10 w-10 text-lg"
      )}
    >
      <Icon aria-hidden />
    </span>
  );
};

/**
 * Miniatura de la tarjeta/fila: la imagen en sí, o el icono del tipo de
 * archivo sobre su color con la extensión debajo (DOCX, XLSX, PDF...).
 */
export const FileThumb = ({ file, broken, onBroken, large = true }) => {
  if (!broken && file.kind === "image") {
    return (
      <img
        src={file.url}
        alt={file.name}
        loading="lazy"
        onError={onBroken}
        className="h-full w-full object-cover"
      />
    );
  }
  if (!large) return <FileIcon file={file} />;
  const meta = fileBadgeMeta(file);
  return (
    <span className="flex w-full flex-col items-center justify-center gap-1.5 px-2 py-4">
      <FileIcon file={file} large />
      {file.extension && (
        <span className={cx("text-[10px] font-bold uppercase tracking-widest", meta.textClass)}>
          .{file.extension}
        </span>
      )}
    </span>
  );
};

/** Ubicación del archivo: la tarea a la que pertenece o el proyecto. */
export const TaskChip = ({ file, onClick }) =>
  file.task ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Abrir “${file.task.title}”`}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
    >
      <FiPaperclip className="shrink-0" />
      <span className="truncate">{file.task.title}</span>
    </button>
  ) : (
    <Badge tone="violet" dot>
      Proyecto
    </Badge>
  );

export const IconButton = ({ label, icon: Icon, onClick, danger = false }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={cx(
      "rounded-lg p-2 transition",
      danger
        ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    )}
  >
    <Icon />
  </button>
);

/** Acciones por archivo (previsualizar, copiar enlace, descargar, eliminar). */
export const FileActions = ({ file, onPreview, onCopy, onDelete }) => (
  <div className="flex items-center gap-0.5">
    {canPreviewFile(file) && <IconButton label="Previsualizar" icon={FiEye} onClick={onPreview} />}
    {file.url && <IconButton label="Copiar enlace" icon={FiCopy} onClick={onCopy} />}
    {file.url && (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        title="Descargar"
        aria-label="Descargar"
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <FiDownload />
      </a>
    )}
    <IconButton label="Eliminar" icon={FiTrash2} danger onClick={onDelete} />
  </div>
);

export const FileCard = ({ file, broken, onPreview, onOpenTask, onCopy, onDelete, onBroken }) => {
  const meta = fileKindMeta(file.kind);
  const previewable = canPreviewFile(file);
  const isProjectFile = !file.task;

  return (
    <article className="admin-card group flex flex-col overflow-hidden">
      {file.url ? (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          title={previewable ? "Previsualizar" : "Abrir archivo"}
          onClick={
            previewable
              ? (e) => {
                  e.preventDefault();
                  onPreview();
                }
              : undefined
          }
          className="relative flex items-center justify-center overflow-hidden bg-slate-50/50 min-h-24"
        >
          <FileThumb file={file} broken={broken} onBroken={onBroken} />
          <span className="absolute right-2 top-2 rounded-lg bg-slate-900/70 p-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
            {previewable ? <FiEye /> : <FiDownload />}
          </span>
        </a>
      ) : (
        <div className="flex items-center justify-center bg-slate-50/50 min-h-24">
          <FileThumb file={file} broken={broken} onBroken={onBroken} />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium leading-relaxed text-slate-800 line-clamp-1">
            {file.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
            <span className={cx("font-semibold", meta.textClass)}>{file.kindLabel}</span>
            <span>{formatBytes(file.size)}</span>
            {file.createdAt && <span className="ml-2 text-[10px]">{formatDate(file.createdAt)}</span>}
          </p>
        </div>
        {isProjectFile && (
          <div className="mt-1 text-center text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
              Proyecto
            </span>
          </div>
        )}
        {!isProjectFile && (
          <TaskChip file={file} onClick={onOpenTask} className="text-[10px]" />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 px-1.5 py-1 bg-slate-50/50 text-xs text-slate-500">
        <FileActions file={file} onPreview={onPreview} onCopy={onCopy} onDelete={onDelete} />
      </footer>
    </article>
  );
};

export const FileRow = ({ file, broken, onPreview, onOpenTask, onCopy, onDelete, onBroken }) => (
  <tr className="transition hover:bg-slate-50">
    <td className="max-w-80 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <FileThumb file={file} broken={broken} onBroken={onBroken} large={false} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-800">{file.name}</p>
          <p className="truncate text-[11px] text-slate-400">
            {file.kindLabel}
            {file.extension ? ` · .${file.extension}` : ""}
          </p>
        </div>
      </div>
    </td>
    <td className="max-w-56 px-5 py-3">
      <TaskChip file={file} onClick={onOpenTask} />
    </td>
    <td className="whitespace-nowrap px-5 py-3 text-[13px] text-slate-600">
      {formatBytes(file.size)}
    </td>
    <td className="whitespace-nowrap px-5 py-3 text-[13px] text-slate-500">
      {file.createdAt ? formatDate(file.createdAt) : "—"}
    </td>
    <td className="px-3 py-3">
      <div className="flex items-center justify-end">
        <FileActions file={file} onPreview={onPreview} onCopy={onCopy} onDelete={onDelete} />
      </div>
    </td>
  </tr>
);
