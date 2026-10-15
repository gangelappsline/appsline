/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiColumns,
  FiCopy,
  FiDownload,
  FiEye,
  FiFile,
  FiFolder,
  FiInfo,
  FiList,
  FiPaperclip,
  FiRefreshCw,
  FiUpload,
  FiX,
} from "react-icons/fi";
import {
  Button,
  CardsSkeleton,
  ConfirmDialog,
  EmptyState,
  MiniStat,
  Modal,
  SearchInput,
  TableSkeleton,
  useToast,
} from "../../../components/admin";
import {
  deleteProjectFile,
  deleteTaskFile,
  fetchProjectFiles,
  projectFilesSupported,
  readApiStatus,
  uploadProjectFiles,
} from "../../../services/admin";
import { cx, formatDateTime } from "../../../utils/format";
import {
  FILE_GROUPS,
  formatBytes,
  groupOfKind,
  isPreviewable,
  normalizeProjectFile,
} from "../../../utils/files";
import { FileCard, FileRow, LayoutButton } from "./FileViews";
import UploadFilesModal from "./UploadFilesModal";

/** Valor del selector de destino para los archivos generales del proyecto. */
const PROJECT_TARGET = "__project__";

const SORTS = {
  recent: "Más recientes",
  name: "Nombre (A-Z)",
  size: "Tamaño (mayor primero)",
};

const hasFiles = (event) => Array.from(event?.dataTransfer?.types || []).includes("Files");

const taskIdOf = (file) =>
  file?.task?.id === undefined || file?.task?.id === null ? null : file.task.id;

/**
 * Pestaña **Archivos** del proyecto.
 *
 * Reúne los archivos generales del proyecto (`/projects/{id}/files`, cuando
 * el backend los soporta) y los adjuntos de todas sus tareas en un explorador
 * con búsqueda, filtros por tipo y tarea, orden, vista de cuadrícula o lista,
 * previsualización, descarga y carga (arrastrando o desde el equipo).
 *
 * @param {object} props
 *   `projectId`, `projectName`, `tasks` (se usan para etiquetar y elegir
 *   destino), `onOpenTask(task)` abre el detalle de una tarea y
 *   `onCountChange(n)` informa el total para el contador de la pestaña.
 */
