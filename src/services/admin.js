/**
 * Capa de acceso a datos del panel administrativo.
 *
 * Todas las páginas del admin consumen la API a través de estas funciones
 * (usan el cliente axios central `api`, que ya inyecta el Bearer token y
 * maneja el 401). Si el backend cambia su formato de respuesta, solo hay
 * que ajustar los normalizadores de este archivo.
 */
import api from "../services/api";
import { prepareFilesForUpload, toWebpIfImage } from "../utils/images";

/* ------------------------------------------------------------------ */
/* Normalizadores: la API responde con formas distintas según el        */
/* endpoint ({data: [...]}, {data: {projects: [...]}}, [...] etc.)      */
/* ------------------------------------------------------------------ */

/**
 * Claves genéricas donde un backend suele envolver colecciones
 * (paginadores de Laravel: `{ data: { data: [...], meta: {...} } }`).
 */
const LIST_CONTAINER_KEYS = ["data", "items", "results", "records", "rows"];

/** Extrae un arreglo de una respuesta con forma impredecible. */
export const unwrapList = (payload, nestedKeys = []) => {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of [...nestedKeys, ...LIST_CONTAINER_KEYS]) {
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
const clientKeys = ["client", "clients"];
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
/* Analítica (endpoints opcionales)                                    */
/* ------------------------------------------------------------------ */

/**
 * Estado de los endpoints analíticos.
 *  - `null`  → todavía no se ha sondeado
 *  - `false` → el backend no los expone (el panel calcula en el cliente)
 *  - `true`  → disponibles
 */
let analyticsSupported = null;

/** ¿El backend expone los endpoints de analítica? */
export const analyticsEndpointSupported = () => analyticsSupported !== false;

/** Marca los endpoints de analítica como no soportados. */
export const markAnalyticsUnsupported = () => {
  analyticsSupported = false;
};

const ANALYTICS_MISSING = [404, 405, 501];

/**
 * Petición a un endpoint de analítica que puede no existir.
 * Si el backend responde 404/405/501 se marca como no soportado y se
 * devuelve `null` para que la vista use el cálculo local.
 */
const fetchAnalytics = async (url, params = {}, config = {}) => {
  try {
    const { data } = await api.get(url, {
      params: compactParams(params),
      ...config,
    });
    analyticsSupported = true;
    return data;
  } catch (error) {
    if (ANALYTICS_MISSING.includes(readApiStatus(error))) {
      analyticsSupported = false;
      return null;
    }
    throw error;
  }
};

/**
 * Resumen ejecutivo de analítica.
 * @param {object} params `from`, `to`, `client_id`, `status`, `project_id`
 */
export async function fetchAnalyticsOverview(params = {}) {
  const data = await fetchAnalytics("/analytics/overview", params);
  if (!data) return null;
  return unwrapObject(data, ["overview", "analytics", "summary"]) || {};
}

/**
 * Series temporales para los gráficos de línea/área.
 * @param {object} params `metric`, `granularity` (day|week|month), `from`, `to`
 */
export async function fetchAnalyticsTimeseries(params = {}) {
  const data = await fetchAnalytics("/analytics/timeseries", params);
  if (!data) return null;
  const obj = unwrapObject(data, ["timeseries", "series"]) || {};
  return {
    metric: obj.metric || params.metric || "",
    granularity: obj.granularity || params.granularity || "week",
    series: unwrapList(obj.series || obj.data || [], ["series", "points"]),
  };
}

/** Métricas detalladas por proyecto. */
export async function fetchAnalyticsProjects(params = {}) {
  const data = await fetchAnalytics("/analytics/projects", params);
  if (!data) return null;
  return unwrapList(data, ["projects", "projects_metrics", "items"]);
}

/** Métricas detalladas por persona del equipo. */
export async function fetchAnalyticsTeam(params = {}) {
  const data = await fetchAnalytics("/analytics/team", params);
  if (!data) return null;
  return unwrapList(data, ["team", "users", "items"]);
}

/** Resumen financiero (presupuesto, facturado, cobrado, margen). */
export async function fetchAnalyticsFinancial(params = {}) {
  const data = await fetchAnalytics("/analytics/financial", params);
  if (!data) return null;
  return unwrapObject(data, ["financial", "finance"]) || {};
}

/**
 * Exportación de reportes.
 * @param {object} params `type` (projects|team|clients|financial), `format`
 *   (csv|xlsx|json|pdf), `from`, `to`.
 * @returns {Promise<{url?:string, filename?:string, blob?:Blob, data?:object}|null>}
 */
export async function fetchReportExport(params = {}) {
  const format = params.format || "csv";
  try {
    const response = await api.get("/analytics/export", {
      params: compactParams(params),
      responseType: format === "json" ? "json" : "blob",
    });
    if (format === "json") {
      const payload = response.data?.data ?? response.data;
      return { data: payload, filename: params.filename || `reporte.${format}` };
    }
    return {
      blob: response.data,
      filename:
        response.headers?.["content-disposition"]?.match(/filename="?([^"]+)"?/)?.[1] ||
        `reporte.${format}`,
    };
  } catch (error) {
    if (ANALYTICS_MISSING.includes(readApiStatus(error))) {
      analyticsSupported = false;
      return null;
    }
    throw error;
  }
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
  form.append("logo", await toWebpIfImage(file));
  const { data } = await api.post(`/projects/${id}/logo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

/** Quita claves vacías para no enviar `?status=&search=` al backend. */
export const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined
    )
  );

/**
 * Paginación de Laravel, venga suelta (`{ total, last_page }`) o envuelta
 * en `data` / `meta` según cómo la serialice el backend.
 * @returns {{current_page,last_page,per_page,total,from,to}|null}
 */
export const readPagination = (payload) => {
  const candidates = [
    payload?.meta,
    payload?.data?.meta,
    payload?.data?.data?.meta,
    payload?.data,
    payload?.data?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    if (typeof candidate.total !== "number" && typeof candidate.last_page !== "number") continue;

    const perPage = Number(candidate.per_page) || 0;
    const total = Number(candidate.total) || 0;
    const lastPage =
      Number(candidate.last_page) ||
      (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1);

    return {
      current_page: Number(candidate.current_page) || 1,
      last_page: Math.max(1, lastPage),
      per_page: perPage || total,
      total,
      from: candidate.from ?? null,
      to: candidate.to ?? null,
    };
  }

  return null;
};

/**
 * Listado de clientes con los filtros del backend.
 *
 * @param {object} params
 *   search, status, client_type, country, page, per_page,
 *   sort_by, sort_dir ("asc"|"desc"), with_projects_count (1 por defecto).
 * @returns {Promise<{items: object[], meta: object}>}
 *   `meta` siempre tiene { current_page, last_page, per_page, total }:
 *   si el backend no pagina, se sintetiza con lo recibido.
 */
export async function fetchClientsPage(params = {}) {
  const { data } = await api.get("/clients", {
    params: compactParams({ with_projects_count: 1, ...params }),
  });
  const items = unwrapList(data, clientKeys);
  const meta = readPagination(data) ?? {
    current_page: 1,
    last_page: 1,
    per_page: items.length,
    total: items.length,
    from: items.length ? 1 : null,
    to: items.length || null,
  };
  return { items, meta };
}

/** Listado simple (sin paginación) para consumidores que solo quieren el arreglo. */
export async function fetchClients() {
  return (await fetchClientsPage({ per_page: 100 })).items;
}

export async function fetchClient(id) {
  const { data } = await api.get(`/clients/${id}`);
  return unwrapObject(data, clientKeys) || data;
}

export async function saveClient(payload, id = null) {
  const isUpdate = id !== null && id !== undefined;
  const { data } = isUpdate
    ? await api.put(`/clients/${id}`, payload)
    : await api.post("/clients", payload);
  return unwrapObject(data, clientKeys) || data;
}

export async function deleteClient(id) {
  await api.delete(`/clients/${id}`);
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

/**
 * Crea una tarea en el proyecto.
 *
 * El payload incluye los campos del formulario tal cual, entre ellos los de las
 * tareas continuas y el texto enriquecido (contrato en `docs/API-TASKS.md`):
 * `task_type` (`once` | `ongoing`), `recurrence` (`none` | `daily` | `weekly` |
 * `biweekly` | `monthly` | `quarterly`), `due_date: null` en las continuas y
 * `description` como HTML sencillo.
 */
export async function createProjectTask(projectId, payload) {
  const { data } = await api.post(`/projects/${projectId}/tasks`, payload);
  return unwrapObject(data, taskKeys) || data;
}

/**
 * Actualiza una tarea (guardado optimista desde el panel).
 * Al pasar una tarea a continua se envía `due_date: null` en la misma petición.
 */
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

export async function addSubtaskToTask(projectId, taskId, task) {
  const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/subtasks`, task);
  return unwrapObject(data, ["subtask", "subtasks"]) || data;
}

