/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiActivity,
  FiArchive,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiDownload,
  FiEye,
  FiFilter,
  FiFlag,
  FiGitBranch,
  FiGrid,
  FiLink,
  FiList,
  FiMessageSquare,
  FiMaximize2,
  FiMinimize2,
  FiChevronsUp,
  FiChevronsDown,
  FiPaperclip,
  FiPlus,
  FiRepeat,
  FiTrash2,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
  FiColumns,
} from "react-icons/fi";
import CollapsibleSection from "../../components/admin/CollapsibleSection";
import useDisplayPreference from "../../hooks/useDisplayPreference";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  MentionComposer,
  Modal,
  RichText,
  RichTextEditor,
  SearchInput,
  SubtaskProgress,
  UserMultiSelect,
  useToast,
} from "../../components/admin";
import {
  addTaskComment,
  createProjectTask,
  deleteProjectTask,
  fetchProject,
  fetchProjectTasks,
  fetchTask,
  fetchTaskComments,
  fetchTaskFiles,
  fetchUsers,
  updateProjectTask,
  uploadTaskFiles,
  addSubtaskToTask,
} from "../../services/admin";
import {
  cx,
  formatDate,
  priorityMeta,
  projectStatusMeta,
} from "../../utils/format";
import { prepareFilesForUpload } from "../../utils/images";
import CalendarTab from "./project/CalendarTab";
import FilePreviewModal from "./project/FilePreviewModal";
import { FileIcon } from "./project/FileViews";
import FilesTab from "./project/FilesTab";
import DiagramsTab, { TaskDiagramsSection } from "./project/DiagramsTab";
import { fetchTaskDiagrams } from "../../services/diagrams";
import {
  assigneeNames,
  assigneesPayload,
  taskAssigneeIds,
  taskAssignees,
} from "../../utils/assignees";
import {
  formatBytes,
  canPreviewFile,
  normalizeProjectFile,
} from "../../utils/files";
import { peopleMentionedIn } from "../../utils/mentions";
import {
  isEmptyRichText,
  richTextPreview,
  richTextToPlain,
  toRichHtml,
} from "../../utils/richText";
import {
  ONGOING_LABEL,
  RECURRENCE_OPTIONS,
  TASK_TYPE_ONCE,
  TASK_TYPE_ONGOING,
  TASK_TYPE_OPTIONS,
  isOngoingTask,
  nextOccurrenceFrom,
  nextRoundPayload,
  ongoingLabel,
  recurrenceMeta,
  recurrenceOf,
  taskDescriptionText,
  taskSchedule,
} from "../../utils/tasks";
import { getStoredUser } from "../../services/session";

const COLUMNS = [
  {
    key: "pending",
    label: "Pendientes",
    color: "#8b5cf6",
    bg: "bg-violet-50",
    text: "text-violet-600",
    icon: FiArchive,
  },
  {
    key: "in_progress",
    label: "En progreso",
    color: "#0ea5e9",
    bg: "bg-sky-50",
    text: "text-sky-600",
    icon: FiActivity,
  },
  {
    key: "completed",
    label: "Finalizadas",
    color: "#10b981",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    icon: FiCheckCircle,
  },
  {
    key: "rejected",
    label: "Rechazadas",
    color: "#f43f5e",
    bg: "bg-rose-50",
    text: "text-rose-500",
    icon: FiX,
  },
];

const columnOf = (status) =>
  COLUMNS.find((c) => c.key === status) || COLUMNS[0];

/** Vistas de la página; la clave viaja en `?view=` para poder compartirla. */
const VIEW_KEYS = ["board", "list", "calendar", "files", "diagrams"];

const EMPTY_TASK = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  /* Varias personas: ids. `assigned_to` se deriva (la primera) por compatibilidad. */
  assignees: [],
  due_date: "",
  estimated_hours: "",
  /* "once" = puntual (con fecha) · "ongoing" = continua (sin fecha) */
  task_type: TASK_TYPE_ONCE,
  recurrence: "none",
};

/** ¿La tarea tiene asignada a esta persona? (acepta varias personas por tarea). */
const hasAssignee = (task, personId) =>
  taskAssigneeIds(task).some((id) => String(id) === String(personId));

/**
 * Personas mencionadas en un comentario. La API puede devolver objetos de
 * usuario o solo ids; se completan con el directorio `users` cuando existe.
 */
