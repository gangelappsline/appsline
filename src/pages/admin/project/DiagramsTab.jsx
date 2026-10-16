/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckSquare,
  FiChevronDown,
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiGitBranch,
  FiHardDrive,
  FiLink,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  useToast,
} from "../../../components/admin";
import DiagramThumbnail from "../../../components/admin/flowchart/DiagramThumbnail";
import TemplatePicker from "../../../components/admin/flowchart/TemplatePicker";
import {
  deleteDiagram,
  diagramsStorageMode,
  duplicateDiagram,
  fetchProjectDiagrams,
  saveDiagram,
} from "../../../services/diagrams";
import { diagramStats } from "../../../utils/diagrams";
import { cx, formatDateTime } from "../../../utils/format";

export const newDiagramUrl = (projectId, { taskId = null, template = "blank", name = "" } = {}) => {
  const params = new URLSearchParams();
  if (taskId) params.set("task", taskId);
  if (template && template !== "blank") params.set("template", template);
  if (name) params.set("name", name);
  const query = params.toString();
  return `/admin/projects/${projectId}/diagrams/new${query ? `?${query}` : ""}`;
};

export const diagramUrl = (projectId, diagramId) => `/admin/projects/${projectId}/diagrams/${diagramId}`;

/* ------------------------------------------------------------------ */

const CardMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="Acciones del diagrama"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <FiMoreHorizontal />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={cx(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition hover:bg-slate-50",
                item.danger ? "text-red-600" : "text-slate-700",
              )}
            >
              <item.icon className="shrink-0 text-slate-400" /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const DiagramCard = ({ diagram, task, project, onOpen, onOpenTask, menu }) => {
  const stats = diagramStats(diagram);
  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg"
    >
      <DiagramThumbnail diagram={diagram} height={130} className="border-b border-slate-100" />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
            {diagram.name}
          </h3>
          <CardMenu items={menu} />
        </div>
        {diagram.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{diagram.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span>{stats.nodes} nodos</span>
          <span>{stats.edges} conexiones</span>
          {diagram.updated_at && <span>{formatDateTime(diagram.updated_at)}</span>}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          {project && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              <span className="truncate">{project.name}</span>
            </span>
          )}
          {task ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTask?.(task);
              }}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
              title="Abrir la tarea"
            >
              <FiCheckSquare className="shrink-0" />
              <span className="truncate">#{task.id} · {task.title}</span>
            </button>
          ) : diagram.task_id ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              <FiCheckSquare /> Tarea #{diagram.task_id}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              <FiGitBranch /> Diagrama del proyecto
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Pestaña "Diagramas" del proyecto: todos los diagramas (generales y de
 * tareas), creación con plantilla, duplicar, renombrar, mover y eliminar.
 */