/**
 * Ids de personas listas para la API: acepta ids sueltos u objetos de usuario,
 * los convierte a número cuando son numéricos y elimina repetidos/vacíos
 * (`["3", 3, { id: 7 }]` -> `[3, 7]`).
 */
export const normalizeMentionIds = (mentions = []) =>
  (Array.isArray(mentions) ? mentions : [mentions]).reduce((ids, value) => {
    const raw = value && typeof value === "object" ? value.id : value;
    if (raw === "" || raw === null || raw === undefined) return ids;
    const id = /^\d+$/.test(String(raw)) ? Number(raw) : raw;
    if (!ids.some((known) => String(known) === String(id))) ids.push(id);
    return ids;
  }, []);

/**
 * Publica un comentario en una tarea.
 * `comment` viaja como HTML sencillo ya saneado (`toRichHtml`).
 * `mentions` viaja como arreglo de ids de los usuarios mencionados con "@"
 * (ej. `[2, 5]`); si el comentario no menciona a nadie no se envía la clave
 * para no cambiar el payload de los comentarios normales.
 */
export async function addTaskComment(projectId, taskId, comment, mentions = []) {
  const ids = normalizeMentionIds(mentions);
  const payload = ids.length ? { comment, mentions: ids } : { comment };
  const { data } = await api.post(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    payload
  );
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
  const preparedFiles = await prepareFilesForUpload(files);
  preparedFiles.forEach((file) => form.append("files[]", file));
  const { data } = await api.post(
    `/projects/${projectId}/tasks/${taskId}/files`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  invalidateProjectFiles(projectId);
  return data;
}

/* ------------------------------------------------------------------ */
/* Archivos del proyecto                                               */
/* ------------------------------------------------------------------ */

/**
 * ¿La API expone archivos a nivel proyecto (`/projects/{id}/files`)?
 * `null` = todavía no se ha sondeado, `false` = el endpoint no existe.
 * El panel se adapta: si no existe, los archivos se cargan y suben
 * siempre dentro de una tarea.
 */
let projectFilesEndpoint = null;

export const projectFilesSupported = () => projectFilesEndpoint !== false;

/** Caché corta para no repetir N peticiones al cambiar de pestaña. */
const PROJECT_FILES_TTL = 30_000;
const projectFilesCache = new Map();

export const invalidateProjectFiles = (projectId) => {
  if (projectId === undefined || projectId === null) projectFilesCache.clear();
  else projectFilesCache.delete(String(projectId));
};

export const readApiStatus = (error) => Number(error?.response?.status) || 0;

/** Archivos generales del proyecto ([] si el backend no tiene el endpoint). */
async function fetchOwnProjectFiles(projectId) {
  if (projectFilesEndpoint === false) return [];
  try {
    const { data } = await api.get(`/projects/${projectId}/files`);
    projectFilesEndpoint = true;
    return unwrapList(data, ["attachments", "files"]);
  } catch (error) {
    const status = readApiStatus(error);
    // 404/405/501 = el endpoint no existe en este backend.
    if (status === 404 || status === 405 || status === 501) projectFilesEndpoint = false;
    return [];
  }
}

/** Archivos de todas las tareas del proyecto, etiquetados con su tarea. */
async function fetchFilesByTask(projectId, tasks = []) {
  const list = tasks.length ? tasks : await fetchProjectTasks(projectId).catch(() => []);
  const results = await Promise.allSettled(
    list.map((task) => fetchTaskFiles(projectId, task.id))
  );
  const files = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const task = list[index];
    result.value.forEach((file) =>
      files.push({
        ...file,
        _task: {
          id: task.id,
          title: file.task?.title || task.title || `Tarea #${task.id}`,
        },
        _scope: "task",
      })
    );
  });
  return files;
}

