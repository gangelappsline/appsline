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
 *
 * Integridad del contenido
 * ------------------------
 * Un backend que valida el dibujo campo por campo (el caso típico es un
 * `$request->validated()` de Laravel ≥ 9 con reglas `data.nodes.*.id`,
 * `data.nodes.*.data.label`…) descarta TODO lo que no tenga regla propia:
 * `data.shape`, `data.style`, `width`, `height`, el estilo de las flechas.
 * El registro se guarda "bien" (200) y al reabrirlo cada nodo vuelve como
 * Proceso. Por eso aquí:
 *
 *   1. cada respuesta se revisa con `inspectDiagramPayload` (huella de las
 *      claves que el panel siempre envía);
 *   2. si falta contenido, se completa con la copia completa que este navegador
 *      guardó la última vez (`repairDiagramPayload`), sin pisar lo que la API
 *      sí devolvió y sin resucitar elementos eliminados;
 *   3. el diagrama lleva un `integrity` que la vista muestra, para que la causa
 *      quede a la vista en lugar de un lienzo degradado en silencio;
 *   4. nunca se envía un dibujo más pobre del que ya existe (renombrar desde
 *      una tarjeta con un listado ligero no puede borrar el contenido).
 */
import api from "./api.js";
import {
  inspectDiagramPayload,
  normalizeDiagram,
  repairDiagramPayload,
  serializeDiagram,
  unwrapDiagramResponse,
} from "../utils/diagrams.js";
import { readApiStatus, unwrapList } from "./admin.js";

const LOCAL_KEY = "appsline.diagrams.v1";
/** Copias completas de lo último enviado a la API, para restaurar respuestas podadas. */
const SNAPSHOT_KEY = "appsline.diagrams.snapshots.v1";
const SNAPSHOT_LIMIT = 8;
const SNAPSHOT_MAX_BYTES = 4 * 1024 * 1024;
const MISSING = [404, 405, 501];

/** `null` = sin sondear · `true` = la API tiene los endpoints · `false` = respaldo local. */
let endpointSupported = null;

/** Diagramas cuyo contenido en el servidor ya comprobamos que llega podado. */
const serverContentDegraded = new Set();

export const diagramsStorageMode = (diagramId) => (String(diagramId).startsWith("local-") || endpointSupported === false ? "local" : "api");
export const diagramsEndpointKnown = () => endpointSupported !== null;

