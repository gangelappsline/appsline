/* eslint-disable react/prop-types */
import { useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiInfo,
  FiRefreshCw,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { Button, Field, Modal } from "../../../components/admin";
import { cx } from "../../../utils/format";
import { formatBytes, kindOfFile } from "../../../utils/files";
import { FileIcon } from "./FileViews";

/** Estado de cada archivo dentro del modal de carga. */
const STATUS_META = {
  idle: {
    label: "En espera",
    textClass: "text-slate-400",
    icon: FiInfo,
    iconClass: "text-slate-300",
  },
  uploading: {
    label: "Subiendo…",
    textClass: "text-brand-600",
    icon: FiUpload,
    iconClass: "animate-pulse text-brand-500",
  },
  done: {
    label: "Subido",
    textClass: "text-emerald-600",
    icon: FiCheck,
    iconClass: "text-emerald-500",
  },
  error: {
    label: "Error",
    textClass: "text-red-500",
    icon: FiAlertCircle,
    iconClass: "text-red-500",
  },
};

/**
 * Modal para subir archivos al proyecto: elige el destino (una tarea o el
 * proyecto general, cuando la API lo soporta), muestra el estado de cada
 * archivo y permite reintentar los que fallaron.
 */
const UploadFilesModal = ({
  items,
  tasks,
  target,
  onTargetChange,
  generalSupported,
  targetMissing,
  uploading,
  projectName,
  onAddFiles,
  onRemove,
  onClose,
  onSubmit,
  onRetry,
}) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const list = items || [];
  const fails = list.filter((item) => item.status === "error").length;
  const pending = list.filter((item) => item.status !== "done").length;
  const totalBytes = list.reduce((sum, item) => sum + (item.file?.size || 0), 0);

  return (
    <Modal
      open={Boolean(items)}
      onClose={onClose}
      size="lg"
      dismissible={!uploading}
      title="Subir archivos"
      subtitle={`Se guardarán en ${projectName || "el proyecto"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            {fails && pending === fails ? "Cerrar" : "Cancelar"}
          </Button>
          {fails > 0 && (
            <Button variant="secondary" onClick={onRetry} disabled={uploading}>
              <FiRefreshCw /> Reintentar fallidos
            </Button>
          )}
          <Button
            onClick={onSubmit}
            loading={uploading}
            disabled={!pending || targetMissing}
            title={targetMissing ? "Elige una tarea de destino" : undefined}
          >
            <FiUpload /> Subir {pending || ""}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Destino */}
        <Field
          label="Destino"
          hint={
            generalSupported
              ? "Los archivos generales quedan en la sección Archivos del proyecto."
              : "La API de este proyecto solo acepta archivos dentro de una tarea; elige una."
          }
          error={targetMissing ? "Selecciona la tarea que recibirá los archivos." : undefined}
        >
          <select
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            disabled={uploading}
            className="admin-input"
          >
            <option value="__project__">
              Proyecto (general){generalSupported ? "" : " — no disponible"}
            </option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </Field>

        {/* Selector de archivos */}
        <div
          onDragOver={(e) => {
            if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
            e.preventDefault();
            setDragging(false);
            onAddFiles(e.dataTransfer.files);
          }}
          className={cx(
            "rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
            dragging ? "border-brand-400 bg-brand-50/60" : "border-slate-200 bg-slate-50/60"
          )}
        >
          <FiUpload className="mx-auto text-xl text-slate-400" />
          <p className="mt-2 text-[13px] text-slate-500">
            Arrastra archivos aquí o{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-brand-600 transition hover:text-brand-700"
            >
              selecciónalos de tu equipo
            </button>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {list.length
              ? `${list.length} archivo${list.length === 1 ? "" : "s"} · ${formatBytes(totalBytes)}`
              : "Puedes subir varios a la vez"}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              onAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Lista de archivos */}
        {list.length > 0 && (
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {list.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.idle;
              const StatusIcon = meta.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <FileIcon kind={kindOfFile({ name: item.file.name, mime: item.file.type })} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-700">
                      {item.file.name}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>{formatBytes(item.file.size)}</span>
                      <span className={cx("font-semibold", meta.textClass)}>
                        {item.message || meta.label}
                      </span>
                    </p>
                  </div>
                  <span className={cx("text-lg", meta.iconClass)}>
                    <StatusIcon />
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={uploading || item.status === "done"}
                    aria-label={`Quitar ${item.file.name}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                  >
                    <FiX />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default UploadFilesModal;
