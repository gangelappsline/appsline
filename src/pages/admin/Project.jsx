/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiActivity, FiArchive, FiArrowLeft, FiCalendar, FiCheck,
  FiCheckCircle, FiChevronDown, FiClock, FiColumns, FiDownload, FiFile,
  FiFilter, FiFlag, FiGrid, FiLink, FiList, FiMessageSquare, FiMoreHorizontal,
  FiPaperclip, FiPlus, FiSearch, FiSend, FiTrash2, FiUpload,
  FiUser, FiUsers, FiX,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import "./Project.css";

const COLUMNS = [
  { key: "pending", label: "Pendientes", color: "#8b5cf6", icon: FiArchive },
  { key: "in_progress", label: "En progreso", color: "#0ea5e9", icon: FiActivity },
  { key: "completed", label: "Finalizadas", color: "#10b981", icon: FiCheckCircle },
  { key: "rejected", label: "Rechazadas", color: "#f43f5e", icon: FiX },
];
const PRIORITIES = {
  high: { label: "Alta", color: "#ef4444" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#3b82f6" },
};
const EMPTY_TASK = { title: "", description: "", status: "pending", priority: "medium", assigned_to: "", due_date: "", estimated_hours: "" };

const initials = (name = "Usuario") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
const assigneeOf = (task) => {
  const raw = task?.assigned_to ?? task?.assignees?.[0] ?? task?.user;
  return typeof raw === "object" && raw ? raw : null;
};
const assigneeId = (task) => {
  const raw = task?.assigned_to ?? task?.assignees?.[0] ?? task?.user_id ?? "";
  return typeof raw === "object" && raw ? raw.id : raw;
};
const dateLabel = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
};
const isLate = (value, status) => value && status !== "completed" && new Date(value) < new Date(new Date().toDateString());

function Avatar({ user, size = "md", className = "" }) {
  const name = user?.name || user?.email || "Sin asignar";
  return (
    <span className={`task-avatar task-avatar-${size} ${className}`} title={name}>
      {user?.photo || user?.avatar ? <img src={user.photo || user.avatar} alt={name} /> : initials(name)}
    </span>
  );
}

