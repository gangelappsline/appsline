import { useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import UserSelect from "../../components/UserSelect";
import { TiFlag,TiPencil, TiTrash  } from "react-icons/ti";
import { useParams } from 'react-router-dom';

const columns = [
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "Activas" },
  { key: "completed", label: "Finalizadas" },
  { key: "rejected", label: "Rechazadas" },
];

//Obten el parametro de id de la URL

const Project = () => {
  const { id } = useParams();
  const [tasks, setTasks] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [usersList, setUsersList] = useState([]); // lista de usuarios para el filtro
  const [compactView, setCompactView] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to: "", // <- único usuario
    due_date: "",
    priority: "medium",
    status: "pending",
    estimated_hours: "", // nuevo campo
  });

  // Modal de detalle de tarea
  const [showTask, setShowTask] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [taskTab, setTaskTab] = useState("comments"); // comments | activity

  // Toasts simples (local)
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };

  const apiBase = import.meta.env.VITE_API_URL;

  const getAvatar = (userLike) => {
    // userLike puede ser un objeto o null, o un id
    const u = userLike && typeof userLike === "object" ? userLike : null;
    const src = u?.photo || u?.avatar || u?.image || "";
    const name = u?.name || u?.email || "Usuario";
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}`;
    return src && src !== "null" ? src : fallback;
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem("user_token");
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/projects/${id}/tasks`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        setTasks(data.data?.tasks || []);
      } catch (err) {
        setTasks([]);
      }
    };
    fetchTasks();
    // cargar usuarios para el filtro desde /api/v1/users
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("user_token");
        const res = await fetch(`${apiBase}/users`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("users fetch failed");
        const j = await res.json();
        const list = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j?.users)
          ? j.users
          : Array.isArray(j?.data?.users)
          ? j.data.users
          : Array.isArray(j)
          ? j
          : [];
        setUsersList(list);
      } catch (e) {
        setUsersList([]);
      }
    };
    fetchUsers();
  }, []);

  // Filtrar tareas
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      (task.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(search.toLowerCase());

    const matchesPriority = !filterPriority || task.priority === filterPriority;

    // Compatibilidad: usa assigned_to y fallback a assignees[0] o user_id
    const assignedRaw =
      task.assigned_to ??
      (Array.isArray(task.assignees) && task.assignees.length
        ? task.assignees[0]
        : undefined) ??
      task.user_id ??
      "";
    // normalizar a id para comparación
    const assignedId =
      typeof assignedRaw === "object" ? assignedRaw.id ?? "" : assignedRaw ?? "";
    const matchesUser = !filterUser || String(assignedId) === String(filterUser);

    return matchesSearch && matchesPriority && matchesUser;
  });

  // Agrupa tareas filtradas por estado
  const getTasksByStatus = (status) =>
    filteredTasks.filter((t) => t.status === status);

  // Drag events nativos con animaciones
  const handleDragStart = (task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (status) => {
    if (!draggedTask || draggedTask.status === status) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask.id ? { ...t, status } : t))
    );
    try {
      const token = localStorage.getItem("user_token");
      await fetch(
        `${import.meta.env.VITE_API_URL}/projects/${id}/tasks/${
          draggedTask.id
        }`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );
    } catch (err) {}
    setDraggedTask(null);
  };

  // Agregar nueva tarea
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("user_token");
      const payload = { ...newTask }; // envía assigned_to y estimated_hours
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/projects/${id}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      const created = data?.data || data;
      setTasks((prev) => [created, ...prev]);
      showToast("Tarea creada correctamente", "success");
      setNewTask({
        title: "",
        description: "",
        assigned_to: "", // reset
        due_date: "",
        priority: "medium",
        status: "pending",
        estimated_hours: "", // reset
      });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      showToast("Error al crear la tarea", "error");
      // opcional: manejar error
    } finally {
      setAdding(false);
    }
  };

  // Editar tarea
  const handleEditTask = (task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title || "",
      description: task.description || "",
      assigned_to:
        task.assigned_to ??
        (Array.isArray(task.assignees) && task.assignees.length
          ? task.assignees[0]
          : "") ??
        task.user_id ??
        "",
      due_date: task.due_date || "",
      priority: task.priority || "medium",
      status: task.status || "pending",
      estimated_hours: task.estimated_hours ?? "", // cargar valor existente
    });
    setShowEdit(true);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("user_token");
      const payload = { ...newTask }; // envía assigned_to
      await fetch(
        `${import.meta.env.VITE_API_URL}/projects/${id}/tasks/${
          editingTask.id
        }`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...payload } : t))
      );
      showToast("Tarea actualizada correctamente", "success");
      setShowEdit(false);
      setEditingTask(null);
      setNewTask({
        title: "",
        description: "",
        assigned_to: "",
        due_date: "",
        priority: "medium",
        status: "pending",
      });
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar la tarea", "error");
      // opcional: manejar error
    } finally {
      setAdding(false);
    }
  };

  // Eliminar tarea
  const handleDeleteTask = async (taskId) => {
    if (!confirm("¿Estás seguro de eliminar esta tarea?")) return;
    try {
      const token = localStorage.getItem("user_token");
      await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/projects/${id}/tasks/${taskId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {}
  };

  // Obtener color de prioridad (clases para el icono TiFlag)
  const getPriorityFlagColor = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-blue-400";
      default:
        return "text-slate-500";
    }
  };

  const openTaskModal = async (task) => {
    setTaskDetail(task); // muestra algo mientras carga
    setShowTask(true);
    const token = localStorage.getItem("user_token");
    try {
      // Detalle de la tarea
      const res = await fetch(
        `${apiBase}/projects/${id}/tasks/${task.id}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const json = await res.json().catch(() => ({}));
      const detail = json?.data || json || task;
      setTaskDetail(detail);

      // Comentarios (si no vinieron en el detalle)
      const comm =
        detail?.comments ??
        (await (async () => {
          try {
            const r = await fetch(
              `${apiBase}/projects/${id}/tasks/${task.id}/comments`,
              {
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (!r.ok) return [];
            const j = await r.json();
            return Array.isArray(j?.data) ? j.data : j?.comments || [];
          } catch {
            return [];
          }
        })());
      setComments(Array.isArray(comm) ? comm : []);

      // Adjuntos: intenta primero el endpoint /api/v1/.../files (requerido),
      // y si falla intenta el path anterior como fallback.
      try {
        let filesList = [];
        // Intento 1: ruta explícita /api/v1/...
        const r1 = await fetch(
          `${apiBase}/api/v1/projects/${id}/tasks/${task.id}/files`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (r1.ok) {
          const j1 = await r1.json().catch(() => ({}));
          filesList = j1?.data ?? j1?.files ?? j1 ?? [];
        } else {
          // Intento 2: fallback al endpoint /projects/.../files (compatibilidad)
          const r2 = await fetch(
            `${apiBase}/projects/${id}/tasks/${task.id}/files`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (r2.ok) {
            const j2 = await r2.json().catch(() => ({}));
            filesList = j2?.data ?? j2?.attachments ?? j2 ?? [];
          } else {
            // Si ambos fallan, intenta tomar adjuntos desde el detalle ya cargado
            filesList = detail?.attachments ?? detail?.files ?? [];
          }
        }
        setAttachments(Array.isArray(filesList) ? filesList : [filesList]);
      } catch {
        // fallback final: usar lo que venga en el detalle
        const atts = detail?.attachments ?? detail?.files ?? [];
        setAttachments(Array.isArray(atts) ? atts : []);
      }
    } catch {
      // mantener datos básicos
    }
  };

  const addComment = async () => {
    const comment = (newComment || "").trim();
    if (!taskDetail?.id || !comment) return;
    const token = localStorage.getItem("user_token");
    try {
      const res = await fetch(
        `${apiBase}/projects/${id}/tasks/${taskDetail.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment }), // <-- enviar 'comment'
        }
      );
      const data = await res.json().catch(() => ({}));
      const created = data?.data || data || {};
      // Fallback si la API no devuelve el texto:
      const normalized = created.comment ? created : { ...created, comment };
      setComments((prev) => [normalized, ...prev]);
      setNewComment("");
    } catch {
      // opcional: manejar error
    }
  };

  const onFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const uploadFiles = async () => {
    if (!taskDetail?.id || selectedFiles.length === 0) return;
    setUploading(true);
    const token = localStorage.getItem("user_token");
    try {
      const form = new FormData();
      // API común: files[] o file. Enviamos ambos para mayor compatibilidad.
      selectedFiles.forEach((f) => form.append("files[]", f));
      if (selectedFiles[0]) form.append("file", selectedFiles[0]);
      const res = await fetch(
        `${apiBase}/projects/${id}/tasks/${taskDetail.id}/files`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }, // no seteamos Content-Type
          body: form,
        }
      );
      const data = await res.json().catch(() => ({}));
      const list = data?.data || data?.attachments || data || [];
      const normalized = Array.isArray(list) ? list : [list];
      setAttachments((prev) => [...normalized, ...prev]);
      setSelectedFiles([]);
    } catch {
      // opcional: toast error
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };

  // Formato "Agosto 8" para due_date en las tarjetas
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const formatDueDate = (value) => {
    if (!value) return null;
    try {
      const dt = new Date(value);
      if (isNaN(dt)) return String(value);
      const month = dt.toLocaleString("es-ES", { month: "long" });
      const day = dt.getDate();
      return `${capitalize(month)} ${day}`;
    } catch {
      return String(value);
    }
  };

  // === Helpers del modal de detalle (faltaban) ===
  const updateTaskField = async (patch) => {
    if (!taskDetail?.id) return;

    // actualización optimista en modal y tablero
    setTaskDetail((td) => ({ ...td, ...patch }));
    setTasks((prev) =>
      prev.map((t) => (t.id === taskDetail.id ? { ...t, ...patch } : t))
    );

    try {
      const token = localStorage.getItem("user_token");
      await fetch(`${apiBase}/projects/${id}/tasks/${taskDetail.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      // opcional: revertir si falla
    }
  };

  const toggleComplete = () => {
    const next = taskDetail?.status === "completed" ? "pending" : "completed";
    updateTaskField({ status: next });
  };

  const handleTitleBlur = (e) => {
    const title = (e.target.value || "").trim();
    if (!title || title === taskDetail?.title) return;
    updateTaskField({ title });
  };

  const handleDescBlur = (e) => {
    const description = (e.target.value || "").trim();
    if (description === (taskDetail?.description || "")) return;
    updateTaskField({ description });
  };

  const handleAssignedChange = (id) => {
    updateTaskField({ assigned_to: id || "" });
  };

  const handleDueDateChange = (e) => {
    updateTaskField({ due_date: e.target.value || "" });
  };

  return (
    <LayoutAdmin title="Tablero Kanban">
      {/* Contenedor de toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[200px] max-w-sm px-4 py-2 rounded shadow-lg text-sm ${
              t.type === "success"
                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-red-100 text-red-700 ring-1 ring-red-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
      {/* Header con filtros */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow"
      >
        <div className="flex gap-4 items-center">
          <motion.input
            whileFocus={{ scale: 1.05 }}
            type="text"
            placeholder="Buscar tareas..."
            className="admin-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.select
            whileHover={{ scale: 1.02 }}
            className="px-4 py-2 border border-slate-300 rounded-lg"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </motion.select>
          <motion.select
            whileHover={{ scale: 1.02 }}
            className="px-4 py-2 border border-slate-300 rounded-lg"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="">Todos los usuarios</option>
            {usersList.map((u) => (
              <option key={u.email} value={u.id}>
                {u.name}
              </option>
            ))}
          </motion.select>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCompactView(!compactView)}
          className="btn-primary"
        >
          {compactView ? "Vista Expandida" : "Vista Compacta"}
        </motion.button>
      </motion.div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-4 gap-4">
          {columns.map((col, index) => (
            <motion.div
              key={col.key}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.key)}
              className="bg-gradient-to-br from-[#181A20] to-[#1F2125] rounded-xl p-4 min-h-[500px] flex flex-col shadow-2xl border border-[#23262F] hover:shadow-3xl transition-shadow"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-slate-800 font-bold text-lg">
                  {col.label}
                </span>
                <motion.span
                  key={getTasksByStatus(col.key).length}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="badge-brand"
                >
                  {getTasksByStatus(col.key).length}
                </motion.span>
              </div>
              <div className="flex-1 space-y-3">
                <AnimatePresence>
                  {getTasksByStatus(col.key).map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      whileHover={{ scale: 1.02 }}
                      whileDrag={{ scale: 1.05, rotate: 5 }}
                      onDoubleClick={() => openTaskModal(task)} // <- abrir modal de detalle con doble click
                      className={`bg-gradient-to-br from-[#23262F] to-[#2A2D32] border border-slate-200 rounded-lg p-4 shadow-lg text-slate-800 flex flex-col gap-2 cursor-move ${
                        compactView ? "p-2" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 text-sm">✔</span>
                          <span
                            className={`font-semibold ${
                              compactView ? "text-sm" : ""
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                        <motion.div whileHover={{ scale: 1.2 }} className="flex items-center">
                          <TiFlag
                            className={`w-4 h-4 ${getPriorityFlagColor(task.priority)}`}
                            title={
                              task.priority === "high"
                                ? "Alta"
                                : task.priority === "medium"
                                ? "Media"
                                : task.priority === "low"
                                ? "Baja"
                                : "Sin prioridad"
                            }
                          />
                        </motion.div>
                      </div>
                      {!compactView && (
                        <>
                          <p className="text-slate-600 text-sm line-clamp-2">
                            {task.description}
                          </p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="flex flex-wrap gap-1">
                                <img
                                  src={
                                    task.assigned_to?.photo == null
                                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                          task.assigned_to?.name ||
                                            task.assigned_to?.email ||
                                            "Usuario"
                                        )}`
                                      : task.assigned_to?.photo
                                  }
                                  alt=""
                                  className="rounded-full w-8 h-8"
                                />
                              </span>
                            </span>
                            <span>
                              📅{" "}
                              {task.due_date
                                ? formatDueDate(task.due_date)
                                : "Sin fecha"}
                            </span>
                          </div>
                        </>
                      )}
                      <hr className="my-1 w-full border-slate-300" />
                      <div className="flex  justify-center gap-6 mt-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => handleEditTask(task)}
                          className="text-slate-500 hover:text-slate-600 flex gap-2 text-sm"
                        >
                          <TiPencil className="w-4 h-4" /> Editar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-500 hover:text-slate-600 flex gap-2 text-sm"
                        >
                          <TiTrash className="w-4 h-4" /> Eliminar
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {col.key === "pending" && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary mt-4"
                  onClick={() => setShowAdd(true)}
                >
                  + Agregar Tarea
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal para agregar tarea con Headless UI */}
      <Transition appear show={showAdd} as={motion.div}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setShowAdd(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            />
            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-[#23262F] to-[#2A2D32] border border-slate-200 rounded-xl shadow-2xl"
            >
              <Dialog.Title
                as="h2"
                className="text-xl font-bold text-slate-800 mb-4"
              >
                Agregar Nueva Tarea
              </Dialog.Title>
              <form onSubmit={handleAddTask} className="flex flex-col gap-4">
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  placeholder="Título"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, title: e.target.value }))
                  }
                  disabled={adding}
                  autoFocus
                />
                <motion.textarea
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  placeholder="Descripción"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, description: e.target.value }))
                  }
                  disabled={adding}
                  rows={3}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Horas estimadas"
                  className="admin-input"
                  value={newTask.estimated_hours}
                  onChange={(e) =>
                    setNewTask((t) => ({
                      ...t,
                      estimated_hours: e.target.value,
                    }))
                  }
                  disabled={adding}
                />
                {/* Selector único de usuario */}
                <UserSelect
                  label="Asignar usuario"
                  value={newTask.assigned_to}
                  onChange={(id) =>
                    setNewTask((t) => ({ ...t, assigned_to: id }))
                  }
                  disabled={adding}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="date"
                  className="admin-input"
                  value={newTask.due_date}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, due_date: e.target.value }))
                  }
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, priority: e.target.value }))
                  }
                  disabled={adding}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </motion.select>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="btn-primary"
                    disabled={adding}
                  >
                    {adding ? "Agregando..." : "Agregar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAdd(false)}
                    disabled={adding}
                  >
                    Cancelar
                  </motion.button>
                </div>
              </form>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Modal para editar tarea con Headless UI */}
      <Transition appear show={showEdit} as={motion.div}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setShowEdit(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            />
            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-[#23262F] to-[#2A2D32] border border-slate-200 rounded-xl shadow-2xl"
            >
              <Dialog.Title
                as="h2"
                className="text-xl font-bold text-slate-800 mb-4"
              >
                Editar Tarea
              </Dialog.Title>
              <form onSubmit={handleUpdateTask} className="flex flex-col gap-4">
                {/* Campos similares al modal de agregar */}
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  placeholder="Título"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, title: e.target.value }))
                  }
                  disabled={adding}
                />
                <motion.textarea
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  placeholder="Descripción"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, description: e.target.value }))
                  }
                  disabled={adding}
                  rows={3}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Horas estimadas"
                  className="admin-input"
                  value={newTask.estimated_hours}
                  onChange={(e) =>
                    setNewTask((t) => ({
                      ...t,
                      estimated_hours: e.target.value,
                    }))
                  }
                  disabled={adding}
                />
                {/* Selector único de usuario */}
                <UserSelect
                  label="Asignar usuario"
                  value={newTask.assigned_to}
                  onChange={(id) =>
                    setNewTask((t) => ({ ...t, assigned_to: id }))
                  }
                  disabled={adding}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="date"
                  className="admin-input"
                  value={newTask.due_date}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, due_date: e.target.value }))
                  }
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, priority: e.target.value }))
                  }
                  disabled={adding}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </motion.select>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="btn-primary"
                    disabled={adding}
                  >
                    {adding ? "Actualizando..." : "Actualizar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowEdit(false)}
                    disabled={adding}
                  >
                    Cancelar
                  </motion.button>
                </div>
              </form>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Modal de detalle de tarea (doble click) */}
      <Transition appear show={showTask} as={motion.div}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setShowTask(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            />
            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="inline-block w-full max-w-5xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-slate-50 border border-slate-200 rounded-xl shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleComplete}
                    className={`h-5 w-5 rounded border ${
                      taskDetail?.status === "completed"
                        ? "bg-green-500 border-green-500"
                        : "border-slate-300"
                    } inline-flex items-center justify-center`}
                    title={
                      taskDetail?.status === "completed"
                        ? "Marcar como pendiente"
                        : "Marcar como finalizada"
                    }
                  >
                    {taskDetail?.status === "completed" ? "✓" : ""}
                  </button>
                  <input
                    defaultValue={taskDetail?.title || ""}
                    onBlur={handleTitleBlur}
                    className="bg-transparent text-slate-800 text-xl md:text-2xl font-semibold outline-none placeholder-gray-500"
                    placeholder="Título de la tarea"
                  />
                </div>
                <button
                  onClick={() => setShowTask(false)}
                  className="text-slate-600 hover:text-slate-800 text-sm bg-gray-700/40 px-3 py-1.5 rounded-lg"
                >
                  Cerrar
                </button>
              </div>

              {/* Body: 2 columnas */}
              <div className="grid md:grid-cols-3 gap-0">
                {/* Columna izquierda (2/3): Info + Comentarios/Actividad */}
                <div className="md:col-span-2 px-6 py-5">
                  {/* Campos tipo Asana */}
                  <div className="space-y-5">
                    {/* Responsable */}
                    <div className="flex items-center gap-4">
                      <div className="min-w-[120px] text-xs uppercase tracking-wide text-slate-500">
                        Responsable
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={getAvatar(
                            typeof taskDetail?.assigned_to === "object"
                              ? taskDetail.assigned_to
                              : null
                          )}
                          alt="avatar"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <div className="w-64">
                          <UserSelect
                            label=""
                            value={
                              typeof taskDetail?.assigned_to === "object"
                                ? taskDetail?.assigned_to?.id
                                : taskDetail?.assigned_to || ""
                            }
                            onChange={handleAssignedChange}
                            placeholder="Seleccionar responsable"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fecha de entrega */}
                    <div className="flex items-center gap-4">
                      <div className="min-w-[120px] text-xs uppercase tracking-wide text-slate-500">
                        Fecha de entrega
                      </div>
                      <input
                        type="date"
                        value={taskDetail?.due_date || ""}
                        onChange={handleDueDateChange}
                        className="admin-input"
                      />
                      {taskDetail?.due_date && (
                        <button
                          className="text-slate-500 hover:text-slate-800 text-xs underline"
                          onClick={() => updateTaskField({ due_date: "" })}
                        >
                          Quitar fecha
                        </button>
                      )}
                    </div>

                    {/* Descripción */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Descripción
                      </div>
                      <textarea
                        defaultValue={taskDetail?.description || ""}
                        onBlur={handleDescBlur}
                        rows={4}
                        placeholder="¿De qué se trata esta tarea?"
                        className="admin-input"
                      />
                    </div>

                    {/* Subtareas (placeholder) */}
                    <div>
                      <button
                        type="button"
                        className="text-sm bg-white hover:bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200"
                        title="(Opcional) Implementar endpoint de subtareas"
                      >
                        + Agregar subtarea
                      </button>
                    </div>
                  </div>

                  {/* Tabs Comentarios / Actividad */}
                  <div className="mt-6">
                    <div className="flex items-center gap-6 border-b border-slate-200 mb-4">
                      <button
                        className={`py-2 ${
                          taskTab === "comments"
                            ? "border-b-2 border-brand-700 text-brand-700"
                            : "text-slate-500"
                        }`}
                        onClick={() => setTaskTab("comments")}
                      >
                        Comentarios
                      </button>
                      <button
                        className={`py-2 ${
                          taskTab === "activity"
                            ? "border-b-2 border-brand-700 text-brand-700"
                            : "text-slate-500"
                        }`}
                        onClick={() => setTaskTab("activity")}
                      >
                        Toda la actividad
                      </button>
                    </div>

                    {taskTab === "comments" ? (
                      <>
                        <div className="space-y-3 max-h-64 overflow-auto pr-1">
                          {comments.length === 0 && (
                            <div className="text-slate-500 text-sm">
                              Sin comentarios
                            </div>
                          )}
                          {comments.map((c) => (
                            <div
                              key={
                                c.id ||
                                `${c.user_id}-${c.created_at}-${c.comment}`
                              }
                              className="flex gap-3"
                            >
                              <img
                                src={getAvatar(c.user || null)}
                                className="h-8 w-8 rounded-full object-cover"
                                alt="user"
                              />
                              <div className="flex-1">
                                <div className="text-sm">
                                  <span className="font-semibold">
                                    {c.user?.name ||
                                      c.user?.email ||
                                      `#${c.user_id || ""}`}
                                  </span>{" "}
                                  <span className="text-xs text-slate-500">
                                    {new Date(
                                      c.created_at || Date.now()
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-slate-700 text-sm">
                                  {c.comment}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="Agregar un comentario"
                            className="admin-input flex-1"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addComment();
                              }
                            }}
                          />
                          <button
                            onClick={addComment}
                            className="btn-primary"
                          >
                            Enviar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-sm">
                        Sin actividad disponible por ahora.
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna derecha (1/3): Archivos */}
                <div className="px-6 py-5 border-l border-slate-200 bg-slate-100">
                  <h3 className="text-slate-800 font-semibold mb-3">Archivos</h3>
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {attachments.length === 0 && (
                      <div className="text-slate-500 text-sm">Sin archivos</div>
                    )}
                    {attachments.map((f) => (
                      <a
                        key={f.id || f.url || f.path}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 hover:border-slate-300"
                      >
                        <span className="truncate">
                          {f.file_name || "archivo"}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {(f.file_size &&
                            `${Math.round(f.file_size / 1024)} KB`) ||
                            ""}
                        </span>
                      </a>
                    ))}
                  </div>
                  <div className="mt-3">
                    <input
                      type="file"
                      multiple
                      onChange={onFilesChange}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-brand-800"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedFiles.map((f, idx) => (
                          <span
                            key={idx}
                            className="bg-white/10 text-slate-800 text-xs px-2 py-1 rounded"
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={uploadFiles}
                      disabled={uploading || selectedFiles.length === 0}
                      className="btn-primary mt-3 w-full"
                    >
                      {uploading ? "Subiendo..." : "Subir archivos"}
                    </button>
                  </div>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </LayoutAdmin>
  );
};

export default Project;