const DiagramsTab = ({ projectId, tasks = [], onOpenTask, onCountChange, defaultTaskId = null }) => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [diagrams, setDiagrams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all"); // all | project | task:ID
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(null); // { diagram, name, description, task_id }
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(diagramsStorageMode());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchProjectDiagrams(projectId);
      setDiagrams(list);
      onCountChange?.(list.length);
    } catch {
      setDiagrams([]);
      notify("No se pudieron cargar los diagramas", "error");
    } finally {
      setMode(diagramsStorageMode());
      setLoading(false);
    }
  }, [projectId, onCountChange, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const taskOf = useCallback(
    (taskId) => tasks.find((t) => String(t.id) === String(taskId)) || null,
    [tasks],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return diagrams.filter((d) => {
      if (scope === "project" && d.task_id) return false;
      if (scope.startsWith("task:") && String(d.task_id) !== scope.slice(5)) return false;
      if (!term) return true;
      const task = taskOf(d.task_id);
      return `${d.name} ${d.description} ${task?.title || ""}`.toLowerCase().includes(term);
    });
  }, [diagrams, search, scope, taskOf]);

  const tasksWithDiagrams = useMemo(() => {
    const ids = new Set(diagrams.map((d) => String(d.task_id)).filter((v) => v && v !== "null"));
    return tasks.filter((t) => ids.has(String(t.id)));
  }, [diagrams, tasks]);

  const create = ({ name, taskId, template }) => {
    setPicker(false);
    navigate(newDiagramUrl(projectId, { taskId, template, name }));
  };

  const duplicate = async (diagram) => {
    setBusy(true);
    try {
      await duplicateDiagram(projectId, diagram);
      notify("Diagrama duplicado");
      await load();
    } catch {
      notify("No se pudo duplicar el diagrama", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e) => {
    e?.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await saveDiagram(projectId, {
        ...editing.diagram,
        name: editing.name.trim() || editing.diagram.name,
        description: editing.description,
        task_id: editing.task_id || null,
      });
      notify("Diagrama actualizado");
      setEditing(null);
      await load();
    } catch {
      notify("No se pudo actualizar el diagrama", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteDiagram(projectId, confirm.id);
      notify("Diagrama eliminado");
      setConfirm(null);
      await load();
    } catch {
      notify("No se pudo eliminar el diagrama", "error");
    } finally {
      setBusy(false);
    }
  };

  const menuFor = (diagram) => [
    { label: "Abrir en el editor", icon: FiExternalLink, onClick: () => navigate(diagramUrl(projectId, diagram.id)) },
    { label: "Renombrar / vincular", icon: FiEdit2, onClick: () => setEditing({ diagram, name: diagram.name, description: diagram.description || "", task_id: diagram.task_id || "" }) },
    { label: "Duplicar", icon: FiCopy, onClick: () => duplicate(diagram) },
    { label: "Copiar enlace", icon: FiLink, onClick: () => { navigator.clipboard?.writeText(`${window.location.origin}${diagramUrl(projectId, diagram.id)}`); notify("Enlace copiado"); } },
    { label: "Eliminar", icon: FiTrash2, danger: true, onClick: () => setConfirm(diagram) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar diagrama..." className="min-w-[180px] flex-1 sm:max-w-xs" inputClassName="!py-2" />
        <div className="relative">
          <select
            aria-label="Filtrar diagramas"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="admin-input appearance-none pr-8 !py-2 text-[13px]"
          >
            <option value="all">Todos ({diagrams.length})</option>
            <option value="project">Del proyecto ({diagrams.filter((d) => !d.task_id).length})</option>
            {tasksWithDiagrams.map((t) => (
              <option key={t.id} value={`task:${t.id}`}>
                Tarea #{t.id} · {t.title}
              </option>
            ))}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
        </div>
        <Button variant="ghost" onClick={load} disabled={loading} title="Actualizar">
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} de {diagrams.length}
        </span>
        <Button onClick={() => setPicker(true)}>
          <FiPlus /> Nuevo diagrama
        </Button>
      </div>

      {mode === "local" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <FiHardDrive className="mt-0.5 shrink-0" />
          <span>
            La API aún no tiene los endpoints de diagramas, así que se guardan <b>en este navegador</b>. Para
            compartirlos con el equipo, agrega el contrato de <code>docs/API-DIAGRAMS.md</code> al backend; el panel
            cambiará a la API automáticamente.
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FiGitBranch}
          title={diagrams.length ? "Sin coincidencias" : "Todavía no hay diagramas"}
          description={
            diagrams.length
              ? "Prueba con otro filtro o término de búsqueda."
              : "Dibuja el flujo del proyecto o de una tarea: procesos, decisiones, responsables y entregables."
          }
          action={
            !diagrams.length && (
              <Button onClick={() => setPicker(true)}>
                <FiPlus /> Crear el primer diagrama
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => (
            <DiagramCard
              key={d.id}
              diagram={d}
              task={taskOf(d.task_id)}
              onOpen={() => navigate(diagramUrl(projectId, d.id))}
              onOpenTask={onOpenTask}
              menu={menuFor(d)}
            />
          ))}
        </div>
      )}

      <TemplatePicker open={picker} onClose={() => setPicker(false)} onCreate={create} tasks={tasks} defaultTaskId={defaultTaskId} />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Editar diagrama"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancelar</Button>
            <Button loading={busy} onClick={saveEdit}>Guardar</Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="Nombre" required>
              <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="admin-input" />
            </Field>
            <Field label="Descripción">
              <textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="admin-input" />
            </Field>
            <Field label="Vinculado a">
              <select value={editing.task_id ?? ""} onChange={(e) => setEditing({ ...editing, task_id: e.target.value })} className="admin-input">
                <option value="">Proyecto (general)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>Tarea #{t.id} · {t.title}</option>
                ))}
              </select>
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        loading={busy}
        title="Eliminar diagrama"
        message={`“${confirm?.name}” se eliminará definitivamente. Esta acción no se puede deshacer.`}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Sección compacta para el detalle de una tarea: sus diagramas y el acceso
 * para crear uno nuevo ya vinculado a ella.
 */
export const TaskDiagramsSection = ({ projectId, task, diagrams = [], loading = false }) => {
  const navigate = useNavigate();
  if (!task) return null;
  return (
    <section className="border-b border-slate-100 py-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FiGitBranch className="text-brand-500" /> Diagramas de flujo
          {diagrams.length > 0 && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-500">{diagrams.length}</span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => navigate(newDiagramUrl(projectId, { taskId: task.id, template: "basic", name: `Flujo · ${task.title}` }))}
          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
        >
          <FiPlus /> Nuevo diagrama
        </button>
      </div>
      {loading ? (
        <div className="mt-3 h-20 animate-pulse rounded-xl bg-slate-100" />
      ) : diagrams.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {diagrams.map((d) => {
            const stats = diagramStats(d);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(diagramUrl(projectId, d.id))}
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/30"
              >
                <DiagramThumbnail diagram={d} height={56} className="w-24 shrink-0 rounded-lg border border-slate-100" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-700">{d.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {stats.nodes} nodos · {stats.edges} conexiones
                  </span>
                </span>
                <FiExternalLink className="shrink-0 text-slate-300" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center text-xs text-slate-500">
          Esta tarea no tiene diagramas. Crea uno para documentar su flujo paso a paso.
        </p>
      )}
    </section>
  );
};

export default DiagramsTab;
