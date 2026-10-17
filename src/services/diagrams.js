/**
 * Diagramas de flujo: acceso a datos.
 *
 * Endpoints (contrato completo en `docs/API-DIAGRAMS.md`):
 *   GET    /projects/{project}/diagrams?task_id=        lista (del proyecto o de una tarea)
 *   POST   /projects/{project}/diagrams                 crear
 *   GET    /projects/{project}/diagrams/{diagram}       uno
 *   PUT    /projects/{project}/diagrams/{diagram}       actualizar
 *   DELETE /projects/{project}/diagrams/{diagram}       eliminar
 *   GET    /diagrams                                    (opcional) todos los del usuario
 *
 * Mientras la API no exponga estos endpoints (404/405/501) el panel guarda
 * los diagramas en `localStorage` del navegador para que la función sea
 * usable desde el primer día. `diagramsStorageMode()` dice cuál se está usando
 * y la vista lo avisa al usuario.
 */
import api from "./api";
import { normalizeDiagram, serializeDiagram, unwrapDiagramResponse } from "../utils/diagrams";
import { readApiStatus, unwrapList } from "./admin";

const LOCAL_KEY = "appsline.diagrams.v1";
const MISSING = [404, 405, 501];

/** `null` = sin sondear · `true` = la API tiene los endpoints · `false` = respaldo local. */
let endpointSupported = null;

export const diagramsStorageMode = (diagramId) => (String(diagramId).startsWith("local-") || endpointSupported === false ? "local" : "api");
export const diagramsEndpointKnown = () => endpointSupported !== null;

/** Solo para pruebas / diagnóstico. */
export const __resetDiagramsEndpoint = () => {
  endpointSupported = null;
};

/* ------------------------------------------------------------------ */
/* Respaldo local                                                      */
/* ------------------------------------------------------------------ */

const storage = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