const FilesTab = ({ projectId, projectName, tasks = [], onOpenTask, onCountChange }) => {
  const { notify } = useToast();
  const inputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generalSupported, setGeneralSupported] = useState(() => projectFilesSupported());

  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [layout, setLayout] = useState("grid");

  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const [uploadItems, setUploadItems] = useState(null); // null = modal cerrado
  const [target, setTarget] = useState(PROJECT_TARGET);
  const [uploading, setUploading] = useState(false);

  const [brokenThumbs, setBrokenThumbs] = useState(() => new Set());
  const [preview, setPreview] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Carga ---------------- */
  const load = useCallback(
    async ({ force = false, quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const rows = await fetchProjectFiles(projectId, tasks, { force });
        const normalized = rows.map((row) =>
          normalizeProjectFile(row, { task: row._task, scope: row._scope })
        );
        setFiles(normalized);
        setError("");
        onCountChange?.(normalized.length);
        setGeneralSupported(projectFilesSupported());
      } catch {
        setError("No se pudieron cargar los archivos del proyecto.");
      } finally {
        setLoading(false);
      }
    },
    [projectId, tasks, onCountChange]
  );

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- Derivados ---------------- */
  const taskOptions = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title || `Tarea #${task.id}`,
      })),
    [tasks]
  );

  const groupCounts = useMemo(() => {
    const counts = { all: files.length, images: 0, documents: 0, others: 0 };
    files.forEach((file) => {
      counts[groupOfKind(file.kind)] += 1;
    });
    return counts;
  }, [files]);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + (file.size || 0), 0), [files]);
  const inTasks = useMemo(() => files.filter((file) => file.task).length, [files]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = files.filter((file) => {
      const matchesTerm =
        !term ||
        file.name.toLowerCase().includes(term) ||
        (file.task?.title || "").toLowerCase().includes(term) ||
        file.extension.includes(term);
      const matchesGroup = group === "all" || groupOfKind(file.kind) === group;
      const matchesTask =
        taskFilter === "all" ||
        (taskFilter === "project" && !file.task) ||
        String(taskIdOf(file)) === String(taskFilter);
      return matchesTerm && matchesGroup && matchesTask;
    });

    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    else if (sort === "size") sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
    else
      sorted.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    return sorted;
  }, [files, search, group, taskFilter, sort]);

  const filtersActive = Boolean(search.trim()) || group !== "all" || taskFilter !== "all";
  const filteredSize = useMemo(
    () => filtered.reduce((sum, file) => sum + (file.size || 0), 0),
    [filtered]
  );

  const clearFilters = () => {
    setSearch("");
    setGroup("all");
    setTaskFilter("all");
  };

  const copyLink = async (file) => {
    if (!file?.url) return notify("Este archivo no tiene enlace de descarga", "error");
    try {
      await navigator.clipboard.writeText(file.url);
      notify("Enlace copiado");
    } catch {
      notify("El enlace no pudo copiarse", "error");
    }
  };

  const openTaskOf = (file) => {
    const task = file.task && tasks.find((t) => String(t.id) === String(file.task.id));
    if (task) onOpenTask?.(task);
    else notify("La tarea de este archivo ya no está disponible", "error");
  };

  const markBroken = (url) =>
    setBrokenThumbs((old) => {
      const next = new Set(old);
      next.add(url);
      return next;
    });

  /* ---------------- Carga de archivos ---------------- */
  const openUpload = (incoming) => {
    const list = Array.from(incoming || []);
    if (!list.length) return;
    if (!canUpload) {
      notify("Crea una tarea en el proyecto para poder adjuntar archivos", "error");
      return;
    }
    setUploadItems(
      list.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}-${file.size}`,
        file,
        status: "idle",
        message: "",
      }))
    );
    setTarget(
      taskFilter !== "all" && taskFilter !== "project" ? String(taskFilter) : PROJECT_TARGET
    );
    dragDepth.current = 0;
    setDragging(false);
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadItems(null);
    setTarget(PROJECT_TARGET);
  };

  const addToUpload = (incoming) => {
    const list = Array.from(incoming || []);
    if (!list.length) return;
    setUploadItems((old) => [
      ...(old || []),
      ...list.map((file, index) => ({
        id: `${Date.now()}-extra-${index}-${file.name}-${file.size}`,
        file,
        status: "idle",
        message: "",
      })),
    ]);
  };

  const uploadTargetId = target === PROJECT_TARGET ? null : target;
  const targetMissing = !uploadTargetId && !generalSupported;
  /* Sin archivos generales en la API, hace falta alguna tarea de destino. */
  const canUpload = generalSupported || taskOptions.length > 0;

  const runUpload = async (onlyFailed = false) => {
    const items = (uploadItems || []).filter((item) =>
      onlyFailed ? item.status === "error" : item.status !== "done"
    );
    if (!items.length || targetMissing) return;
    setUploading(true);

    let done = 0;
    let failed = 0;
    for (const item of items) {
      setUploadItems((old) =>
        old.map((row) => (row.id === item.id ? { ...row, status: "uploading" } : row))
      );
      try {
        await uploadProjectFiles(projectId, [item.file], { taskId: uploadTargetId });
        done += 1;
        setUploadItems((old) =>
          old.map((row) => (row.id === item.id ? { ...row, status: "done", message: "Subido" } : row))
        );
      } catch (err) {
        failed += 1;
        const status = readApiStatus(err);
        const message =
          status === 413
            ? "Supera el límite del servidor"
            : status === 422
              ? "Formato no permitido"
              : status === 404 || status === 405
                ? "El destino no está disponible"
                : "No se pudo subir";
        setUploadItems((old) =>
          old.map((row) => (row.id === item.id ? { ...row, status: "error", message } : row))
        );
        if (!uploadTargetId && (status === 404 || status === 405)) setGeneralSupported(false);
      }
    }

    setUploading(false);
    await load({ force: true, quiet: true });

    if (failed === 0) {
      notify(`${done} archivo${done === 1 ? "" : "s"} subido${done === 1 ? "" : "s"}`);
      setUploadItems(null);
      return;
    }
    notify(
      done === 0
        ? "No se pudo subir ningún archivo"
        : `${done} subido${done === 1 ? "" : "s"} · ${failed} con error`,
      "error"
    );
  };

  /* ---------------- Eliminar ---------------- */
  const removeFile = async () => {
    const file = pendingDelete;
    if (!file) return;
    const taskId = taskIdOf(file);
    setDeleting(true);
    try {
      if (taskId) {
        try {
          await deleteTaskFile(projectId, taskId, file.id);
        } catch (err) {
          const status = readApiStatus(err);
          if (status !== 404 && status !== 405) throw err;
          await deleteProjectFile(projectId, file.id);
        }
      } else {
        await deleteProjectFile(projectId, file.id);
      }
      setFiles((old) => old.filter((row) => row.key !== file.key));
      onCountChange?.(Math.max(0, files.length - 1));
      setPendingDelete(null);
      notify(`“${file.name}” se eliminó del proyecto`);
    } catch {
      notify("No se pudo eliminar el archivo", "error");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Arrastrar y soltar sobre el panel ---------------- */
  const handleDragEnter = (e) => {
    if (!hasFiles(e) || uploadItems) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragOver = (e) => {
    if (hasFiles(e)) e.preventDefault();
  };
  const handleDragLeave = (e) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const handleDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    openUpload(e.dataTransfer.files);
  };

  /* ---------------- Render ---------------- */
  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-white/85 backdrop-blur-sm">
          <div className="text-center">
            <FiUpload className="mx-auto text-2xl text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Suelta los archivos aquí</p>
            <p className="mt-0.5 text-xs text-slate-500">Se subirán a este proyecto</p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* ---------- Métricas ---------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat icon={FiFolder} label="Archivos" value={files.length} tone="brand" />
          <MiniStat icon={FiInfo} label="Peso total" value={formatBytes(totalSize)} tone="sky" />
          <MiniStat
            icon={FiPaperclip}
            label="En tareas"
            value={inTasks}
            hint={`${Math.max(0, files.length - inTasks)} del proyecto`}
            tone="violet"
          />
          <MiniStat
            icon={FiBuilding}
            label="Proyecto"
            value={files.length - inTasks}
            hint={files.length > 0 ? `${files.length - inTasks} archivo${files.length - inTasks === 1 ? "" : "s"} generales` : "ninguno"}
            tone="sky"
          />
          <MiniStat
            icon={FiEye}
            label="En pantalla"
            value={filtered.length}
            hint={filtersActive ? "Con filtros aplicados" : "Sin filtros"}
            tone="slate"
          />
        </div>

        {/* ---------- Barra de herramientas ---------- */}
        <div className="admin-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, tipo o tarea..."
              className="w-full lg:max-w-sm"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
                aria-label="Filtrar por ubicación"
                className="admin-input !w-auto !py-2 text-[13px]"
              >
                <option value="all">Todas las ubicaciones</option>
                <option value="project">Solo del proyecto</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Ordenar archivos"
                className="admin-input !w-auto !py-2 text-[13px]"
              >
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
                <LayoutButton
                  active={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  icon={FiColumns}
                  label="Cuadrícula"
                />
                <LayoutButton
                  active={layout === "list"}
                  onClick={() => setLayout("list")}
                  icon={FiList}
                  label="Lista"
                />
              </div>
              <button
                type="button"
                onClick={() => load({ force: true })}
                disabled={loading}
                title="Actualizar"
                aria-label="Actualizar"
                className="btn-secondary !px-3"
              >
                <FiRefreshCw className={cx(loading && "animate-spin")} />
              </button>
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={!canUpload}
                title={
                  canUpload
                    ? undefined
                    : "Este proyecto no tiene tareas donde adjuntar archivos"
                }
              >
                <FiUpload /> Subir archivos
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  openUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Filtros rápidos por tipo */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            {Object.entries(FILE_GROUPS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGroup(key)}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
                  group === key
                    ? "bg-brand-50 text-brand-700 ring-brand-200"
                    : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {label}
                <span className="ml-1.5 tabular-nums text-slate-400">{groupCounts[key]}</span>
              </button>
            ))}
            {files.length > 0 && (
              <button
                key="project-filter"
                type="button"
                onClick={() => setTaskFilter("project")}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
                  taskFilter === "project"
                    ? "bg-brand-50 text-brand-700 ring-brand-200"
                    : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                )}
              >
                Proyecto
                <span className="ml-1.5 tabular-nums text-slate-400">{files.length - inTasks}</span>
              </button>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                <FiX /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ---------- Contenido ---------- */}
        {loading ? (
          layout === "grid" ? (
            <CardsSkeleton count={6} className="xl:grid-cols-4" />
          ) : (
            <div className="admin-card">
              <TableSkeleton rows={5} cols={4} />
            </div>
          )
        ) : error ? (
          <div className="admin-card">
            <EmptyState
              icon={FiAlertCircle}
              title="No se pudieron cargar los archivos"
              description={error}
              action={
                <Button variant="secondary" onClick={() => load({ force: true })}>
                  <FiRefreshCw /> Reintentar
                </Button>
              }
            />
          </div>
        ) : files.length === 0 ? (
          <div className="admin-card">
            <EmptyState
              icon={FiFolder}
              title="El proyecto todavía no tiene archivos"
              description={
                canUpload
                  ? "Adjunta documentos, imágenes o entregables a una tarea, o súbelos como archivos del proyecto."
                  : "Crea una tarea para adjuntar documentos, imágenes o entregables."
              }
              action={
                <Button onClick={() => inputRef.current?.click()} disabled={!canUpload}>
                  <FiUpload /> Subir archivos
                </Button>
              }
            />
            <p className="pb-6 text-center text-xs text-slate-400">
              También puedes arrastrarlos y soltarlos en esta zona.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card">
            <EmptyState
              icon={FiPaperclip}
              title="Sin resultados"
              description="Ningún archivo coincide con la búsqueda o los filtros seleccionados."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          </div>
        ) : layout === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((file) => (
              <FileCard
                key={file.key}
                file={file}
                broken={!file.url || brokenThumbs.has(file.url)}
                onPreview={() => isPreviewable(file) && setPreview(file)}
                onOpenTask={() => openTaskOf(file)}
                onCopy={() => copyLink(file)}
                onDelete={() => setPendingDelete(file)}
                onBroken={() => markBroken(file.url)}
              />
            ))}
          </div>
        ) : (
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="admin-table-head">
                    <th className="px-5 py-3.5">Archivo</th>
                    <th className="px-5 py-3.5">Ubicación</th>
                    <th className="px-5 py-3.5">Tamaño</th>
                    <th className="px-5 py-3.5">Subido</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((file) => (
                    <FileRow
                      key={file.key}
                      file={file}
                      broken={!file.url || brokenThumbs.has(file.url)}
                      onPreview={() => isPreviewable(file) && setPreview(file)}
                      onOpenTask={() => openTaskOf(file)}
                      onCopy={() => copyLink(file)}
                      onDelete={() => setPendingDelete(file)}
                      onBroken={() => markBroken(file.url)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
              <span>
                {filtered.length} de {files.length} archivo{files.length === 1 ? "" : "s"}
              </span>
              <span>{formatBytes(filteredSize)}</span>
            </footer>
          </div>
        )}
      </div>

      {/* ---------- Modal de carga ---------- */}
      <UploadFilesModal
        items={uploadItems}
        tasks={taskOptions}
        target={target}
        onTargetChange={setTarget}
        generalSupported={generalSupported}
        targetMissing={targetMissing}
        uploading={uploading}
        projectName={projectName}
        onAddFiles={addToUpload}
        onRemove={(id) => setUploadItems((old) => old.filter((row) => row.id !== id))}
        onClose={closeUpload}
        onSubmit={() => runUpload(false)}
        onRetry={() => runUpload(true)}
      />

      {/* ---------- Previsualización ---------- */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        size="2xl"
        title={preview?.name}
        subtitle={
          preview
            ? [
                preview.kindLabel,
                preview.size ? formatBytes(preview.size) : null,
                preview.task?.title || "Archivo del proyecto",
                preview.createdAt ? formatDateTime(preview.createdAt) : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cerrar
            </Button>
            {preview?.url && (
              <>
                <Button variant="secondary" onClick={() => copyLink(preview)}>
                  <FiCopy /> Copiar enlace
                </Button>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-brand-700"
                >
                  <FiDownload /> Abrir original
                </a>
              </>
            )}
          </>
        }
      >
        {preview && isPreviewable(preview) ? (
          preview.kind === "image" ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="mx-auto max-h-[60vh] w-auto rounded-xl border border-slate-200 object-contain"
            />
          ) : (
            <iframe
              src={preview.url}
              title={preview.name}
              className="h-[60vh] w-full rounded-xl border border-slate-200 bg-slate-50"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FiFile className="text-2xl text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              Este tipo de archivo no se puede previsualizar
            </p>
            <p className="text-xs text-slate-400">
              Descárgalo para abrirlo en tu equipo o compartirlo con el cliente.
            </p>
          </div>
        )}
      </Modal>

      {/* ---------- Eliminar ---------- */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={removeFile}
        loading={deleting}
        title="Eliminar archivo"
        message={`“${pendingDelete?.name}” se eliminará definitivamente. Esta acción no se puede deshacer.`}
      />
    </div>
  );
};

export default FilesTab;
