/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiActivity, FiArchive, FiArrowLeft, FiCalendar, FiCheck, FiCheckCircle,
  FiChevronDown, FiClock, FiDownload, FiFile, FiFilter, FiFlag, FiGrid,
  FiLink, FiList, FiMessageSquare, FiMoreHorizontal, FiPaperclip, FiPlus,
  FiSend, FiTrash2, FiUpload, FiUser, FiUsers, FiX, FiColumns,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Avatar, AvatarStack, Badge, Button, ConfirmDialog, Drawer, EmptyState,
  Field, Modal, SearchInput, useToast,
} from "../../components/admin";
import {
  addTaskComment, createProjectTask, deleteProjectTask, fetchProject,
  fetchProjectTasks, fetchTask, fetchTaskComments, fetchTaskFiles,
  fetchUsers, updateProjectTask, uploadTaskFiles, addSubtaskToTask,
} from "../../services/admin";
import { cx, formatDate, initials, isOverdue, priorityMeta } from "../../utils/format";
import { prepareFilesForUpload } from "../../utils/images";

const COLUMNS = [
  { key: "pending", label: "Pendientes", color: "#8b5cf6", bg: "bg-violet-50", text: "text-violet-600", icon: FiArchive },
  { key: "in_progress", label: "En progreso", color: "#0ea5e9", bg: "bg-sky-50", text: "text-sky-600", icon: FiActivity },
  { key: "completed", label: "Finalizadas", color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-600", icon: FiCheckCircle },
  { key: "rejected", label: "Rechazadas", color: "#f43f5e", bg: "bg-rose-50", text: "text-rose-500", icon: FiX },
];

const columnOf = (status) => COLUMNS.find((c) => c.key === status) || COLUMNS[0];

const EMPTY_TASK = {
  title: "", description: "", status: "pending", priority: "medium",
  assigned_to: "", due_date: "", estimated_hours: "",
};

/* Helpers tolerantes a las distintas formas de "responsable" de la API. */
const assigneeOf = (task) => {
  const raw = task?.assigned_to ?? task?.assignees?.[0] ?? task?.user;
  return typeof raw === "object" && raw ? raw : null;
};
const assigneeId = (task) => {
  const raw = task?.assigned_to ?? task?.assignees?.[0] ?? task?.user_id ?? "";
  return typeof raw === "object" && raw ? raw.id ?? "" : raw ?? "";
};

/* ================================================================== */

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();
  const fileRef = useRef(null);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [dragged, setDragged] = useState(null);
  const [dropColumn, setDropColumn] = useState(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [person, setPerson] = useState("");
  const [view, setView] = useState("board");

  const [taskModal, setTaskModal] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [comment, setComment] = useState("");
  const [detailTab, setDetailTab] = useState("comments");
  const [newSubtask, setNewSubtask] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  /* ---------------- Carga inicial ---------------- */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      const [p, t, u] = await Promise.allSettled([
        fetchProject(id),
        fetchProjectTasks(id),
        fetchUsers(),
      ]);
      console.log(p, t, u);
      if (!active) return;
      if (p.status === "fulfilled") setProject(p.value);
      else setLoadError("No se pudo cargar el proyecto.");
      setTasks(t.status === "fulfilled" ? t.value : []);
      setUsers(u.status === "fulfilled" ? u.value : []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  /* ---------------- Derivados ---------------- */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matches = !term || `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(term);
      return matches && (!priority || task.priority === priority) && (!person || String(assigneeId(task)) === String(person));
    });
  }, [tasks, search, priority, person]);

  const done = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const projectName = project?.name || "Detalle del proyecto";
  const hasFilters = Boolean(search || priority || person);

  /* ---------------- Mutaciones (optimistas) ---------------- */
  const updateTask = async (taskId, patch, quiet = false) => {
    const previous = tasks;
    setTasks((old) => old.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    setSelected((old) => (old?.id === taskId ? { ...old, ...patch } : old));
    try {
      await updateProjectTask(id, taskId, patch);
      if (!quiet) notify("Cambios guardados");
    } catch {
      setTasks(previous);
      notify("No se pudieron guardar los cambios", "error");
    }
  };

  const handleDrop = (status) => {
    setDropColumn(null);
    if (!dragged || dragged.status === status) return setDragged(null);
    updateTask(dragged.id, { status }, true);
    notify(`Tarea movida a ${columnOf(status).label}`);
    setDragged(null);
  };

  const saveNewTask = async (e) => {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const created = await createProjectTask(id, {
        ...draft,
        assigned_to: draft.assigned_to || null,
        estimated_hours: draft.estimated_hours === "" ? null : Number(draft.estimated_hours),
        due_date: draft.due_date || null,
      });
      setTasks((old) => [created, ...old]);
      setTaskModal(false);
      setDraft(EMPTY_TASK);
      notify("Tarea creada correctamente");
    } catch {
      notify("No se pudo crear la tarea", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Detalle de tarea ---------------- */
  const openTask = async (task) => {
    setSelected(task);
    setComments(Array.isArray(task.comments) ? task.comments : []);
    setAttachments(Array.isArray(task.attachments || task.files) ? task.attachments || task.files : []);
    setDetailTab("comments");
    setSearchParams({ task: task.id }, { replace: true });
    const [detail, comm, files] = await Promise.allSettled([
      fetchTask(id, task.id),
      fetchTaskComments(id, task.id),
      fetchTaskFiles(id, task.id),
    ]);
    if (detail.status === "fulfilled" && detail.value) setSelected((old) => (old?.id === task.id ? { ...old, ...detail.value } : old));
    if (comm.status === "fulfilled" && comm.value.length) setComments(comm.value);
    if (files.status === "fulfilled" && files.value.length) setAttachments(files.value);
  };

  const closeTask = () => {
    setSelected(null);
    setSearchParams({}, { replace: true });
  };

  // Deep-link: /admin/projects/:id?task=:taskId abre el detalle automáticamente.
  const deepLinked = useRef(false);
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || deepLinked.current || loading || !tasks.length) return;
    const found = tasks.find((t) => String(t.id) === String(taskId));
    if (found) {
      deepLinked.current = true;
      openTask(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tasks]);

  const addComment = async () => {
    const value = comment.trim();
    if (!value || !selected) return;
    const optimistic = { id: `local-${Date.now()}`, comment: value, user: { name: "Tú" }, created_at: new Date().toISOString() };
    setComments((old) => [...old, optimistic]);
    setComment("");
    try {
      const saved = await addTaskComment(id, selected.id, value);
      setComments((old) => old.map((c) => (c.id === optimistic.id ? saved : c)));
    } catch {
      notify("El comentario no pudo sincronizarse", "error");
    }
  };

  const uploadFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !selected) return;
    try {
      const preparedFiles = await prepareFilesForUpload(files);
      setAttachments((old) => [...old, ...preparedFiles.map((file) => ({
        id: `local-${file.name}`,
        name: file.name,
        size: file.size,
      }))]);
      await uploadTaskFiles(id, selected.id, preparedFiles);
      notify(`${preparedFiles.length} archivo${preparedFiles.length === 1 ? "" : "s"} adjuntado${preparedFiles.length === 1 ? "" : "s"}`);
    } catch {
      notify("Los archivos no pudieron sincronizarse", "error");
    }
  };

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title || !selected) return;
    setNewSubtask("");
    addSubtaskToTask(id, selected.id, { id: `local-${Date.now()}`, title, completed: false });
    selected.subtasks = [...(selected.subtasks || []), { id: `local-${Date.now()}`, title, completed: false }];
    setTasks((old) => old.map((t) => (t.id === selected.id ? selected : t)));
    notify("Subtarea agregada");
  };


  const addCommentstoTasks = (taskId, data) =>{
    addTaskComment(id, taskId, data);
  }

  const toggleSubtask = (subtaskId) => {
    if (!selected) return;
    updateTask(
      selected.id,
      { subtasks: (selected.subtasks || []).map((s) => (s.id === subtaskId ? { ...s, completed: !(s.completed || s.status === "completed") } : s)) },
      true
    );
  };

  const removeTask = async () => {
    if (!selected) return;
    setDeletingTask(true);
    try {
      await deleteProjectTask(id, selected.id);
      setTasks((old) => old.filter((t) => t.id !== selected.id));
      setConfirmDelete(false);
      closeTask();
      notify("Tarea eliminada");
    } catch {
      notify("No se pudo eliminar la tarea", "error");
    } finally {
      setDeletingTask(false);
    }
  };

  /* ---------------- Render ---------------- */
  return (
    <LayoutAdmin
      fluid
      breadcrumbs={[
        { label: "Proyectos", to: "/admin/projects" },
        { label: projectName },
      ]}
    >
      {/* ---------- Encabezado del proyecto ---------- */}
      <section className="admin-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-6">
          <button type="button" onClick={() => navigate("/admin/projects")} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition hover:text-brand-600">
            <FiArrowLeft /> Volver a proyectos
          </button>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-3.5 text-base font-extrabold text-white shadow-brand-sm">
                {initials(projectName)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{projectName}</h1>
                  <Badge tone="green" dot>En curso</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {project?.description || "Planificación, diseño y desarrollo del proyecto"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AvatarStack users={users} max={4} />
              <span className="hidden text-sm text-slate-400 sm:block">
                {users.length} miembro{users.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Métricas */}
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Progreso general</dt>
              <dd className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-slate-900">{progress}%</span>
                <span className="text-xs text-slate-400">{done}/{tasks.length} tareas</span>
              </dd>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {[
              { label: "Fecha de entrega", value: project?.end_date ? formatDate(project.end_date) : "Sin fecha", icon: FiCalendar },
              { label: "Equipo", value: `${users.length || "—"} miembros`, icon: FiUsers },
              { label: "Tareas activas", value: `${tasks.length - done} pendientes`, icon: FiClock },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-slate-100 bg-white p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <m.icon className="text-slate-300" /> {m.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---------- Navegación del tablero ---------- */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-1" role="tablist">
            <ViewTab active={view === "board"} onClick={() => setView("board")} icon={FiColumns} label="Tablero" />
            <ViewTab active={view === "list"} onClick={() => setView("list")} icon={FiList} label="Lista" />
            <ViewTab disabled icon={FiCalendar} label="Calendario" title="Próximamente" />
            <ViewTab disabled icon={FiPaperclip} label="Archivos" title="Próximamente" />
          </div>
          <Button onClick={() => { setDraft({ ...EMPTY_TASK, status: "pending" }); setTaskModal(true); }}>
            <FiPlus /> Nueva tarea
          </Button>
        </div>

        {/* ---------- Filtros ---------- */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por título o descripción..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <div className="relative">
              <FiFlag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="admin-input appearance-none pl-9 pr-8 !py-2 text-[13px]">
                <option value="">Prioridad: todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            </div>
            <div className="relative">
              <FiUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <select value={person} onChange={(e) => setPerson(e.target.value)} className="admin-input max-w-48 appearance-none pl-9 pr-8 !py-2 text-[13px]">
                <option value="">Responsable: todos</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSearch(""); setPriority(""); setPerson(""); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                <FiFilter /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ---------- Contenido ---------- */}
        <div className="bg-slate-50/50 p-5 sm:p-6">
          {loading ? (
            <BoardSkeleton />
          ) : loadError && !project ? (
            <EmptyState icon={FiArchive} title="No se pudo cargar el proyecto" description={loadError} action={<Button variant="secondary" onClick={() => navigate("/admin/projects")}><FiArrowLeft /> Volver</Button>} />
          ) : view === "board" ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="grid min-w-[880px] grid-cols-4 gap-4 xl:min-w-0">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    column={col}
                    tasks={filtered.filter((t) => (t.status || "pending") === col.key)}
                    projectId={id}
                    isDropTarget={dropColumn === col.key}
                    onDragOver={(e) => { e.preventDefault(); setDropColumn(col.key); }}
                    onDragLeave={() => setDropColumn(null)}
                    onDrop={() => handleDrop(col.key)}
                    onOpen={openTask}
                    onDragStart={setDragged}
                    onAdd={() => { setDraft({ ...EMPTY_TASK, status: col.key }); setTaskModal(true); }}
                    hasFilters={hasFilters}
                  />
                ))}
              </div>
            </div>
          ) : (
            <TaskTable tasks={filtered} onOpen={openTask} />
          )}
        </div>
      </section>

      {/* ---------- Modal nueva tarea ---------- */}
      <Modal
        open={taskModal}
        onClose={() => { setTaskModal(false); setDraft(EMPTY_TASK); }}
        size="xl"
        title="Nueva tarea"
        subtitle="Agrega una tarea al tablero del proyecto."
        footer={
          <>
            <Button variant="secondary" onClick={() => { setTaskModal(false); setDraft(EMPTY_TASK); }} disabled={saving}>Cancelar</Button>
            <Button loading={saving} onClick={saveNewTask}><FiPlus /> Crear tarea</Button>
          </>
        }
      >
        <form onSubmit={saveNewTask} className="grid gap-5 sm:grid-cols-2">
          <Field label="Título de la tarea" required className="sm:col-span-2">
            <input autoFocus required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. Diseñar página de inicio" className="admin-input" />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Contexto, criterios de aceptación, enlaces..." className="admin-input min-h-20 resize-y" />
          </Field>
          <Field label="Estado">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="admin-input">
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} className="admin-input">
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </Field>
          <Field label="Responsable">
            <select value={draft.assigned_to} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })} className="admin-input">
              <option value="">Sin asignar</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Fecha de entrega">
            <input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} className="admin-input" />
          </Field>
          <Field label="Estimación (horas)" className="sm:col-span-2">
            <input type="number" min="0" step="0.5" value={draft.estimated_hours} onChange={(e) => setDraft({ ...draft, estimated_hours: e.target.value })} placeholder="0" className="admin-input sm:max-w-56" />
          </Field>
        </form>
      </Modal>

      {/* ---------- Detalle de tarea ---------- */}
      {selected && (
        <TaskDrawer
          task={selected}
          users={users}
          comments={comments}
          attachments={attachments}
          tab={detailTab}
          setTab={setDetailTab}
          comment={comment}
          setComment={setComment}
          onComment={addComment}
          fileRef={fileRef}
          onFiles={uploadFiles}
          onClose={closeTask}
          onUpdate={(patch) => updateTask(selected.id, patch)}
          onDelete={() => setConfirmDelete(true)}
          newSubtask={newSubtask}
          setNewSubtask={setNewSubtask}
          onAddSubtask={addSubtask}
          onToggleSubtask={toggleSubtask}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeTask}
        loading={deletingTask}
        title="Eliminar tarea"
        message={`“${selected?.title}” se eliminará definitivamente del proyecto. Esta acción no se puede deshacer.`}
      />
    </LayoutAdmin>
  );
};

/* ================================================================== */
/* Subcomponentes                                                      */
/* ================================================================== */

const ViewTab = ({ active, icon: Icon, label, ...rest }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    className={cx(
      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
      active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
      rest.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-500"
    )}
    {...rest}
  >
    <Icon /> {label}
  </button>
);

const KanbanColumn = ({ column, tasks, projectId, isDropTarget, onDragOver, onDragLeave, onDrop, onOpen, onDragStart, onAdd, hasFilters }) => {
  const Icon = column.icon;
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cx(
        "flex min-h-96 flex-col rounded-2xl border bg-slate-100/70 p-3 transition",
        isDropTarget ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200" : "border-slate-200/70"
      )}
    >
      <header className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={cx("flex h-7 w-7 items-center justify-center rounded-lg", column.bg, column.text)}>
            <Icon className="text-sm" />
          </span>
          <h2 className="text-[13px] font-bold text-slate-700">{column.label}</h2>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-500 ring-1 ring-slate-200">
            {tasks.length}
          </span>
        </div>
        <button type="button" onClick={onAdd} title="Agregar tarea" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-brand-600">
          <FiPlus />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} projectId={projectId} color={column.color} onOpen={() => onOpen(task)} onDrag={() => onDragStart(task)} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center">
            <FiGrid className="text-xl text-slate-300" />
            <p className="mt-2 text-[13px] font-medium text-slate-500">{hasFilters ? "Sin coincidencias" : "No hay tareas"}</p>
            <p className="mt-0.5 text-xs text-slate-400">Arrastra una tarea aquí</p>
          </div>
        )}
      </div>

      <button type="button" onClick={onAdd} className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/70 py-2 text-[13px] font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand-600">
        <FiPlus /> Agregar tarea
      </button>
    </section>
  );
};

const TaskCard = ({ task, projectId, color, onOpen, onDrag }) => {
  const user = assigneeOf(task);
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.completed || s.status === "completed").length;
  const tags = task.tags || task.labels || [];
  const commentCount = task.comments_count ?? task.comments?.length ?? 0;
  const fileCount = task.attachments_count ?? task.files_count ?? task.attachments?.length ?? task.files?.length ?? 0;
  const late = isOverdue(task.due_date) && task.status !== "completed";
  const prio = priorityMeta(task.priority);

  return (
    <article
      draggable
      onDragStart={onDrag}
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-slate-400">PR-{projectId}-{task.id}</span>
        <span className="rounded-md p-1 text-slate-300 transition group-hover:text-slate-400"><FiMoreHorizontal /></span>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 2).map((tag, i) => (
            <span key={tag.id || tag.name || tag || i} className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${tag.color || color}1a`, color: tag.color || color }}>
              {tag.name || tag}
            </span>
          ))}
        </div>
      )}
      <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-800">{task.title}</h3>
      {task.description && <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500">{task.description}</p>}

      {subtasks.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium text-slate-500"><FiCheckCircle /> {doneCount}/{subtasks.length} subtareas</span>
            <span className="font-bold tabular-nums text-slate-600">{Math.round((doneCount / subtasks.length) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / subtasks.length) * 100}%`, background: color }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className={cx("flex items-center gap-1 font-medium", late ? "text-red-600" : "text-slate-500")}>
          <FiCalendar /> {task.due_date ? formatDate(task.due_date) : "Sin fecha"}
          {late && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase">Vencida</span>}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-slate-500">
          <i className={cx("h-2 w-2 rounded-full", prio.dot)} /> {prio.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <Avatar user={user} size="xs" />
        <div className="flex items-center gap-2.5 text-xs text-slate-400">
          {commentCount > 0 && <span className="flex items-center gap-1"><FiMessageSquare /> {commentCount}</span>}
          {fileCount > 0 && <span className="flex items-center gap-1"><FiPaperclip /> {fileCount}</span>}
          {task.estimated_hours > 0 && <span className="flex items-center gap-1"><FiClock /> {task.estimated_hours}h</span>}
        </div>
      </div>
    </article>
  );
};

const TaskTable = ({ tasks, onOpen }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="admin-table-head">
            <th className="px-5 py-3.5">Tarea</th>
            <th className="px-5 py-3.5">Estado</th>
            <th className="px-5 py-3.5">Prioridad</th>
            <th className="px-5 py-3.5">Responsable</th>
            <th className="px-5 py-3.5">Entrega</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const col = columnOf(task.status);
            const prio = priorityMeta(task.priority);
            const user = assigneeOf(task);
            return (
              <tr key={task.id} onClick={() => onOpen(task)} className="cursor-pointer transition hover:bg-slate-50">
                <td className="max-w-80 px-5 py-3.5">
                  <p className="truncate font-medium text-slate-800">{task.title}</p>
                  <p className="truncate text-xs text-slate-400">{task.description || "—"}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", col.bg, col.text)}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} /> {col.label}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <i className={cx("h-2 w-2 rounded-full", prio.dot)} /> {prio.label}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-2 text-slate-600">
                    <Avatar user={user} size="xs" /> {user?.name || "Sin asignar"}
                  </span>
                </td>
                <td className={cx("whitespace-nowrap px-5 py-3.5", isOverdue(task.due_date) && task.status !== "completed" ? "font-semibold text-red-600" : "text-slate-600")}>
                  {task.due_date ? formatDate(task.due_date) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {tasks.length === 0 && (
      <EmptyState icon={FiList} title="No se encontraron tareas" description="Ajusta los filtros o crea una nueva tarea." />
    )}
  </div>
);

/* ---------------- Drawer de detalle ---------------- */

const TaskDrawer = ({
  task, users, comments, attachments, tab, setTab, comment, setComment,
  onComment, fileRef, onFiles, onClose, onUpdate, onDelete,
  newSubtask, setNewSubtask, onAddSubtask, onToggleSubtask,
}) => {
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.completed || s.status === "completed").length;

  return (
    <Drawer open wide onClose={onClose}>
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-wide text-slate-400">TAREA #{task.id}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><FiCheck /> Guardado</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="Copiar enlace" onClick={() => navigator.clipboard?.writeText(window.location.href)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <FiLink />
          </button>
          <button type="button" title="Eliminar tarea" onClick={onDelete} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
            <FiTrash2 />
          </button>
          <button type="button" title="Cerrar" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <FiX className="text-lg" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1.5fr_1fr]">
        {/* Columna principal */}
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <input
            key={`title-${task.id}`}
            defaultValue={task.title || ""}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== task.title) onUpdate({ title: v }); }}
            aria-label="Título de la tarea"
            className="w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-bold tracking-tight text-slate-900 transition focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
          <textarea
            key={`desc-${task.id}`}
            rows={3}
            defaultValue={task.description || ""}
            onBlur={(e) => { if (e.target.value !== (task.description || "")) onUpdate({ description: e.target.value }); }}
            placeholder="Agregar una descripción..."
            aria-label="Descripción de la tarea"
            className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-1 text-sm leading-6 text-slate-500 transition placeholder:text-slate-300 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />

          {/* Propiedades */}
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-y border-slate-100 py-5 sm:grid-cols-2">
            <Property icon={FiActivity} label="Estado">
              <select value={task.status || "pending"} onChange={(e) => onUpdate({ status: e.target.value })} className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold">
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Property>
            <Property icon={FiFlag} label="Prioridad">
              <select value={task.priority || "medium"} onChange={(e) => onUpdate({ priority: e.target.value })} className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold">
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </Property>
            <Property icon={FiUser} label="Responsable">
              <select value={assigneeId(task) || ""} onChange={(e) => onUpdate({ assigned_to: e.target.value || null })} className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold">
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Property>
            <Property icon={FiCalendar} label="Fecha límite">
              <input type="date" value={task.due_date?.slice?.(0, 10) || ""} onChange={(e) => onUpdate({ due_date: e.target.value || null })} className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold" />
            </Property>
            <Property icon={FiClock} label="Estimación (h)">
              <input type="number" min="0" step="0.5" value={task.estimated_hours || ""} onChange={(e) => onUpdate({ estimated_hours: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" className="admin-input !w-24 !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold" />
            </Property>
          </div>

          {/* Subtareas */}
          <section className="border-b border-slate-100 py-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><FiCheckCircle className="text-emerald-500" /> Subtareas</h3>
              <span className="text-xs font-semibold tabular-nums text-slate-400">{doneCount}/{subtasks.length}</span>
            </div>
            {subtasks.length > 0 && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / subtasks.length) * 100}%` }} />
              </div>
            )}
            <div className="mt-2 space-y-0.5">
              {subtasks.map((s) => {
                const checked = Boolean(s.completed || s.status === "completed");
                return (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-slate-50">
                    <input type="checkbox" checked={checked} onChange={() => onToggleSubtask(s.id)} className="peer sr-only" />
                    <span className={cx("flex h-5 w-5 items-center justify-center rounded-md border text-[11px] transition", checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent")}>
                      <FiCheck />
                    </span>
                    <span className={cx("text-sm", checked ? "text-slate-400 line-through" : "text-slate-700")}>{s.title}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2">
              <FiPlus className="shrink-0 text-slate-400" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddSubtask()}
                placeholder="Agregar subtarea..."
                className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              <button type="button" onClick={onAddSubtask} className="shrink-0 text-[13px] font-bold text-brand-600 hover:text-brand-700">Agregar</button>
            </div>
          </section>

          {/* Archivos */}
          <section className="py-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><FiPaperclip className="text-slate-400" /> Archivos</h3>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">
                <FiUpload /> Adjuntar
              </button>
              <input ref={fileRef} type="file" multiple hidden onChange={onFiles} />
            </div>
            {attachments.length > 0 ? (
              <div className="mt-3 space-y-2">
                {attachments.map((f, i) => (
                  <div key={f.id || i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><FiFile /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-700">{f.name || f.file_name || `Archivo ${i + 1}`}</p>
                      <p className="text-xs text-slate-400">{f.size ? `${Math.ceil(f.size / 1024)} KB` : "Archivo adjunto"}</p>
                    </div>
                    {(f.url || f.path) && (
                      <a href={f.url || f.path} download title="Descargar" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                        <FiDownload />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
                <FiUpload className="text-xl text-slate-400" />
                <span className="text-[13px] text-slate-500">Arrastra archivos o <b className="text-brand-600">selecciona desde tu equipo</b></span>
                <span className="text-xs text-slate-400">Máximo 10 MB por archivo</span>
              </button>
            )}
          </section>
        </div>

        {/* Columna de actividad */}
        <div className="flex min-h-80 flex-col border-t border-slate-200 bg-slate-50/70 lg:border-l lg:border-t-0">
          <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
            <ActivityTab active={tab === "comments"} onClick={() => setTab("comments")} icon={FiMessageSquare} label="Comentarios" count={comments.length} />
            <ActivityTab active={tab === "activity"} onClick={() => setTab("activity")} icon={FiActivity} label="Actividad" />
          </div>

          {tab === "comments" ? (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {comments.map((c, i) => (
                  <div key={c.id || i} className="flex items-start gap-2.5">
                    <Avatar user={c.user || c.author} size="xs" />
                    <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-white p-3 ring-1 ring-slate-200/70">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-[13px] text-slate-800">{c.user?.name || c.author?.name || "Usuario"}</strong>
                        <time className="text-[11px] text-slate-400">{c.created_at ? formatDate(c.created_at) : "Ahora"}</time>
                      </p>
                      <p className="mt-1 text-[13px] leading-5 text-slate-600">{c.comment || c.content || c.body}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-slate-400">
                    <FiMessageSquare className="text-2xl text-slate-300" />
                    Inicia la conversación sobre esta tarea
                  </div>
                )}
              </div>
              <div className="border-t border-slate-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <Avatar user={{ name: "Tú" }} size="xs" />
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
                    <textarea
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onComment(); }}
                      placeholder="Escribe un comentario..."
                      className="w-full resize-none p-2.5 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none"
                    />
                    <div className="flex items-center justify-between border-t border-slate-100 px-2.5 py-1.5">
                      <span className="hidden text-[11px] text-slate-400 sm:block">⌘ + Enter para enviar</span>
                      <button type="button" disabled={!comment.trim()} onClick={onComment} className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40">
                        <FiSend /> Enviar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 p-5">
              {[
                { icon: FiCheckCircle, title: "Tarea actualizada", desc: "Los cambios más recientes aparecen aquí." },
                { icon: FiActivity, title: "Actividad del equipo", desc: "El historial se sincroniza con el proyecto." },
              ].map((a) => (
                <div key={a.title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><a.icon className="text-sm" /></span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">{a.title}</p>
                    <p className="mt-0.5 text-xs leading-4 text-slate-400">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};

const Property = ({ icon: Icon, label, children }) => (
  <div className="flex min-w-0 items-center justify-between gap-2">
    <span className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-slate-500">
      <Icon className="text-slate-400" /> {label}
    </span>
    <span className="min-w-0">{children}</span>
  </div>
);

const ActivityTab = ({ active, icon: Icon, label, count }) => (
  <button
    type="button"
    className={cx(
      "-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-3 text-[13px] font-semibold transition",
      active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-400 hover:text-slate-600"
    )}
  >
    <Icon /> {label}
    {typeof count === "number" && (
      <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">{count}</span>
    )}
  </button>
);

const BoardSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {COLUMNS.map((c) => (
      <div key={c.key} className="rounded-2xl border border-slate-200/70 bg-slate-100/70 p-3">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2.5 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default Project;