/** Solo para pruebas / diagnóstico. */
export const __resetDiagramsEndpoint = () => {
  endpointSupported = null;
  serverContentDegraded.clear();
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
/* Copias de rescate (solo para diagramas guardados en la API)          */
/* ------------------------------------------------------------------ */

const snapshotId = (projectId, diagramId) => `${projectId ?? "?"}::${diagramId}`;

const readSnapshots = () => {
  const store = storage();
  if (!store) return {};
  try {
    const raw = JSON.parse(store.getItem(SNAPSHOT_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
};

const writeSnapshots = (all) => {
  const store = storage();
  if (!store) return false;
  const encode = (entries) => JSON.stringify(Object.fromEntries(entries));
  let entries = Object.entries(all)
    .sort((a, b) => String(b[1]?.saved_at || "").localeCompare(String(a[1]?.saved_at || "")))
    .slice(0, SNAPSHOT_LIMIT);
  while (entries.length > 1 && encode(entries).length > SNAPSHOT_MAX_BYTES) entries = entries.slice(0, -1);
  try {
    store.setItem(SNAPSHOT_KEY, encode(entries));
    return true;
  } catch {
    // La copia de rescate es un extra: nunca debe romper un guardado.
    try {
      store.setItem(SNAPSHOT_KEY, encode(entries.slice(0, 1)));
      return true;
    } catch {
      return false;
    }
  }
};

/** Guarda el dibujo completo que acabamos de enviar a la API. */
const rememberSnapshot = (projectId, diagramId, payload) => {
  if (!diagramId || String(diagramId).startsWith("local-")) return false;
  const encoded = JSON.stringify(payload?.data ?? null);
  const all = readSnapshots();
  const key = snapshotId(projectId, diagramId);
  if (all[key]?.encoded === encoded) return true;
  all[key] = { encoded, saved_at: new Date().toISOString() };
  return writeSnapshots(all);
};

/** Copia completa conocida de un diagrama, o `null`. */
const findSnapshot = (projectId, diagramId) => {
  if (!diagramId) return null;
  const entry = readSnapshots()[snapshotId(projectId, diagramId)];
  if (!entry?.encoded) return null;
  try {
    const data = JSON.parse(entry.encoded);
    return data && typeof data === "object" ? { data } : null;
  } catch {
    return null;
  }
};

const forgetSnapshot = (projectId, diagramId) => {
  if (!diagramId) return;
  const all = readSnapshots();
  delete all[snapshotId(projectId, diagramId)];
  writeSnapshots(all);
};

/** Diagnóstico: copias completas disponibles en este navegador. */
export const diagramSnapshots = () =>
  Object.entries(readSnapshots()).map(([key, entry]) => {
    const [projectId, diagramId] = key.split("::");
    let nodes = 0;
    try {
      nodes = JSON.parse(entry.encoded || "{}")?.nodes?.length || 0;
    } catch {
      nodes = 0;
    }
    return { project_id: projectId, id: diagramId, nodes, saved_at: entry.saved_at };
  });

/* ------------------------------------------------------------------ */
/* Informes de integridad                                              */
/* ------------------------------------------------------------------ */

const FIX_HINT = "La causa está en la API: debe guardar y devolver `data` completo (docs/API-DIAGRAMS.md, sección 4).";

/** Informe cuando la API devolvió un registro incompleto al leer. */
const readLossReport = (report, repaired) => ({
  ok: false,
  stage: "read",
  missing: report.missing,
  summary: report.summary,
  nodes: report.nodes,
  edges: report.edges,
  restored: repaired ? repaired.nodes + repaired.edges : 0,
  restoredFields: repaired?.fields || [],
  restoredFrom: repaired ? "local" : null,
  message: `La API devolvió el diagrama incompleto: descartó ${report.summary}.`,
  detail: repaired
    ? `Completamos ${repaired.nodes} ${repaired.nodes === 1 ? "nodo" : "nodos"} y ${repaired.edges} ${repaired.edges === 1 ? "conexión" : "conexiones"} con la copia guardada en este navegador; en el servidor siguen faltando. ${FIX_HINT}`
    : `Afecta a ${report.nodes || 0} ${report.nodes === 1 ? "nodo" : "nodos"}${report.edges ? ` y ${report.edges} conexiones` : ""}. Este navegador no tiene una copia completa para restaurarlos, así que se dibujan como Proceso. Exporta el JSON desde el equipo donde se dibujó e impórtalo aquí. ${FIX_HINT}`,
});

/** Informe cuando la API confirmó al guardar que descartó contenido. */
const saveLossReport = (report, repaired) => ({
  ok: false,
  stage: "save",
  missing: report.missing,
  summary: report.summary,
  nodes: report.nodes,
  edges: report.edges,
  restored: repaired ? repaired.nodes + repaired.edges : 0,
  restoredFields: repaired?.fields || [],
  restoredFrom: repaired ? "session" : null,
  message: `La API guardó el diagrama pero descartó ${report.summary}.`,
  detail: `Se guardaron incompletos ${report.nodes || 0} ${report.nodes === 1 ? "nodo" : "nodos"}${report.edges ? ` y ${report.edges} conexiones` : ""}. Tu lienzo sigue completo en esta sesión y quedó una copia en este navegador, pero en otro equipo se verá degradado. ${FIX_HINT}`,
});

const withIntegrity = (diagram, report) => {
  if (report) diagram.integrity = report;
  return diagram;
};

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

const diagramKeys = ["diagram", "diagrams", "flowchart", "flowcharts"];

const parseContent = (value) => {
  const parsed = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
};

/**
 * Normaliza un registro venido de la API revisando antes si le falta contenido
 * y completándolo con la copia local cuando existe.
 */
const normalizeServerRecord = (projectId, raw) => {
  const record = raw && typeof raw === "object" ? raw : {};
  const diagramId = record.id ?? null;
  const report = inspectDiagramPayload(record);
  if (report.ok || !report.inspected) return normalizeDiagram(record);
  const snapshot = findSnapshot(projectId ?? record.project_id, diagramId);
  if (snapshot) {
    const repaired = repairDiagramPayload(record, snapshot);
    return withIntegrity(normalizeDiagram({ ...record, data: repaired.data }), readLossReport(report, repaired));
  }
  return withIntegrity(normalizeDiagram(record), readLossReport(report, null));
};

/** Contenido completo guardado en el servidor, si es que lo tiene. */
async function readStoredContent(projectId, diagramId) {
  if (!diagramId || String(diagramId).startsWith("local-")) return null;
  try {
    const { data } = await api.get(`/projects/${projectId}/diagrams/${diagramId}`);
    endpointSupported = true;
    const found = unwrapDiagramResponse(data);
    return found ? parseContent(found.data ?? found.content ?? found.payload) : null;
  } catch {
    return null;
  }
}

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
      let list = unwrapList(data, diagramKeys).map((record) => normalizeServerRecord(projectId, record));
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
      return found ? normalizeServerRecord(projectId, { ...found, id: found.id ?? diagramId, project_id: projectId }) : null;
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
      return unwrapList(data, diagramKeys).map((record) =>
        normalizeServerRecord(record?.project_id ?? record?.project?.id, record),
      );
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
 * Contenido más completo disponible para un diagrama que llegó podado de la
 * API: la copia local o una lectura directa del registro. Nunca se envía un
 * dibujo más pobre del que ya existe (p. ej. al renombrar desde una tarjeta
 * cuando el listado devuelve solo un resumen).
 */
async function completeContent(projectId, diagram, payload) {
  const flag = diagram?.integrity;
  if (!flag || flag.ok !== false || flag.restored) return payload.data;
  const snapshot = findSnapshot(projectId, diagram.id);
  if (snapshot && inspectDiagramPayload(snapshot).ok) return snapshot.data;
  const probe = `${projectId ?? "?"}::${diagram.id}`;
  // Ya comprobamos que el servidor tampoco lo tiene completo: no repetir la lectura.
  if (serverContentDegraded.has(probe)) return payload.data;
  const stored = diagram.id ? await readStoredContent(projectId, diagram.id) : null;
  if (stored && inspectDiagramPayload({ data: stored }).ok) return stored;
  serverContentDegraded.add(probe);
  return payload.data;
}

/**
 * Crea o actualiza un diagrama. Devuelve el diagrama normalizado con el `id`
 * definitivo (el que dé la API o uno local) y, si la API descartó contenido,
 * un `integrity` con el diagnóstico y la copia restaurada.
 */
export async function saveDiagram(projectId, diagram) {
  const payload = serializeDiagram(diagram);
  const hasId = diagram.id !== null && diagram.id !== undefined && diagram.id !== "";
  const isLocal = hasId && String(diagram.id).startsWith("local-");

  // Un registro remoto siempre se actualiza por su ID. Un PUT fallido no
  // significa «crear una copia local» (ni mucho menos repetir un POST).
  if (!isLocal && (hasId || endpointSupported !== false)) {
    if (hasId) payload.data = await completeContent(projectId, diagram, payload);
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
      // Copia completa en este navegador: es lo que permite restaurar una
      // respuesta podada sin perder el trabajo del usuario.
      rememberSnapshot(projectId, id, payload);
      const responded = saved && (saved.data !== undefined || saved.nodes !== undefined) ? saved : null;
      const report = responded ? inspectDiagramPayload(responded) : null;
      // Un PUT puede responder 204 o solo metadatos. Nunca perder contenido/ID.
      if (!report || report.ok || !report.inspected) {
        return normalizeDiagram({ ...diagram, ...saved, data: saved?.data ?? payload.data, id, project_id: projectId });
      }
      serverContentDegraded.add(`${projectId ?? "?"}::${id}`);
      const repaired = repairDiagramPayload(responded, payload);
      return withIntegrity(
        normalizeDiagram({ ...diagram, ...saved, data: repaired.data, id, project_id: projectId }),
        saveLossReport(report, repaired),
      );
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
      forgetSnapshot(projectId, diagramId);
      return;
    } catch (error) {
      if (!MISSING.includes(readApiStatus(error))) throw error;
      endpointSupported = false;
    }
  }
  forgetSnapshot(projectId, diagramId);
  writeLocal(readLocal().filter((d) => !same(d.id, diagramId)));
}

/** Copia de un diagrama (mismo proyecto, misma tarea salvo que se indique). */
export async function duplicateDiagram(projectId, diagram, { taskId, name } = {}) {
  const serialized = serializeDiagram(diagram);
  const flag = diagram?.integrity;
  // Si el origen llegó podado de la API, se duplica la copia completa.
  const degraded = Boolean(flag && flag.ok === false && !flag.restored);
  const copy = normalizeDiagram({
    ...serialized,
    data: degraded ? await completeContent(projectId, diagram, serialized) : serialized.data,
    id: null,
    name: name || `${diagram.name} (copia)`,
    task_id: taskId === undefined ? diagram.task_id : taskId,
  });
  const saved = await saveDiagram(projectId, copy);
  return degraded ? withIntegrity(saved, flag) : saved;
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