const mentionPeople = (comment, users = []) => {
  const raw =
    comment?.mentions ?? comment?.mentioned_users ?? comment?.mentioned ?? [];
  return (Array.isArray(raw) ? raw : []).map((mention) => {
    const id = mention && typeof mention === "object" ? mention.id : mention;
    const known = users.find((u) => String(u.id) === String(id));
    return {
      ...known,
      id,
      name:
        (mention && typeof mention === "object" && mention.name) ||
        known?.name ||
        `Usuario ${id}`,
    };
  });
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
  /* Filtro por tipo: "" (todas) · "ongoing" (continuas) · "once" (puntuales). */
  const [taskType, setTaskType] = useState("");
  const [view, setView] = useState(() => {
    const requested = searchParams.get("view");
    return VIEW_KEYS.includes(requested) ? requested : "board";
  });
  const [fileCount, setFileCount] = useState(null);
  const [diagramCount, setDiagramCount] = useState(null);
  /* Diagramas de flujo vinculados a la tarea abierta en el detalle. */
  const [taskDiagrams, setTaskDiagrams] = useState([]);
  const [taskDiagramsLoading, setTaskDiagramsLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useDisplayPreference(
    "project.summary",
    false,
  );
  const [filtersOpen, setFiltersOpen] = useDisplayPreference(
    "project.filters",
    false,
  );
  const [compactCards, setCompactCards] = useDisplayPreference(
    "project.compactCards",
    true,
  );
  const [focusMode, setFocusMode] = useDisplayPreference(
    "project.focus",
    false,
  );

  const [taskModal, setTaskModal] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [comment, setComment] = useState("");
  /* Usuario en sesión: firma sus comentarios y no se sugiere a sí mismo. */
  const viewer = useMemo(() => getStoredUser() || { name: "Tú" }, []);
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
      if (!active) return;
      if (p.status === "fulfilled") setProject(p.value);
      else setLoadError("No se pudo cargar el proyecto.");
      setTasks(t.status === "fulfilled" ? t.value : []);
      setUsers(u.status === "fulfilled" ? u.value : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  /* ---------------- Derivados ---------------- */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      // El buscador ignora las etiquetas del texto enriquecido.
      const matches =
        !term ||
        `${task.title || ""} ${taskDescriptionText(task)}`
          .toLowerCase()
          .includes(term);
      return (
        matches &&
        (!priority || task.priority === priority) &&
        (!person || hasAssignee(task, person)) &&
        (!taskType ||
          (taskType === TASK_TYPE_ONGOING
            ? isOngoingTask(task)
            : !isOngoingTask(task)))
      );
    });
  }, [tasks, search, priority, person, taskType]);

  // El calendario solo puede pintar tareas con vencimiento: las continuas no
  // tienen fecha de entrega por definición.
  const tasksWithDate = useMemo(
    () => tasks.filter((task) => Boolean(task.due_date)).length,
    [tasks],
  );
  const ongoingCount = useMemo(() => tasks.filter(isOngoingTask).length, [tasks]);
  const done = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const projectStatus = projectStatusMeta(project?.status);
  const projectName = project?.name || "Detalle del proyecto";
  const hasFilters = Boolean(search || priority || person || taskType);

  /* ---------------- Mutaciones (optimistas) ---------------- */
  const updateTask = async (taskId, patch, quiet = false) => {
    const previous = tasks;
    setTasks((old) =>
      old.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    );
    setSelected((old) => (old?.id === taskId ? { ...old, ...patch } : old));
    try {
      await updateProjectTask(id, taskId, patch);
      if (!quiet) notify("Cambios guardados");
      return true;
    } catch {
      setTasks(previous);
      // Revierte solo los campos que se habían adelantado, para no perder los
      // datos extra del detalle (subtareas, comentarios...) que ya estaban cargados.
      const before = previous.find((t) => t.id === taskId);
      if (before) {
        setSelected((old) => {
          if (old?.id !== taskId) return old;
          const restored = { ...old };
          Object.keys(patch).forEach((key) => {
            restored[key] = before[key];
          });
          return restored;
        });
      }
      notify("No se pudieron guardar los cambios", "error");
      return false;
    }
  };

  /* ---------------- Vistas ---------------- */
  const changeView = (key) => {
    setView(key);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === "board") next.delete("view");
        else next.set("view", key);
        return next;
      },
      { replace: true },
    );
  };

  /** Reprogramación desde el calendario (arrastrar o campo de fecha). */
  const rescheduleTask = async (task, dateISO) => {
    if (!task) return;
    const saved = await updateTask(
      task.id,
      { due_date: dateISO || null },
      true,
    );
    if (!saved) return;
    notify(
      dateISO
        ? `“${task.title}” reprogramada para el ${formatDate(dateISO)}`
        : `Se quitó la fecha de “${task.title}”`,
    );
  };

  const handleFilesCount = useCallback((count) => setFileCount(count), []);
  const handleDiagramsCount = useCallback((count) => setDiagramCount(count), []);

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
    // Las tareas continuas (ongoing) nunca llevan fecha de entrega.
    const ongoing = draft.task_type === TASK_TYPE_ONGOING;
    try {
      const created = await createProjectTask(id, {
        ...draft,
        description: isEmptyRichText(draft.description)
          ? ""
          : toRichHtml(draft.description),
        ...assigneesPayload(draft.assignees),
        estimated_hours:
          draft.estimated_hours === "" ? null : Number(draft.estimated_hours),
        due_date: ongoing ? null : draft.due_date || null,
        task_type: ongoing ? TASK_TYPE_ONGOING : TASK_TYPE_ONCE,
        recurrence: ongoing ? recurrenceOf(draft) : "none",
      });
      setTasks((old) => [created, ...old]);
      setTaskModal(false);
      setDraft(EMPTY_TASK);
      notify(
        ongoing
          ? "Tarea continua creada (sin fecha de entrega)"
          : "Tarea creada correctamente",
      );
    } catch {
      notify("No se pudo crear la tarea", "error");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cambia el tipo de una tarea existente. Al pasar a continua se quita la
   * fecha de entrega en el mismo guardado (una tarea continua no vence).
   */
  const changeTaskType = (task, nextType) => {
    if (!task) return;
    if (nextType === TASK_TYPE_ONGOING) {
      updateTask(task.id, { task_type: TASK_TYPE_ONGOING, due_date: null });
      notify("Tarea marcada como continua (sin fecha de entrega)");
      return;
    }
    updateTask(task.id, { task_type: TASK_TYPE_ONCE });
  };

  /**
   * Programa la siguiente ronda de una tarea continua: crea una tarea puntual
   * con la fecha que toca según la cadencia (semanal, quincenal, mensual…).
   */
  const scheduleNextRound = async (task) => {
    if (!task) return;
    const dateISO = nextOccurrenceFrom(task);
    if (!dateISO) {
      notify("Elige una cadencia para poder programar la siguiente ronda", "info");
      return;
    }
    try {
      const created = await createProjectTask(id, nextRoundPayload(task, dateISO));
      setTasks((old) => [created, ...old]);
      notify(`Siguiente ronda programada para el ${formatDate(dateISO)}`);
    } catch {
      notify("No se pudo programar la siguiente ronda", "error");
    }
  };

  /* ---------------- Detalle de tarea ---------------- */
  const openTask = async (task) => {
    setSelected(task);
    setComments(Array.isArray(task.comments) ? task.comments : []);
    setAttachments(
      Array.isArray(task.attachments || task.files)
        ? task.attachments || task.files
        : [],
    );
    setDetailTab("comments");
    setTaskDiagrams([]);
    setTaskDiagramsLoading(true);
    fetchTaskDiagrams(id, task.id)
      .then((list) => setTaskDiagrams(list))
      .catch(() => setTaskDiagrams([]))
      .finally(() => setTaskDiagramsLoading(false));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("task", task.id);
        return next;
      },
      { replace: true },
    );
    const [detail, comm, files] = await Promise.allSettled([
      fetchTask(id, task.id),
      fetchTaskComments(id, task.id),
      fetchTaskFiles(id, task.id),
    ]);
    if (detail.status === "fulfilled" && detail.value)
      setSelected((old) =>
        old?.id === task.id ? { ...old, ...detail.value } : old,
      );
    // Si el API no devuelve comentarios/adjuntos se usan los del payload de la
    // tarea (nunca los de la tarea anterior, que ya no se están viendo).
    setComments(
      comm.status === "fulfilled" && comm.value.length
        ? comm.value
        : Array.isArray(task.comments)
          ? task.comments
          : [],
    );
    setAttachments(
      files.status === "fulfilled" && files.value.length
        ? files.value
        : Array.isArray(task.attachments || task.files)
          ? task.attachments || task.files
          : [],
    );
  };

  const closeTask = () => {
    setSelected(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("task");
        return next;
      },
      { replace: true },
    );
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
    if (!value || isEmptyRichText(value) || !selected) return;
    // Personas mencionadas con "@": se releen del texto visible al guardar
    // (el comentario viaja como HTML, con su formato).
    const mentioned = peopleMentionedIn(richTextToPlain(value), users);
    // Se guarda HTML sencillo y normalizado (`<b>` -> `<strong>`, `<div>` -> `<p>`).
    const payload = toRichHtml(value);
    const optimistic = {
      id: `local-${Date.now()}`,
      comment: payload,
      user: { name: "Tú" },
      created_at: new Date().toISOString(),
      mentions: mentioned,
    };
    setComments((old) => [...old, optimistic]);
    setComment("");
    try {
      const saved = await addTaskComment(
        id,
        selected.id,
        payload,
        mentioned.map((p) => p.id),
      );
      setComments((old) =>
        old.map((c) =>
          c.id === optimistic.id
            ? {
                ...optimistic,
                ...(saved && typeof saved === "object" ? saved : null),
                mentions: saved?.mentions?.length ? saved.mentions : mentioned,
              }
            : c,
        ),
      );
      if (mentioned.length)
        notify(
          `Comentario enviado · ${mentioned.length} ${
            mentioned.length === 1
              ? "persona mencionada"
              : "personas mencionadas"
          }`,
        );
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
      setAttachments((old) => [
        ...old,
        ...preparedFiles.map((file) => ({
          id: `local-${file.name}`,
          name: file.name,
          size: file.size,
        })),
      ]);
      await uploadTaskFiles(id, selected.id, preparedFiles);
      notify(
        `${preparedFiles.length} archivo${preparedFiles.length === 1 ? "" : "s"} adjuntado${preparedFiles.length === 1 ? "" : "s"}`,
      );
    } catch {
      notify("Los archivos no pudieron sincronizarse", "error");
    }
  };

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title || !selected) return;
    setNewSubtask("");
    addSubtaskToTask(id, selected.id, {
      id: `local-${Date.now()}`,
      title,
      completed: false,
    });
    selected.subtasks = [
      ...(selected.subtasks || []),
      { id: `local-${Date.now()}`, title, completed: false },
    ];
    setTasks((old) => old.map((t) => (t.id === selected.id ? selected : t)));
    notify("Subtarea agregada");
  };

  const toggleSubtask = (subtaskId) => {
    if (!selected) return;
    updateTask(
      selected.id,
      {
        subtasks: (selected.subtasks || []).map((s) =>
          s.id === subtaskId
            ? { ...s, completed: !(s.completed || s.status === "completed") }
            : s,
        ),
      },
      true,
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
      compact
      focusMode={focusMode}
      breadcrumbs={[
        { label: "Proyectos", to: "/admin/projects" },
        { label: projectName },
      ]}
    >
      {/* ---------- Encabezado del proyecto ---------- */}
      <section className="admin-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/projects")}
              className="flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <FiArrowLeft />
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-sm font-extrabold text-white">
                  {project?.logo ? (
                    <img
                      src={project.logo}
                      alt=""
                      className="h-full w-full bg-white object-contain"
                    />
                  ) : (
                    projectName.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    {projectName}
                  </h1>
                  <Badge tone={projectStatus.tone} dot>
                    {projectStatus.label}
                  </Badge>
                </div>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <span
              className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-brand-700"
              title={`${done} de ${tasks.length} tareas finalizadas`}
            >
              {progress}% <span className="hidden sm:inline">completado</span>
            </span>
              <Button
                variant="subtle"
                aria-pressed={focusMode}
                onClick={() => setFocusMode((value) => !value)}
              >
                {focusMode ? <FiMinimize2 /> : <FiMaximize2 />}
                {focusMode ? "Salir del enfoque" : "Modo enfoque"}
              </Button>
            </div>
          </div>
          {!focusMode && (
            <CollapsibleSection
              title="Información del proyecto"
              summary={`${tasks.length} tareas · ${done} finalizadas`}
              open={summaryOpen}
              onToggle={() => setSummaryOpen((open) => !open)}
              className="mt-2"
            >
              <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="min-w-0 text-sm text-slate-500">
                  {project?.description || "Sin descripción del proyecto."}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <AvatarStack users={users} max={4} />
                  <span className="text-xs text-slate-500">
                    {users.length} miembros
                  </span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  {
                    label: "Progreso general",
                    value: `${progress}% · ${done}/${tasks.length} tareas`,
                    icon: FiCheckCircle,
                  },
                  {
                    label: "Fecha de entrega",
                    value: project?.end_date
                      ? formatDate(project.end_date)
                      : "Sin fecha",
                    icon: FiCalendar,
                  },
                  {
                    label: "Equipo",
                    value: `${users.length} miembros`,
                    icon: FiUsers,
                  },
                  {
                    label: "Tareas activas",
                    value: `${tasks.filter((task) => !["completed", "rejected"].includes(task.status)).length} pendientes`,
                    icon: FiClock,
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-xl border border-slate-200/70 bg-white p-3"
                  >
                    <dt className="text-[11px] font-medium text-slate-500">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <metric.icon className="shrink-0 text-slate-400" />{" "}
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CollapsibleSection>
          )}
        </div>

        {/* ---------- Navegación del tablero ---------- */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex flex-wrap items-center gap-1" role="tablist">
            <ViewTab
              active={view === "board"}
              onClick={() => changeView("board")}
              icon={FiColumns}
              label="Tablero"
            />
            <ViewTab
              active={view === "list"}
              onClick={() => changeView("list")}
              icon={FiList}
              label="Lista"
            />
            <ViewTab
              active={view === "calendar"}
              onClick={() => changeView("calendar")}
              icon={FiCalendar}
              label="Calendario"
              count={tasksWithDate}
              title="Vencimientos y entregas del proyecto"
            />
            <ViewTab
              active={view === "files"}
              onClick={() => changeView("files")}
              icon={FiPaperclip}
              label="Archivos"
              count={fileCount}
              title="Archivos del proyecto y de sus tareas"
            />
            <ViewTab
              active={view === "diagrams"}
              onClick={() => changeView("diagrams")}
              icon={FiGitBranch}
              label="Diagramas"
              count={diagramCount}
              title="Diagramas de flujo del proyecto y de sus tareas"
            />
          </div>
          <div className="flex items-center gap-2">
            {view === "files" && (
              <span className="hidden text-xs text-slate-400 lg:block">
                {fileCount === null
                  ? "Cargando archivos…"
                  : `${fileCount} archivo${fileCount === 1 ? "" : "s"} en el proyecto`}
              </span>
            )}
            <Button
              onClick={() => {
                setDraft({ ...EMPTY_TASK, status: "pending" });
                setTaskModal(true);
              }}
            >
              <FiPlus /> Nueva tarea
            </Button>
          </div>
        </div>

        {/* ---------- Filtros (no aplican al explorador de archivos) ---------- */}
        <div
          className={cx(
            "border-b border-slate-100 bg-white px-3 py-2 sm:px-4",
            (view === "files" || view === "diagrams") && "hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por título o descripción..."
              className="min-w-[180px] flex-1 sm:max-w-xs"
              inputClassName="!py-2"
            />
            <Button
              variant="ghost"
              aria-expanded={filtersOpen}
              aria-controls="project-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <FiFilter /> Filtros
              {(priority || person) && (
                <span className="rounded bg-brand-100 px-1.5 text-xs text-brand-700">
                  {Number(Boolean(priority)) + Number(Boolean(person))}
                </span>
              )}
              <FiChevronDown
                className={cx(
                  "transition-transform",
                  filtersOpen && "rotate-180",
                )}
              />
            </Button>
            {view === "board" && (
              <Button
                variant="ghost"
                aria-pressed={compactCards}
                onClick={() => setCompactCards((value) => !value)}
              >
                {compactCards ? <FiChevronsDown /> : <FiChevronsUp />}
                {compactCards ? "Ampliar tarjetas" : "Compactar tarjetas"}
              </Button>
            )}
            <span
              className="ml-auto text-xs tabular-nums text-slate-500"
              role="status"
            >
              {filtered.length} de {tasks.length} tareas
            </span>
            {hasFilters && (
              <Button
                variant="subtle"
                onClick={() => {
                  setSearch("");
                  setPriority("");
                  setPerson("");
                  setTaskType("");
                }}
              >
                <FiX /> Limpiar filtros
              </Button>
            )}
          </div>
          <div id="project-filters" hidden={!filtersOpen}>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
              <div className="relative">
                <FiFlag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <select
                  aria-label="Filtrar por prioridad"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="admin-input appearance-none pl-9 pr-8 !py-2 text-[13px]"
                >
                  <option value="">Prioridad: todas</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
                <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              </div>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <select
                  aria-label="Filtrar por responsable"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="admin-input max-w-48 appearance-none pl-9 pr-8 !py-2 text-[13px]"
                >
                  <option value="">Responsable: todos</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              </div>
              <div className="relative">
                <FiRepeat className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <select
                  aria-label="Filtrar por tipo de tarea"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="admin-input appearance-none pl-9 pr-8 !py-2 text-[13px]"
                >
                  <option value="">Tipo: todos</option>
                  <option value={TASK_TYPE_ONGOING}>Solo continuas</option>
                  <option value={TASK_TYPE_ONCE}>Solo puntuales</option>
                </select>
                <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              </div>
              {ongoingCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FiRepeat className="text-brand-500" />
                  {ongoingCount} tarea{ongoingCount === 1 ? "" : "s"} continua
                  {ongoingCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Contenido ---------- */}
        <div className="bg-slate-50/50 p-3 sm:p-4">
          {loading ? (
            <BoardSkeleton />
          ) : loadError && !project ? (
            <EmptyState
              icon={FiArchive}
              title="No se pudo cargar el proyecto"
              description={loadError}
              action={
                <Button
                  variant="secondary"
                  onClick={() => navigate("/admin/projects")}
                >
                  <FiArrowLeft /> Volver
                </Button>
              }
            />
          ) : view === "board" ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="grid min-w-[960px] grid-cols-4 items-start gap-3">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    column={col}
                    tasks={filtered.filter(
                      (t) => (t.status || "pending") === col.key,
                    )}
                    projectId={id}
                    users={users}
                    compactCards={compactCards}
                    isDropTarget={dropColumn === col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropColumn(col.key);
                    }}
                    onDragLeave={() => setDropColumn(null)}
                    onDrop={() => handleDrop(col.key)}
                    onOpen={openTask}
                    onDragStart={setDragged}
                    onAdd={() => {
                      setDraft({ ...EMPTY_TASK, status: col.key });
                      setTaskModal(true);
                    }}
                    hasFilters={hasFilters}
                  />
                ))}
              </div>
            </div>
          ) : view === "list" ? (
            <TaskTable tasks={filtered} users={users} onOpen={openTask} />
          ) : view === "calendar" ? (
            <CalendarTab
              project={project}
              tasks={filtered}
              onOpenTask={openTask}
              onReschedule={rescheduleTask}
            />
          ) : view === "diagrams" ? (
            <DiagramsTab
              projectId={id}
              tasks={tasks}
              onOpenTask={openTask}
              onCountChange={handleDiagramsCount}
            />
          ) : (
            <FilesTab
              projectId={id}
              projectName={projectName}
              tasks={tasks}
              onOpenTask={openTask}
              onCountChange={handleFilesCount}
            />
          )}
        </div>
      </section>

      {/* ---------- Modal nueva tarea ---------- */}
      <Modal
        open={taskModal}
        onClose={() => {
          setTaskModal(false);
          setDraft(EMPTY_TASK);
        }}
        size="xl"
        title="Nueva tarea"
        subtitle="Agrega una tarea al tablero del proyecto."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setTaskModal(false);
                setDraft(EMPTY_TASK);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button loading={saving} onClick={saveNewTask}>
              <FiPlus /> Crear tarea
            </Button>
          </>
        }
      >
        <form onSubmit={saveNewTask} className="grid gap-5 sm:grid-cols-2">
          <Field label="Título de la tarea" required className="sm:col-span-2">
            <input
              autoFocus
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ej. Diseñar página de inicio"
              className="admin-input"
            />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <RichTextEditor
              value={draft.description}
              onChange={(html) => setDraft({ ...draft, description: html })}
              placeholder="Contexto, criterios de aceptación, enlaces..."
              minHeightClass="min-h-20"
              maxHeightClass="max-h-64"
              ariaLabel="Descripción de la tarea"
            />
          </Field>
          <Field
            label="Tipo de tarea"
            hint={
              draft.task_type === TASK_TYPE_ONGOING
                ? "Continua: sin fecha de entrega, se mantiene activa hasta finalizarla."
                : "Puntual: se entrega en una fecha concreta."
            }
          >
            <select
              value={draft.task_type}
              onChange={(e) => {
                const value = e.target.value;
                setDraft({
                  ...draft,
                  task_type: value,
                  // Una tarea continua no guarda fecha de entrega.
                  due_date: value === TASK_TYPE_ONGOING ? "" : draft.due_date,
                  recurrence:
                    value === TASK_TYPE_ONGOING ? draft.recurrence : "none",
                });
              }}
              className="admin-input"
            >
              {TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="admin-input"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioridad">
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              className="admin-input"
            >
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </Field>
          <Field
            label="Responsables"
            hint="Puedes asignar a varias personas; todas la verán en “Mi trabajo”."
          >
            <UserMultiSelect
              users={users}
              value={draft.assignees}
              onChange={(ids) => setDraft({ ...draft, assignees: ids })}
              placeholder="Sin asignar"
              ariaLabel="Responsables de la tarea"
            />
          </Field>
          {draft.task_type === TASK_TYPE_ONGOING ? (
            <Field
              label="Cadencia"
              hint={
                recurrenceOf(draft) === "none"
                  ? "Sin cadencia: la tarea se queda abierta hasta finalizarla."
                  : recurrenceMeta(recurrenceOf(draft)).hint
              }
            >
              <select
                value={draft.recurrence}
                onChange={(e) =>
                  setDraft({ ...draft, recurrence: e.target.value })
                }
                className="admin-input"
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Fecha de entrega">
              <input
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                className="admin-input"
              />
            </Field>
          )}
          <Field label="Estimación (horas)" className="sm:col-span-2">
            <input
              type="number"
              min="0"
              step="0.5"
              value={draft.estimated_hours}
              onChange={(e) =>
                setDraft({ ...draft, estimated_hours: e.target.value })
              }
              placeholder="0"
              className="admin-input sm:max-w-56"
            />
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
          viewer={viewer}
          fileRef={fileRef}
          onFiles={uploadFiles}
          onClose={closeTask}
          onUpdate={(patch) => updateTask(selected.id, patch)}
          onChangeType={(type) => changeTaskType(selected, type)}
          onScheduleNext={() => scheduleNextRound(selected)}
          onDelete={() => setConfirmDelete(true)}
          newSubtask={newSubtask}
          setNewSubtask={setNewSubtask}
          onAddSubtask={addSubtask}
          onToggleSubtask={toggleSubtask}
          projectId={id}
          diagrams={taskDiagrams}
          diagramsLoading={taskDiagramsLoading}
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

const ViewTab = ({ active, icon: Icon, label, count, ...rest }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    className={cx(
      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
      active
        ? "bg-brand-50 text-brand-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
      rest.disabled &&
        "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-500",
    )}
    {...rest}
  >
    <Icon /> {label}
    {typeof count === "number" && (
      <span
        className={cx(
          "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
          active ? "bg-white text-brand-700" : "bg-slate-200/70 text-slate-500",
        )}
      >
        {count}
      </span>
    )}
  </button>
);

const KanbanColumn = ({
  column,
  tasks,
  projectId,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpen,
  onDragStart,
  onAdd,
  hasFilters,
  compactCards,
  users = [],
}) => {
  const Icon = column.icon;
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cx(
        "flex min-h-[420px] min-w-0 flex-col rounded-xl border bg-slate-100/70 p-2.5 transition",
        isDropTarget
          ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200"
          : "border-slate-200/70",
      )}
    >
      <header className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              column.bg,
              column.text,
            )}
          >
            <Icon className="text-sm" />
          </span>
          <h2 className="text-[13px] font-bold text-slate-700">
            {column.label}
          </h2>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-500 ring-1 ring-slate-200">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          title="Agregar tarea"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-brand-600"
        >
          <FiPlus />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard
            key={`${task.id}-${compactCards}`}
            compact={compactCards}
            task={task}
            users={users}
            projectId={projectId}
            color={column.color}
            onOpen={() => onOpen(task)}
            onDrag={() => onDragStart(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center">
            <FiGrid className="text-xl text-slate-300" />
            <p className="mt-2 text-[13px] font-medium text-slate-500">
              {hasFilters ? "Sin coincidencias" : "No hay tareas"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Arrastra una tarea aquí
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/70 py-2 text-[13px] font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand-600"
      >
        <FiPlus /> Agregar tarea
      </button>
    </section>
  );
};

const TaskCard = ({ task, users = [], projectId, color, onOpen, onDrag, compact }) => {
  const [expanded, setExpanded] = useState(!compact);
  const detailsId = `task-card-details-${task.id}`;
  const people = taskAssignees(task, users);
  const subtasks = task.subtasks || [];
  const tags = task.tags || task.labels || [];
  const commentCount = task.comments_count ?? task.comments?.length ?? 0;
  const fileCount =
    task.attachments_count ??
    task.files_count ??
    task.attachments?.length ??
    task.files?.length ??
    0;
  const schedule = taskSchedule(task);
  const ongoing = schedule.kind === "ongoing";
  const late = schedule.kind === "overdue";
  const prio = priorityMeta(task.priority);

  return (
    <article
      draggable
      onDragStart={onDrag}
      onClick={onOpen}
      className="group min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-slate-400">
          PR-{projectId}-{task.id}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Ocultar" : "Mostrar"} detalles de ${task.title}`}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <FiChevronDown
            className={cx("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>
      <h3 className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="w-full rounded text-left hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {task.title}
        </button>
      </h3>

      {/* Las tareas continuas se identifican siempre, aunque la tarjeta esté plegada. */}
      {ongoing && (
        <span
          className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700"
          title={schedule.detail}
        >
          <FiRepeat className="shrink-0" />
          <span className="truncate">{ongoingLabel(task)}</span>
        </span>
      )}

      <div id={detailsId} hidden={!expanded}>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={tag.id || tag.name || tag || i}
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: `${tag.color || color}1a`,
                  color: tag.color || color,
                }}
              >
                {tag.name || tag}
              </span>
            ))}
          </div>
        )}
        {task.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500">
            {richTextPreview(task.description, 180)}
          </p>
        )}

        {subtasks.length > 0 && (
          <SubtaskProgress
            className="mt-3"
            subtasks={subtasks}
            showLabel
            barClassName="bg-brand-500"
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span
          className={cx(
            "flex items-center gap-1 font-medium",
            late ? "text-red-600" : ongoing ? "text-brand-600" : "text-slate-500",
          )}
          title={ongoing ? schedule.detail : undefined}
        >
          {ongoing ? <FiRepeat /> : <FiCalendar />}{" "}
          {ongoing ? ONGOING_LABEL : task.due_date ? formatDate(task.due_date) : "Sin fecha"}
          {late && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase">
              Vencida
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-slate-500">
          <i className={cx("h-2 w-2 rounded-full", prio.dot)} /> {prio.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span title={assigneeNames(task, users, 3)} className="flex items-center">
          {people.length ? (
            <AvatarStack users={people} max={3} size="xs" />
          ) : (
            <Avatar user={null} size="xs" />
          )}
        </span>
        <div className="flex items-center gap-2.5 text-xs text-slate-400">
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <FiMessageSquare /> {commentCount}
            </span>
          )}
          {fileCount > 0 && (
            <span className="flex items-center gap-1">
              <FiPaperclip /> {fileCount}
            </span>
          )}
          {task.estimated_hours > 0 && (
            <span className="flex items-center gap-1">
              <FiClock /> {task.estimated_hours}h
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

const TaskTable = ({ tasks, users = [], onOpen }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="admin-table-head">
            <th className="px-5 py-3.5">Tarea</th>
            <th className="px-5 py-3.5">Estado</th>
            <th className="px-5 py-3.5">Prioridad</th>
            <th className="px-5 py-3.5">Responsables</th>
            <th className="px-5 py-3.5">Entrega</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const col = columnOf(task.status);
            const prio = priorityMeta(task.priority);
            const people = taskAssignees(task, users);
            const schedule = taskSchedule(task);
            return (
              <tr
                key={task.id}
                onClick={() => onOpen(task)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                <td className="max-w-80 px-5 py-3.5">
                  <p className="truncate font-medium text-slate-800">
                    {task.title}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {richTextPreview(task.description, 120) || "—"}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      col.bg,
                      col.text,
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: col.color }}
                    />{" "}
                    {col.label}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <i className={cx("h-2 w-2 rounded-full", prio.dot)} />{" "}
                    {prio.label}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-2 text-slate-600">
                    {people.length ? (
                      <AvatarStack users={people} max={3} size="xs" />
                    ) : (
                      <Avatar user={null} size="xs" />
                    )}{" "}
                    <span className="truncate" title={assigneeNames(task, users, 5)}>
                      {assigneeNames(task, users)}
                    </span>
                  </span>
                </td>
                <td
                  className={cx(
                    "whitespace-nowrap px-5 py-3.5",
                    schedule.kind === "overdue"
                      ? "font-semibold text-red-600"
                      : schedule.kind === "ongoing"
                        ? "font-semibold text-brand-600"
                        : "text-slate-600",
                  )}
                >
                  {schedule.kind === "ongoing" ? (
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={schedule.detail}
                    >
                      <FiRepeat /> {ongoingLabel(task)}
                    </span>
                  ) : task.due_date ? (
                    formatDate(task.due_date)
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {tasks.length === 0 && (
      <EmptyState
        icon={FiList}
        title="No se encontraron tareas"
        description="Ajusta los filtros o crea una nueva tarea."
      />
    )}
  </div>
);

/* ---------------- Drawer de detalle ---------------- */

const TaskDrawer = ({
  task,
  users,
  comments,
  attachments,
  tab,
  setTab,
  comment,
  setComment,
  onComment,
  viewer,
  fileRef,
  onFiles,
  onClose,
  onUpdate,
  onChangeType,
  onScheduleNext,
  onDelete,
  newSubtask,
  setNewSubtask,
  onAddSubtask,
  onToggleSubtask,
  projectId,
  diagrams = [],
  diagramsLoading = false,
}) => {
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter(
    (s) => s.completed || s.status === "completed",
  ).length;
  const schedule = taskSchedule(task);
  const ongoing = schedule.kind === "ongoing";
  const cadence = recurrenceOf(task);
  const [previewFile, setPreviewFile] = useState(null);
  // Adjuntos normalizados (tipo, URL absoluta y peso legible) para pintar el
  // icono de cada formato y poder previsualizarlos como en la pestaña Archivos.
  const normalizedAttachments = attachments.map((file) =>
    normalizeProjectFile(file, { task: { id: task.id, title: task.title } }),
  );

  return (
    <Drawer open wide onClose={onClose}>
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-wide text-slate-400">
            TAREA #{task.id}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <FiCheck /> Guardado
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Copiar enlace"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FiLink />
          </button>
          <button
            type="button"
            title="Eliminar tarea"
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <FiTrash2 />
          </button>
          <button
            type="button"
            title="Cerrar"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
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
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) onUpdate({ title: v });
            }}
            aria-label="Título de la tarea"
            className="w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-bold tracking-tight text-slate-900 transition focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
          <div className="mt-2">
            <RichTextEditor
              value={task.description || ""}
              onBlur={(html) => {
                const next = isEmptyRichText(html) ? "" : toRichHtml(html);
                if (next !== (task.description || ""))
                  onUpdate({ description: next });
              }}
              placeholder="Agregar una descripción..."
              ariaLabel="Descripción de la tarea"
              minHeightClass="min-h-20"
              maxHeightClass="max-h-80"
              editorClassName="text-sm leading-6 text-slate-600"
            />
          </div>

          {/* Propiedades */}
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-y border-slate-100 py-5 sm:grid-cols-2">
            <Property icon={FiActivity} label="Estado">
              <select
                aria-label="Estado"
                value={task.status || "pending"}
                onChange={(e) => onUpdate({ status: e.target.value })}
                className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Property>
            <Property icon={FiFlag} label="Prioridad">
              <select
                aria-label="Prioridad"
                value={task.priority || "medium"}
                onChange={(e) => onUpdate({ priority: e.target.value })}
                className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </Property>
            <Property icon={FiUsers} label="Responsables">
              <UserMultiSelect
                compact
                users={users}
                value={taskAssigneeIds(task)}
                onChange={(ids) => onUpdate(assigneesPayload(ids))}
                placeholder="Sin asignar"
                ariaLabel="Responsables"
              />
            </Property>
            <Property icon={FiRepeat} label="Tipo de tarea">
              <select
                aria-label="Tipo de tarea"
                value={ongoing ? TASK_TYPE_ONGOING : TASK_TYPE_ONCE}
                onChange={(e) => onChangeType(e.target.value)}
                className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Property>
            {ongoing ? (
              <Property icon={FiRepeat} label="Cadencia">
                <select
                  aria-label="Cadencia"
                  value={recurrenceOf(task)}
                  onChange={(e) => onUpdate({ recurrence: e.target.value })}
                  className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Property>
            ) : (
              <Property icon={FiCalendar} label="Fecha límite">
                <input
                  type="date"
                  aria-label="Fecha límite"
                  value={task.due_date?.slice?.(0, 10) || ""}
                  onChange={(e) => onUpdate({ due_date: e.target.value || null })}
                  className="admin-input !w-auto !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
                />
              </Property>
            )}
            <Property icon={FiClock} label="Estimación (h)">
              <input
                type="number"
                min="0"
                step="0.5"
                value={task.estimated_hours || ""}
                onChange={(e) =>
                  onUpdate({
                    estimated_hours:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="admin-input !w-24 !border-transparent !bg-slate-50 !py-1.5 text-[13px] font-semibold"
              />
            </Property>
          </div>

          {ongoing && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-[13px] text-brand-800">
              <FiRepeat className="shrink-0" />
              <span className="min-w-0 flex-1">
                <b>Tarea continua</b> · {schedule.detail}
              </span>
              {cadence !== "none" && onScheduleNext && (
                <Button variant="subtle" onClick={onScheduleNext}>
                  <FiCalendar /> Programar siguiente
                </Button>
              )}
            </div>
          )}

          {/* Subtareas */}
          <section className="border-b border-slate-100 py-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FiCheckCircle className="text-emerald-500" /> Subtareas
              </h3>
              <span className="text-xs font-semibold tabular-nums text-slate-400">
                {doneCount}/{subtasks.length}
              </span>
            </div>
            <SubtaskProgress
              className="mt-3"
              subtasks={subtasks}
              showLabel
              barClassName="bg-emerald-500"
            />
            <div className="mt-2 space-y-0.5">
              {subtasks.map((s) => {
                const checked = Boolean(
                  s.completed || s.status === "completed",
                );
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSubtask(s.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={cx(
                        "flex h-5 w-5 items-center justify-center rounded-md border text-[11px] transition",
                        checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 text-transparent",
                      )}
                    >
                      <FiCheck />
                    </span>
                    <span
                      className={cx(
                        "text-sm",
                        checked
                          ? "text-slate-400 line-through"
                          : "text-slate-700",
                      )}
                    >
                      {s.title}
                    </span>
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
              <button
                type="button"
                onClick={onAddSubtask}
                className="shrink-0 text-[13px] font-bold text-brand-600 hover:text-brand-700"
              >
                Agregar
              </button>
            </div>
          </section>

          {/* Diagramas de flujo vinculados a la tarea */}
          <TaskDiagramsSection
            projectId={projectId}
            task={task}
            diagrams={diagrams}
            loading={diagramsLoading}
          />

          {/* Archivos */}
          <section className="py-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FiPaperclip className="text-slate-400" /> Archivos
              </h3>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                <FiUpload /> Adjuntar
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={onFiles}
              />
            </div>
            {normalizedAttachments.length > 0 ? (
              <div className="mt-3 space-y-2">
                {normalizedAttachments.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5"
                  >
                    <FileIcon file={f} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-700">
                        {f.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {f.kindLabel}
                        {f.size ? ` · ${formatBytes(f.size)}` : ""}
                      </p>
                    </div>
                    {canPreviewFile(f) && (
                      <button
                        type="button"
                        title="Previsualizar"
                        aria-label={`Previsualizar ${f.name}`}
                        onClick={() => setPreviewFile(f)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <FiEye />
                      </button>
                    )}
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Descargar"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <FiDownload />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <FiUpload className="text-xl text-slate-400" />
                <span className="text-[13px] text-slate-500">
                  Arrastra archivos o{" "}
                  <b className="text-brand-600">selecciona desde tu equipo</b>
                </span>
                <span className="text-xs text-slate-400">
                  Máximo 10 MB por archivo
                </span>
              </button>
            )}
          </section>
        </div>

        {/* Columna de actividad */}
        <div className="flex min-h-80 flex-col border-t border-slate-200 bg-slate-50/70 lg:border-l lg:border-t-0">
          <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
            <ActivityTab
              active={tab === "comments"}
              onClick={() => setTab("comments")}
              icon={FiMessageSquare}
              label="Comentarios"
              count={comments.length}
            />
            <ActivityTab
              active={tab === "activity"}
              onClick={() => setTab("activity")}
              icon={FiActivity}
              label="Actividad"
            />
          </div>

          {tab === "comments" ? (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {comments.map((c, i) => (
                  <div key={c.id || i} className="flex items-start gap-2.5">
                    <Avatar user={c.user || c.author} size="xs" />
                    <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-white p-3 ring-1 ring-slate-200/70">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-[13px] text-slate-800">
                          {c.user?.name || c.author?.name || "Usuario"}
                        </strong>
                        <time className="text-[11px] text-slate-400">
                          {c.created_at ? formatDate(c.created_at) : "Ahora"}
                        </time>
                      </p>
                      <div className="mt-1 text-[13px] leading-5 text-slate-600">
                        <RichText
                          value={c.comment || c.content || c.body}
                          people={users}
                        />
                      </div>
                      {mentionPeople(c, users).length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Mencionó a
                          </span>
                          {mentionPeople(c, users).map((person) => (
                            <span
                              key={person.id}
                              className="inline-flex max-w-full items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700"
                            >
                              <span className="truncate">@{person.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
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
                {/* Escribe "@" para mencionar al personal, estilo WhatsApp. */}
                <MentionComposer
                  value={comment}
                  onValueChange={setComment}
                  people={users}
                  viewer={viewer}
                  onSubmit={onComment}
                  placeholder="Escribe un comentario... usa @ para mencionar"
                  hint="Formato, listas y @menciones · ⌘ + Enter para enviar"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4 p-5">
              {[
                {
                  icon: FiCheckCircle,
                  title: "Tarea actualizada",
                  desc: "Los cambios más recientes aparecen aquí.",
                },
                {
                  icon: FiActivity,
                  title: "Actividad del equipo",
                  desc: "El historial se sincroniza con el proyecto.",
                },
              ].map((a) => (
                <div key={a.title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <a.icon className="text-sm" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-4 text-slate-400">
                      {a.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
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
      active
        ? "border-brand-600 text-brand-700"
        : "border-transparent text-slate-400 hover:text-slate-600",
    )}
  >
    <Icon /> {label}
    {typeof count === "number" && (
      <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
        {count}
      </span>
    )}
  </button>
);

const BoardSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {COLUMNS.map((c) => (
      <div
        key={c.key}
        className="rounded-2xl border border-slate-200/70 bg-slate-100/70 p-3"
      >
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="mb-2.5 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5"
          >
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