function Project() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [toasts, setToasts] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  const notify = (message, type = "success") => {
    const toastId = `${Date.now()}-${Math.random()}`;
    setToasts((old) => [...old, { id: toastId, message, type }]);
    setTimeout(() => setToasts((old) => old.filter((item) => item.id !== toastId)), 3500);
  };
  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json", Accept: "application/json" } : {}),
    ...(localStorage.getItem("user_token") ? { Authorization: `Bearer ${localStorage.getItem("user_token")}` } : {}),
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const getJson = async (url) => {
        const response = await fetch(url, { headers: headers(true) });
        if (!response.ok) throw new Error("No fue posible cargar la información");
        return response.json();
      };
      const [projectResult, taskResult, userResult] = await Promise.allSettled([
        getJson(`${api}/projects/${id}`),
        getJson(`${api}/projects/${id}/tasks`),
        getJson(`${api}/users`),
      ]);
      if (!active) return;
      if (projectResult.status === "fulfilled") {
        const payload = projectResult.value;
        setProject(payload?.data?.project || payload?.data || payload?.project || payload);
      }
      if (taskResult.status === "fulfilled") {
        const payload = taskResult.value;
        setTasks(Array.isArray(payload?.data?.tasks) ? payload.data.tasks : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []);
      }
      if (userResult.status === "fulfilled") {
        const payload = userResult.value;
        setUsers(Array.isArray(payload?.data?.users) ? payload.data.users : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.users) ? payload.users : []);
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [api, id]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const term = search.toLowerCase();
    const matchesSearch = !term || `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(term);
    return matchesSearch && (!priority || task.priority === priority) && (!person || String(assigneeId(task)) === String(person));
  }), [tasks, search, priority, person]);

  const progress = tasks.length ? Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100) : 0;
  const projectName = project?.name || "Detalle del proyecto";

  const updateTask = async (taskId, patch, quiet = false) => {
    const previous = tasks;
    setTasks((old) => old.map((task) => task.id === taskId ? { ...task, ...patch } : task));
    setSelected((old) => old?.id === taskId ? { ...old, ...patch } : old);
    try {
      const response = await fetch(`${api}/projects/${id}/tasks/${taskId}`, { method: "PUT", headers: headers(true), body: JSON.stringify(patch) });
      if (!response.ok) throw new Error();
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
    notify(`Tarea movida a ${COLUMNS.find((column) => column.key === status)?.label}`);
    setDragged(null);
  };

  const saveNewTask = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`${api}/projects/${id}/tasks`, { method: "POST", headers: headers(true), body: JSON.stringify(draft) });
      if (!response.ok) throw new Error();
      const json = await response.json();
      setTasks((old) => [json?.data?.task || json?.data || json?.task || json, ...old]);
      setTaskModal(false);
      setDraft(EMPTY_TASK);
      notify("Tarea creada correctamente");
    } catch {
      notify("No se pudo crear la tarea", "error");
    } finally { setSaving(false); }
  };

  const openTask = async (task) => {
    setSelected(task);
    setComments(Array.isArray(task.comments) ? task.comments : []);
    setAttachments(Array.isArray(task.attachments || task.files) ? (task.attachments || task.files) : []);
    setDetailTab("comments");
    try {
      const [detailResponse, commentResponse, fileResponse] = await Promise.allSettled([
        fetch(`${api}/projects/${id}/tasks/${task.id}`, { headers: headers(true) }),
        fetch(`${api}/projects/${id}/tasks/${task.id}/comments`, { headers: headers(true) }),
        fetch(`${api}/projects/${id}/tasks/${task.id}/files`, { headers: headers(true) }),
      ]);
      if (detailResponse.status === "fulfilled" && detailResponse.value.ok) {
        const data = await detailResponse.value.json();
        setSelected(data?.data || data);
      }
      if (commentResponse.status === "fulfilled" && commentResponse.value.ok) {
        const data = await commentResponse.value.json();
        setComments(Array.isArray(data?.data) ? data.data : data?.comments || []);
      }
      if (fileResponse.status === "fulfilled" && fileResponse.value.ok) {
        const data = await fileResponse.value.json();
        const list = data?.data || data?.attachments || data?.files || [];
        setAttachments(Array.isArray(list) ? list : []);
      }
    } catch { /* Los datos básicos ya están visibles. */ }
  };

  const addComment = async () => {
    const value = comment.trim();
    if (!value || !selected) return;
    const optimistic = { id: `local-${Date.now()}`, comment: value, user: { name: "Tú" }, created_at: new Date().toISOString() };
    setComments((old) => [...old, optimistic]);
    setComment("");
    try {
      const response = await fetch(`${api}/projects/${id}/tasks/${selected.id}/comments`, { method: "POST", headers: headers(true), body: JSON.stringify({ comment: value }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setComments((old) => old.map((item) => item.id === optimistic.id ? (data?.data || data) : item));
    } catch { notify("El comentario no pudo sincronizarse", "error"); }
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selected) return;
    const localFiles = files.map((file) => ({ id: `local-${file.name}`, name: file.name, size: file.size }));
    setAttachments((old) => [...old, ...localFiles]);
    const form = new FormData();
    files.forEach((file) => form.append("files[]", file));
    try {
      const response = await fetch(`${api}/projects/${id}/tasks/${selected.id}/files`, { method: "POST", headers: headers(), body: form });
      if (!response.ok) throw new Error();
      notify(`${files.length} archivo${files.length > 1 ? "s" : ""} adjuntado${files.length > 1 ? "s" : ""}`);
    } catch { notify("Los archivos no pudieron sincronizarse", "error"); }
  };

  const addSubtask = async () => {
    const title = newSubtask.trim();
    if (!title || !selected) return;
    const subtask = { id: `local-${Date.now()}`, title, completed: false };
    const subtasks = [...(selected.subtasks || []), subtask];
    setNewSubtask("");
    await updateTask(selected.id, { subtasks });
  };
  const toggleSubtask = (subtaskId) => {
    const subtasks = (selected?.subtasks || []).map((item) => item.id === subtaskId ? { ...item, completed: !item.completed } : item);
    updateTask(selected.id, { subtasks }, true);
  };

  const removeTask = async () => {
    if (!selected || !window.confirm("¿Eliminar esta tarea definitivamente?")) return;
    try {
      const response = await fetch(`${api}/projects/${id}/tasks/${selected.id}`, { method: "DELETE", headers: headers() });
      if (!response.ok) throw new Error();
      setTasks((old) => old.filter((task) => task.id !== selected.id));
      setSelected(null);
      notify("Tarea eliminada");
    } catch { notify("No se pudo eliminar la tarea", "error"); }
  };

  return (
    <LayoutAdmin>
      <div className="project-page">
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => <div key={toast.id} className={`project-toast ${toast.type}`}><span>{toast.type === "success" ? <FiCheck /> : <FiX />}</span>{toast.message}</div>)}
        </div>

        <header className="project-hero">
          <div className="project-breadcrumb"><button onClick={() => navigate("/admin/projects")}><FiArrowLeft /> Proyectos</button><span>/</span><span>{projectName}</span></div>
          <div className="project-heading-row">
            <div className="project-identity">
              <div className="project-mark">{initials(projectName)}</div>
              <div><div className="project-title-line"><h1>{projectName}</h1><span className="status-live"><i /> En curso</span></div><p>{project?.description || "Planificación, diseño y desarrollo del proyecto"}</p></div>
            </div>
            <div className="project-actions">
              <div className="member-stack">{users.slice(0, 4).map((user) => <Avatar key={user.id} user={user} />)}{users.length > 4 && <span className="more-members">+{users.length - 4}</span>}</div>
              <button className="soft-button"><FiUsers /> Compartir</button>
              <button className="icon-button" aria-label="Más opciones"><FiMoreHorizontal /></button>
            </div>
          </div>
          <div className="project-metrics">
            <div><span>PROGRESO GENERAL</span><strong>{progress}%</strong><div className="hero-progress"><i style={{ width: `${progress}%` }} /></div></div>
            <div><span>FECHA DE ENTREGA</span><strong><FiCalendar /> {dateLabel(project?.end_date)}</strong></div>
            <div><span>EQUIPO</span><strong><FiUsers /> {users.length || "—"} miembros</strong></div>
            <div><span>TAREAS</span><strong><FiCheckCircle /> {tasks.filter((task) => task.status === "completed").length} de {tasks.length}</strong></div>
          </div>
        </header>

        <div className="board-nav">
          <div className="view-tabs">
            <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}><FiColumns /> Tablero</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><FiList /> Lista</button>
            <button disabled title="Próximamente"><FiCalendar /> Calendario</button>
            <button disabled title="Próximamente"><FiPaperclip /> Archivos</button>
          </div>
          <button className="new-task-button" onClick={() => setTaskModal(true)}><FiPlus /> Nueva tarea</button>
        </div>

        <div className="board-toolbar">
          <label className="board-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título o descripción..." />{search && <button onClick={() => setSearch("")}><FiX /></button>}</label>
          <div className="toolbar-filters">
            <label><FiFlag /><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Prioridad</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select><FiChevronDown /></label>
            <label><FiUser /><select value={person} onChange={(event) => setPerson(event.target.value)}><option value="">Responsable</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><FiChevronDown /></label>
            <button className={priority || person ? "filter-active" : ""} onClick={() => { setPriority(""); setPerson(""); }}><FiFilter /> Filtros{(priority || person) && <b>{Number(Boolean(priority)) + Number(Boolean(person))}</b>}</button>
          </div>
        </div>

        {loading ? <BoardSkeleton /> : view === "board" ? (
          <div className="kanban-scroll"><div className="kanban-grid">
            {COLUMNS.map((column) => {
              const columnTasks = filtered.filter((task) => task.status === column.key);
              const Icon = column.icon;
              return <section key={column.key} className={`kanban-column ${dropColumn === column.key ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDropColumn(column.key); }} onDragLeave={() => setDropColumn(null)} onDrop={() => handleDrop(column.key)}>
                <div className="column-heading"><div><span className="column-icon" style={{ color: column.color, background: `${column.color}14` }}><Icon /></span><h2>{column.label}</h2><b>{columnTasks.length}</b></div><button onClick={() => { setDraft({ ...EMPTY_TASK, status: column.key }); setTaskModal(true); }}><FiPlus /></button></div>
                <div className="task-list">
                  {columnTasks.map((task) => <TaskCard key={task.id} task={task} projectId={id} color={column.color} onOpen={() => openTask(task)} onDrag={() => setDragged(task)} />)}
                  {!columnTasks.length && <div className="empty-column"><FiGrid /><p>{search || priority || person ? "Sin coincidencias" : "No hay tareas"}</p><span>Arrastra una tarea aquí</span></div>}
                </div>
                <button className="column-add" onClick={() => { setDraft({ ...EMPTY_TASK, status: column.key }); setTaskModal(true); }}><FiPlus /> Agregar tarea</button>
              </section>;
            })}
          </div></div>
        ) : <TaskTable tasks={filtered} onOpen={openTask} />}
      </div>

      {taskModal && <TaskFormModal draft={draft} setDraft={setDraft} users={users} saving={saving} onClose={() => { setTaskModal(false); setDraft(EMPTY_TASK); }} onSubmit={saveNewTask} />}
      {selected && <TaskDrawer task={selected} users={users} comments={comments} attachments={attachments} tab={detailTab} setTab={setDetailTab} comment={comment} setComment={setComment} onComment={addComment} fileRef={fileRef} onFiles={uploadFiles} onClose={() => setSelected(null)} onUpdate={(patch) => updateTask(selected.id, patch)} onDelete={removeTask} newSubtask={newSubtask} setNewSubtask={setNewSubtask} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} />}
    </LayoutAdmin>
  );
}