const readLocal = () => {
  const store = storage();
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeLocal = (list) => {
  const store = storage();
  if (!store) throw new Error("El navegador no permite guardar. Exporta el JSON para conservar los cambios.");
  try {
    store.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    throw new Error("No hay espacio en el navegador. Exporta el JSON o reduce las imágenes; los cambios aún no se han guardado.");
  }
};

const localId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const same = (a, b) => String(a) === String(b);

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

const diagramKeys = ["diagram", "diagrams", "flowchart", "flowcharts"];

/**
 * Diagramas de un proyecto. Con `taskId` solo los de esa tarea; con
 * `taskId: null` explícito, solo los que cuelgan directamente del proyecto.
 */
export async function fetchProjectDiagrams(projectId, { taskId } = {}) {
  if (endpointSupported !== false) {
    try {
      const params = {};
      if (taskId !== undefined && taskId !== null) params.task_id = taskId;
      const { data } = await api.get(`/projects/${projectId}/diagrams`, { params });
      endpointSupported = true;
      let list = unwrapList(data, diagramKeys).map(normalizeDiagram);
      if (taskId !== undefined) {
        list = list.filter((d) => (taskId === null ? !d.task_id : same(d.task_id, taskId)));
      }
      return list;
    } catch (error) {
      if (!MISSING.includes(readApiStatus(error))) throw error;
      endpointSupported = false;
    }
  }
  return readLocal()
    .filter((d) => same(d.project_id, projectId))
    .filter((d) => (taskId === undefined ? true : taskId === null ? !d.task_id : same(d.task_id, taskId)))
    .map(normalizeDiagram)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export const fetchTaskDiagrams = (projectId, taskId) => fetchProjectDiagrams(projectId, { taskId });

export async function fetchDiagram(projectId, diagramId) {
  if (!String(diagramId).startsWith("local-")) {
    try {
      const { data } = await api.get(`/projects/${projectId}/diagrams/${diagramId}`);
      endpointSupported = true;
      const found = unwrapDiagramResponse(data);
      return found ? normalizeDiagram({ ...found, id: diagramId, project_id: projectId }) : null;
    } catch (error) {
      const status = readApiStatus(error);
      if (status === 404 && endpointSupported === true) return null; // el endpoint existe, el diagrama no
      if (!MISSING.includes(status)) throw error;
      endpointSupported = false;
    }
  }
  const found = readLocal().find((d) => same(d.id, diagramId) && same(d.project_id, projectId));
  return found ? normalizeDiagram(found) : null;
}

/**
 * Todos los diagramas (vista global). Si la API tiene `GET /diagrams` se usa;
 * si no, se recorren los proyectos recibidos.
 */
export async function fetchAllDiagrams(projects = []) {
  if (endpointSupported !== false) {
    try {
      const { data } = await api.get("/diagrams");
      endpointSupported = true;
      return unwrapList(data, diagramKeys).map(normalizeDiagram);
    } catch {
      /* `GET /diagrams` es opcional: se recorre por proyecto (y ahí se sondea
         si existen los endpoints por proyecto o se usa el respaldo local). */
    }
  }
  if (endpointSupported === false) return readLocal().map(normalizeDiagram);
  const results = await Promise.allSettled(projects.map((p) => fetchProjectDiagrams(p.id)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/* ------------------------------------------------------------------ */
/* Escritura                                                           */
/* ------------------------------------------------------------------ */

/**
 * Crea o actualiza un diagrama. Devuelve el diagrama normalizado con el `id`
 * definitivo (el que dé la API o uno local).
 */
export async function saveDiagram(projectId, diagram) {
  const payload = serializeDiagram(diagram);
  const hasId = diagram.id !== null && diagram.id !== undefined && diagram.id !== "";
  const isLocal = hasId && String(diagram.id).startsWith("local-");

  // Un registro remoto siempre se actualiza por su ID. Un PUT fallido no
  // significa «crear una copia local» (ni mucho menos repetir un POST).
  if (!isLocal && (hasId || endpointSupported !== false)) {
    try {
      const { data } = hasId
        ? await api.put(`/projects/${projectId}/diagrams/${diagram.id}`, payload)
        : await api.post(`/projects/${projectId}/diagrams`, payload);
      endpointSupported = true;
      const saved = unwrapDiagramResponse(data);
      const id = hasId ? diagram.id : saved?.id;
      if (id === null || id === undefined || id === "") {
        throw new Error("La API no devolvió el ID del diagrama creado. Revisa la lista de diagramas antes de volver a guardar para evitar duplicados.");
      }
      // Un PUT puede responder 204 o solo metadatos. Nunca perder contenido/ID.
      return normalizeDiagram({ ...diagram, ...saved, data: saved?.data ?? payload.data, id, project_id: projectId });
    } catch (error) {
      if (hasId || endpointSupported === true || !MISSING.includes(readApiStatus(error))) throw error;
      endpointSupported = false;
    }
  }

  const now = new Date().toISOString();
  const list = readLocal();
  const index = hasId ? list.findIndex((d) => same(d.id, diagram.id) && same(d.project_id, projectId)) : -1;
  const record = {
    ...(index >= 0 ? list[index] : { id: isLocal ? diagram.id : localId(), created_at: now }),
    ...payload,
    project_id: projectId,
    updated_at: now,
  };
  if (index >= 0) list[index] = record;
  else list.unshift(record);
  writeLocal(list);
  return normalizeDiagram(record);
}

export async function deleteDiagram(projectId, diagramId) {
  const isLocal = String(diagramId).startsWith("local-");
  if (endpointSupported !== false && !isLocal) {
    try {
      await api.delete(`/projects/${projectId}/diagrams/${diagramId}`);
      endpointSupported = true;
      return;
    } catch (error) {
      if (!MISSING.includes(readApiStatus(error))) throw error;
      endpointSupported = false;
    }
  }
  writeLocal(readLocal().filter((d) => !same(d.id, diagramId)));
}

/** Copia de un diagrama (mismo proyecto, misma tarea salvo que se indique). */
export async function duplicateDiagram(projectId, diagram, { taskId, name } = {}) {
  const copy = normalizeDiagram({
    ...serializeDiagram(diagram),
    id: null,
    name: name || `${diagram.name} (copia)`,
    task_id: taskId === undefined ? diagram.task_id : taskId,
  });
  return saveDiagram(projectId, copy);
}

/**
 * Mueve los diagramas guardados localmente a la API cuando esta ya existe.
 * Devuelve cuántos migró. Se llama desde la vista cuando detecta la API.
 */
export async function migrateLocalDiagrams(projectId) {
  if (endpointSupported !== true) return 0;
  const list = readLocal();
  const mine = list.filter((d) => same(d.project_id, projectId));
  let migrated = 0;
  for (const record of mine) {
    try {
      await api.post(`/projects/${projectId}/diagrams`, serializeDiagram(record));
      migrated += 1;
    } catch {
      /* se deja en local para intentarlo después */
      continue;
    }
    writeLocal(readLocal().filter((d) => !same(d.id, record.id)));
  }
  return migrated;
}
