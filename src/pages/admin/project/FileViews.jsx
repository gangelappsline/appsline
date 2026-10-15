/* eslint-disable react/prop-types */
/**
 * Piezas de presentación del explorador de archivos del proyecto:
 * tarjetas, filas de tabla, chips de tarea y acciones por archivo.
 */
import { FiCopy, FiDownload, FiEye, FiPaperclip, FiTrash2 } from "react-icons/fi";
import { Badge } from "../../../components/admin";
import { cx, formatDate } from "../../../utils/format";
import { fileKindMeta, formatBytes, isPreviewable } from "../../../utils/files";

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

/** Icono cuadrado con los colores del tipo de archivo. */
export const FileIcon = ({ kind, large = false }) => {
  const meta = fileKindMeta(kind);
  const Icon = meta.icon;
  return (
    <span
      className={cx(
        "flex items-center justify-center rounded-xl",
        meta.iconClass,
        large ? "h-14 w-14 text-2xl" : "h-10 w-10"
      )}
    >
      <Icon />
    </span>
  );
};

/** Miniatura de la imagen o, si falla / no es imagen, el icono del tipo. */
export const FileThumb = ({ file, broken, onBroken }) => {
  if (broken || file.kind !== "image") return <FileIcon kind={file.kind} large />;
  return (
    <img
      src={file.url}
      alt={file.name}
      loading="lazy"
      onError={onBroken}
      className="h-full w-full object-cover"
    />
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
    {isPreviewable(file) && <IconButton label="Previsualizar" icon={FiEye} onClick={onPreview} />}
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
  const previewable = isPreviewable(file);
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
          className="relative flex items-center justify-center overflow-hidden bg-slate-50/50 min-h-16"
        >
          <FileThumb file={file} broken={broken} onBroken={onBroken} />
          <span className="absolute right-2 top-2 rounded-lg bg-slate-900/70 p-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
            {previewable ? <FiEye /> : <FiDownload />}
          </span>
        </a>
      ) : (
        <div className="flex items-center justify-center bg-slate-50/50 min-h-16">
          <FileIcon kind={file.kind} large />
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
          <FileThumb file={file} broken={broken} onBroken={onBroken} />
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