function TaskCard({ task, projectId, color, onOpen, onDrag }) {
  const user = assigneeOf(task);
  const subtasks = task.subtasks || [];
  const done = subtasks.filter((item) => item.completed || item.status === "completed").length;
  const tags = task.tags || task.labels || [];
  const commentCount = task.comments_count ?? task.comments?.length ?? 0;
  const fileCount = task.attachments_count ?? task.files_count ?? task.attachments?.length ?? task.files?.length ?? 0;
  return <article className="task-card" draggable onDragStart={onDrag} onClick={onOpen}>
    <div className="task-card-top"><span className="task-code">PR-{projectId}-{task.id}</span><button onClick={(event) => event.stopPropagation()}><FiMoreHorizontal /></button></div>
    {tags.length > 0 && <div className="task-tags">{tags.slice(0, 2).map((tag) => <span key={tag.id || tag.name || tag} style={{ "--tag": tag.color || color }}>{tag.name || tag}</span>)}</div>}
    <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}
    {subtasks.length > 0 && <div className="subtask-progress"><div><span><FiCheckCircle /> {done}/{subtasks.length} subtareas</span><b>{Math.round(done / subtasks.length * 100)}%</b></div><i><em style={{ width: `${done / subtasks.length * 100}%`, background: color }} /></i></div>}
    <div className="task-card-meta"><span className={`due-date ${isLate(task.due_date, task.status) ? "late" : ""}`}><FiCalendar /> {dateLabel(task.due_date)}</span><span className="priority-dot"><i style={{ background: PRIORITIES[task.priority]?.color || "#94a3b8" }} />{PRIORITIES[task.priority]?.label || "Normal"}</span></div>
    <div className="task-card-footer"><Avatar user={user} /><div>{commentCount > 0 && <span><FiMessageSquare /> {commentCount}</span>}{fileCount > 0 && <span><FiPaperclip /> {fileCount}</span>}</div></div>
  </article>;
}