/**
 * Todos los archivos del proyecto: los generales (si el backend los soporta)
 * más los adjuntos de cada tarea, marcados con `_task` y `_scope`.
 *
 * @param {number|string} projectId
 * @param {Array} [tasks] Tareas ya cargadas por la página (evita otra petición).
 * @param {object} [options] `force` ignora la caché (botón Actualizar).
 */
export async function fetchProjectFiles(projectId, tasks = [], { force = false } = {}) {
  const key = String(projectId);
  const cached = projectFilesCache.get(key);
  if (!force && cached && Date.now() - cached.at < PROJECT_FILES_TTL) return cached.files;

  const [own, byTask] = await Promise.all([
    fetchOwnProjectFiles(projectId),
    fetchFilesByTask(projectId, tasks),
  ]);

  const files = [
    ...own.map((file) => ({ ...file, _scope: "project" })),
    ...byTask,
  ];
  projectFilesCache.set(key, { at: Date.now(), files });
  return files;
}

/**
 * Sube archivos al proyecto.
 *
 * @param {number|string} projectId
 * @param {File[]} files
 * @param {object} [options] `taskId`: si viene, se adjuntan a esa tarea; si
 *   es `null` se intenta el endpoint del proyecto (POST /projects/{id}/files).
 * @returns {Promise<object[]>} Adjuntos creados que devolvió el API (si los devuelve).
 */
