/**
 * Capa de acceso a datos del panel administrativo.
 *
 * Todas las páginas del admin consumen la API a través de estas funciones
 * (usan el cliente axios central `api`, que ya inyecta el Bearer token y
 * maneja el 401). Si el backend cambia su formato de respuesta, solo hay
 * que ajustar los normalizadores de este archivo.
 */
import api from "../services/api";

/* ------------------------------------------------------------------ */
/* Normalizadores: la API responde con formas distintas según el        */
/* endpoint ({data: [...]}, {data: {projects: [...]}}, [...] etc.)      */
/* ------------------------------------------------------------------ */

/** Extrae un arreglo de una respuesta con forma impredecible. */
export const unwrapList = (payload, nestedKeys = []) => {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of nestedKeys) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
};

/** Extrae un objeto de una respuesta con forma impredecible. */
export const unwrapObject = (payload, nestedKeys = []) => {
  const data = payload?.data ?? payload;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const key of nestedKeys) {
      if (data[key] && typeof data[key] === "object") return data[key];
    }
    return data;
  }
  return null;
};

const projectKeys = ["project", "projects"];
const taskKeys = ["task", "tasks"];
const userKeys = ["user", "users"];

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function fetchDashboard() {
  const { data } = await api.get("/dashboard");
  return unwrapObject(data, ["dashboard"]) || {};
}

/* ------------------------------------------------------------------ */
/* Proyectos                                                           */
/* ------------------------------------------------------------------ */

export async function fetchProjects() {
  const { data } = await api.get("/projects");
  return unwrapList(data, ["projects"]);
}

export async function fetchProject(id) {
  const { data } = await api.get(`/projects/${id}`);
  return unwrapObject(data, projectKeys);
}

export async function saveProject(payload, id = null) {
  const { data } = id
    ? await api.put(`/projects/${id}`, payload)
    : await api.post("/projects", payload);
  return unwrapObject(data, projectKeys) || data;
}

export async function uploadProjectLogo(id, file) {
  const form = new FormData();
  form.append("logo", file);
  const { data } = await api.post(`/projects/${id}/logo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
}

/* ------------------------------------------------------------------ */
/* Tareas                                                              */
/* ------------------------------------------------------------------ */

export async function fetchProjectTasks(projectId) {
  const { data } = await api.get(`/projects/${projectId}/tasks`);
  return unwrapList(data, taskKeys);
}

export async function fetchTask(projectId, taskId) {
  const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}`);
  return unwrapObject(data, taskKeys);
}

export async function createProjectTask(projectId, payload) {
  const { data } = await api.post(`/projects/${projectId}/tasks`, payload);
  return unwrapObject(data, taskKeys) || data;
}

export async function updateProjectTask(projectId, taskId, payload) {
  const { data } = await api.put(`/projects/${projectId}/tasks/${taskId}`, payload);
  return unwrapObject(data, taskKeys) || data;
}

export async function deleteProjectTask(projectId, taskId) {
  await api.delete(`/projects/${projectId}/tasks/${taskId}`);
}

/**
 * Todas las tareas de todos los proyectos (para Mi trabajo y Calendario).
 * Cada tarea incluye `_project: { id, name }`. Si un proyecto falla,
 * simplemente se omite (Promise.allSettled).
 */
export async function fetchAllTasks(projects = null) {
  const list = projects || (await fetchProjects());
  const results = await Promise.allSettled(
    list.map((p) => fetchProjectTasks(p.id))
  );
  const tasks = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const project = list[i];
    r.value.forEach((t) =>
      tasks.push({
        ...t,
        _project: {
          id: project.id,
          name: t.project?.name || project.name || `Proyecto #${project.id}`,
        },
      })
    );
  });
  return { tasks, projects: list };
}

/* Comentarios y archivos de una tarea (opcionales en la API). */
export async function fetchTaskComments(projectId, taskId) {
  try {
    const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`);
    return unwrapList(data, ["comments"]);
  } catch {
    return [];
  }
}

export async function addTaskComment(projectId, taskId, comment) {
  const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, {
    comment,
  });
  return unwrapObject(data, ["comment", "comments"]) || data;
}

export async function fetchTaskFiles(projectId, taskId) {
  try {
    const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/files`);
    return unwrapList(data, ["attachments", "files"]);
  } catch {
    return [];
  }
}

export async function uploadTaskFiles(projectId, taskId, files) {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append("files[]", f));
  const { data } = await api.post(
    `/projects/${projectId}/tasks/${taskId}/files`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
/* ------------------------------------------------------------------ */

export async function fetchUsers() {
  const { data } = await api.get("/users");
  return unwrapList(data, userKeys);
}

export async function saveUser(formData, id = null) {
  const config = { headers: { "Content-Type": "multipart/form-data" } };
  const { data } = id
    ? await api.put(`/users/${id}`, formData, config)
    : await api.post("/users", formData, config);
  return unwrapObject(data, userKeys) || data;
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}

/**
 * Foto de perfil de un usuario (o avatar generado como respaldo).
 * Centralizado para no repetir el fallback en cada vista.
 */
export const AVATAR_FIELD = "avatar";

export function userAvatarUrl(user) {
  const src = user?.avatar || user?.image || user?.photo || "";
  if (src && src !== "null") return src;
  const name = user?.name || user?.email || "Usuario";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0060FC&color=fff`;
}

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

export async function fetchProducts() {
  const { data } = await api.get("/products");
  return unwrapList(data, ["products"]);
}

export async function fetchProduct(id) {
  const { data } = await api.get(`/products/${id}`);
  return unwrapObject(data, ["product", "products"]);
}

export async function updateProduct(id, payload) {
  const { data } = await api.put(`/products/${id}`, payload);
  return unwrapObject(data, ["product", "products"]) || data;
}