function TaskTable({ tasks, onOpen }) {
  return <div className="task-table-wrap"><table className="task-table"><thead><tr><th>Tarea</th><th>Estado</th><th>Prioridad</th><th>Responsable</th><th>Entrega</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onOpen(task)}><td><strong>{task.title}</strong><small>{task.description}</small></td><td><span className={`table-status ${task.status}`}>{COLUMNS.find((item) => item.key === task.status)?.label}</span></td><td><span className="priority-dot"><i style={{ background: PRIORITIES[task.priority]?.color }} />{PRIORITIES[task.priority]?.label}</span></td><td><div className="table-person"><Avatar user={assigneeOf(task)} />{assigneeOf(task)?.name || "Sin asignar"}</div></td><td>{dateLabel(task.due_date)}</td></tr>)}</tbody></table>{!tasks.length && <div className="table-empty">No se encontraron tareas</div>}</div>;
}

function TaskFormModal({ draft, setDraft, users, saving, onClose, onSubmit }) {
  const set = (key) => (event) => setDraft((old) => ({ ...old, [key]: event.target.value }));
  return <div className="project-modal-backdrop" onMouseDown={onClose}><div className="task-form-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span><FiPlus /></span><div><h2>Nueva tarea</h2><p>Agrega una tarea al tablero del proyecto.</p></div></div><button onClick={onClose}><FiX /></button></div><form onSubmit={onSubmit}>
    <label className="field"><span>Título de la tarea</span><input autoFocus required value={draft.title} onChange={set("title")} placeholder="Ej. Diseñar página de inicio" /></label>
    <label className="field"><span>Descripción</span><textarea rows="4" value={draft.description} onChange={set("description")} placeholder="Agrega contexto, criterios de aceptación o enlaces..." /></label>
    <div className="field-grid"><label className="field"><span>Estado</span><select value={draft.status} onChange={set("status")}>{COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="field"><span>Prioridad</span><select value={draft.priority} onChange={set("priority")}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label></div>
    <div className="field-grid"><label className="field"><span>Responsable</span><select value={draft.assigned_to} onChange={set("assigned_to")}><option value="">Sin asignar</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="field"><span>Fecha de entrega</span><input type="date" value={draft.due_date} onChange={set("due_date")} /></label></div>
    <label className="field"><span>Estimación (horas)</span><input type="number" min="0" step="0.5" value={draft.estimated_hours} onChange={set("estimated_hours")} placeholder="0" /></label>
    <div className="modal-footer"><button type="button" className="soft-button" onClick={onClose}>Cancelar</button><button className="new-task-button" disabled={saving}>{saving ? "Creando..." : <><FiPlus /> Crear tarea</>}</button></div>
  </form></div></div>;
}

function TaskDrawer({ task, users, comments, attachments, tab, setTab, comment, setComment, onComment, fileRef, onFiles, onClose, onUpdate, onDelete, newSubtask, setNewSubtask, onAddSubtask, onToggleSubtask }) {
  const subtasks = task.subtasks || [];
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="task-drawer" onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-header"><div><span className="task-code">TAREA #{task.id}</span><span className="saved-state"><FiCheck /> Guardado</span></div><div><button title="Copiar enlace" onClick={() => navigator.clipboard?.writeText(window.location.href)}><FiLink /></button><button title="Eliminar" className="delete-icon" onClick={onDelete}><FiTrash2 /></button><button title="Cerrar" onClick={onClose}><FiX /></button></div></div>
    <div className="drawer-scroll"><div className="drawer-content"><input key={`title-${task.id}`} className="drawer-title" defaultValue={task.title || ""} onBlur={(event) => event.target.value.trim() && event.target.value !== task.title && onUpdate({ title: event.target.value.trim() })} /><textarea key={`description-${task.id}`} className="drawer-description" rows="3" defaultValue={task.description || ""} onBlur={(event) => event.target.value !== (task.description || "") && onUpdate({ description: event.target.value })} placeholder="Agregar una descripción..." />
      <div className="task-properties"><Property icon={FiActivity} label="Estado"><select value={task.status} onChange={(event) => onUpdate({ status: event.target.value })}>{COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Property><Property icon={FiFlag} label="Prioridad"><select value={task.priority} onChange={(event) => onUpdate({ priority: event.target.value })}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></Property><Property icon={FiUser} label="Responsable"><select value={assigneeId(task) || ""} onChange={(event) => onUpdate({ assigned_to: event.target.value })}><option value="">Sin asignar</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Property><Property icon={FiCalendar} label="Fecha límite"><input type="date" value={task.due_date?.slice?.(0, 10) || ""} onChange={(event) => onUpdate({ due_date: event.target.value })} /></Property><Property icon={FiClock} label="Estimación"><input type="number" value={task.estimated_hours || ""} onChange={(event) => onUpdate({ estimated_hours: event.target.value })} placeholder="Sin estimar" /></Property></div>
      <section className="drawer-section"><div className="section-heading"><h3><FiCheckCircle /> Subtareas</h3><span>{subtasks.filter((item) => item.completed || item.status === "completed").length}/{subtasks.length}</span></div>{subtasks.length > 0 && <div className="drawer-progress"><i style={{ width: `${subtasks.filter((item) => item.completed || item.status === "completed").length / subtasks.length * 100}%` }} /></div>}<div className="subtask-list">{subtasks.map((item) => <label key={item.id}><input type="checkbox" checked={Boolean(item.completed || item.status === "completed")} onChange={() => onToggleSubtask(item.id)} /><i><FiCheck /></i><span>{item.title}</span></label>)}</div><div className="add-subtask"><FiPlus /><input value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddSubtask()} placeholder="Agregar subtarea..." /><button onClick={onAddSubtask}>Agregar</button></div></section>
      <section className="drawer-section"><div className="section-heading"><h3><FiPaperclip /> Archivos</h3><button onClick={() => fileRef.current?.click()}><FiUpload /> Adjuntar</button><input ref={fileRef} type="file" multiple hidden onChange={onFiles} /></div><div className="file-list">{attachments.map((file, index) => <div key={file.id || index}><span><FiFile /></span><div><strong>{file.name || file.file_name || `Archivo ${index + 1}`}</strong><small>{file.size ? `${Math.ceil(file.size / 1024)} KB` : "Archivo adjunto"}</small></div><a href={file.url || file.path || "#"} download title="Descargar"><FiDownload /></a></div>)}{!attachments.length && <button className="upload-zone" onClick={() => fileRef.current?.click()}><FiUpload /><span>Arrastra archivos o <b>selecciona desde tu equipo</b></span><small>Máximo 10 MB por archivo</small></button>}</div></section>
    </div>
    <div className="drawer-activity"><div className="activity-tabs"><button className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}><FiMessageSquare /> Comentarios <b>{comments.length}</b></button><button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><FiActivity /> Actividad</button></div>{tab === "comments" ? <><div className="comment-list">{comments.map((item, index) => <div className="comment-item" key={item.id || index}><Avatar user={item.user || item.author} /><div><p><strong>{item.user?.name || item.author?.name || "Usuario"}</strong><time>{item.created_at ? new Date(item.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Ahora"}</time></p><span>{item.comment || item.content || item.body}</span></div></div>)}{!comments.length && <div className="no-comments"><FiMessageSquare /> Inicia la conversación sobre esta tarea</div>}</div><div className="comment-box"><Avatar user={{ name: "Tú" }} /><div><textarea rows="2" value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onComment(); }} placeholder="Escribe un comentario..." /><footer><span>⌘ + Enter para enviar</span><button disabled={!comment.trim()} onClick={onComment}><FiSend /> Enviar</button></footer></div></div></> : <div className="activity-feed"><span><i><FiCheckCircle /></i><p><strong>Tarea actualizada</strong><small>Los cambios más recientes aparecen aquí.</small></p></span><span><i><FiActivity /></i><p><strong>Actividad del equipo</strong><small>El historial se sincroniza con el proyecto.</small></p></span></div>}</div>
    </div>
  </aside></div>;
}

function Property({ icon: Icon, label, children }) { return <label className="task-property"><span><Icon />{label}</span>{children}</label>; }
function BoardSkeleton() { return <div className="kanban-grid skeleton-board">{COLUMNS.map((column) => <div className="kanban-column" key={column.key}><div className="skeleton-line short" />{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div className="skeleton-line tiny" /><div className="skeleton-line" /><div className="skeleton-line medium" /></div>)}</div>)}</div>; }

export default Project;