export async function uploadProjectFiles(projectId, files, { taskId = null } = {}) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  if (taskId) {
    await uploadTaskFiles(projectId, taskId, list);
    return [];
  }

  const form = new FormData();
  const prepared = await prepareFilesForUpload(list);
  prepared.forEach((file) => form.append("files[]", file));
  const { data } = await api.post(`/projects/${projectId}/files`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  projectFilesEndpoint = true;
  invalidateProjectFiles(projectId);
  return unwrapList(data, ["attachments", "files"]);
}

/** Elimina un archivo general del proyecto. */
export async function deleteProjectFile(projectId, fileId) {
  await api.delete(`/projects/${projectId}/files/${fileId}`);
  invalidateProjectFiles(projectId);
}

/** Elimina un adjunto de una tarea. */
export async function deleteTaskFile(projectId, taskId, fileId) {
  await api.delete(`/projects/${projectId}/tasks/${taskId}/files/${fileId}`);
  invalidateProjectFiles(projectId);
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
/* ------------------------------------------------------------------ */

export async function fetchUsers() {
  const { data } = await api.get("/users");
  return unwrapList(data, userKeys);
}

/** Campo multipart que espera el endpoint de avatar. */
export const AVATAR_FIELD = "avatar";

/**
 * Guarda únicamente los datos del usuario (JSON, sin imagen).
 * La foto de perfil se envía después a POST /users/{id}/avatar.
 */
export async function saveUser(payload, id = null) {
  const { data } = id
    ? await api.put(`/users/${id}`, payload)
    : await api.post("/users", payload);
  return unwrapObject(data, userKeys) || data;
}

/**
 * Sube o reemplaza la foto de perfil en su endpoint dedicado.
 * Devuelve el usuario actualizado (o el cuerpo tal cual, si la API responde otra cosa).
 */
export async function uploadUserAvatar(id, file) {
  if (!id || !file) return null;
  const form = new FormData();
  form.append(AVATAR_FIELD, await toWebpIfImage(file));
  const { data } = await api.post(`/users/${id}/avatar`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrapObject(data, userKeys) || data;
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}

/**
 * Foto de perfil de un usuario (o avatar generado como respaldo).
 * Centralizado para no repetir el fallback en cada vista.
 */
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
