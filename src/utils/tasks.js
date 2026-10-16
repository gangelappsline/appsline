/**
 * Tareas continuas (ongoing) y recurrentes.
 *
 * Una tarea **continua** es trabajo que no se entrega en una fecha concreta:
 * mantenimiento, soporte, guardias, seguimiento de un cliente… No tiene
 * `due_date` y se queda en el tablero hasta que alguien la finaliza. La
 * **cadencia** (`recurrence`) indica cada cuánto se renueva ese trabajo y sirve
 * para programar la siguiente ronda con un clic.
 *
 * Contrato con la API (detallado en `docs/API-TASKS.md`):
 *
 *   task_type:   "once"     → tarea puntual (la de siempre)
 *                "ongoing"  → tarea continua, sin fecha de entrega
 *   recurrence:  "none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly"
 *   due_date:    null en las tareas continuas
 *
 * El panel es tolerante: también reconoce `is_ongoing`, `is_recurring`,
 * `recurring` o `type` por si el backend ya usaba otro nombre.
 */
import { assigneesPayload, taskAssigneeIds } from "./assignees.js";
import { formatDate, isOverdue } from "./format.js";
import { richTextToPlain } from "./richText.js";

/** Tipos de tarea que ofrece el panel. */
export const TASK_TYPE_OPTIONS = [
  {
    key: "once",
    label: "Puntual",
    hint: "Se entrega en una fecha concreta.",
  },
  {
    key: "ongoing",
    label: "Continua (recurrente)",
    hint: "Sin fecha de entrega: se mantiene activa hasta finalizarla.",
  },
];

export const TASK_TYPE_ONCE = "once";
export const TASK_TYPE_ONGOING = "ongoing";

/** Etiqueta de la insignia de una tarea continua. */
export const ONGOING_LABEL = "Continua";

/** Cadencias disponibles para las tareas continuas. */
export const RECURRENCE_OPTIONS = [
  { key: "none", label: "Sin cadencia", hint: "Permanece abierta hasta finalizarla." },
  { key: "daily", label: "Diaria", hint: "Se renueva cada día." },
  { key: "weekly", label: "Semanal", hint: "Se renueva cada semana (7 días)." },
  { key: "biweekly", label: "Quincenal", hint: "Se renueva cada dos semanas." },
  { key: "monthly", label: "Mensual", hint: "Se renueva cada mes." },
  { key: "quarterly", label: "Trimestral", hint: "Se renueva cada trimestre." },
];

const RECURRENCE_KEYS = new Set(RECURRENCE_OPTIONS.map((option) => option.key));

/** Metadatos de una cadencia (siempre devuelve algo). */
export const recurrenceMeta = (key) =>
  RECURRENCE_OPTIONS.find((option) => option.key === normalizeRecurrence(key)) ||
  RECURRENCE_OPTIONS[0];

/** Normaliza la cadencia que llegue de la API. */
export const normalizeRecurrence = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "none";
  const aliases = {
    day: "daily",
    days: "daily",
    diaria: "daily",
    week: "weekly",
    semanas: "weekly",
    semanal: "weekly",
    fortnightly: "biweekly",
    "bi-weekly": "biweekly",
    quincenal: "biweekly",
    month: "monthly",
    mensual: "monthly",
    quarter: "quarterly",
    trimestral: "quarterly",
    no: "none",
    never: "none",
    ninguna: "none",
  };
  const key = aliases[raw] || raw;
  return RECURRENCE_KEYS.has(key) ? key : "none";
};

/** ¿El valor representa un "sí"? (1, "1", true, "true", "yes"…) */
const isTruthyFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const raw = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "si", "sí", "ongoing", "recurring", "on"].includes(raw);
};

const ONGOING_ALIASES = new Set([
  "ongoing",
  "recurring",
  "recurrent",
  "recurrente",
  "continuo",
  "continua",
  "continua_recurrente",
  "permanente",
  "maintenance",
]);
const ONCE_ALIASES = new Set([
  "once",
  "one_off",
  "one-off",
  "single",
  "puntual",
  "simple",
  "unique",
]);

/**
 * Tipo de una tarea: `"ongoing"` (continua) o `"once"` (puntual).
 *
 * Se lee de `task_type`/`type` y, si el backend todavía no lo manda, de los
 * indicadores `is_ongoing` / `is_recurring` / `recurring`. Una tarea **no** se
 * considera continua solo por no traer fecha: puede ser una tarea puntual
 * todavía sin agendar. Lo que sí la marca es tener cadencia (`recurrence`).
 */
export const taskTypeOf = (task) => {
  if (!task) return TASK_TYPE_ONCE;

  const raw = String(task.task_type ?? task.type ?? "").trim().toLowerCase();
  if (ONGOING_ALIASES.has(raw)) return TASK_TYPE_ONGOING;
  if (ONCE_ALIASES.has(raw)) return TASK_TYPE_ONCE;

  if (
    [task.is_ongoing, task.ongoing, task.is_recurring, task.recurring].some(
      isTruthyFlag
    )
  ) {
    return TASK_TYPE_ONGOING;
  }

  if (normalizeRecurrence(task.recurrence ?? task.recurrence_type) !== "none") {
    return TASK_TYPE_ONGOING;
  }

  return TASK_TYPE_ONCE;
};

/** ¿Es una tarea continua (sin fecha de entrega)? */
export const isOngoingTask = (task) => taskTypeOf(task) === TASK_TYPE_ONGOING;

/** Cadencia de una tarea continua (`"none"` si no tiene). */
export const recurrenceOf = (task) =>
  normalizeRecurrence(task?.recurrence ?? task?.recurrence_type);

/** Etiqueta corta para la insignia: "Continua · semanal". */
export const ongoingLabel = (task) => {
  const cadence = recurrenceOf(task);
  return cadence === "none"
    ? ONGOING_LABEL
    : `${ONGOING_LABEL} · ${recurrenceMeta(cadence).label.toLowerCase()}`;
};

/* ------------------------------------------------------------------ */
/* Fechas                                                             */
/* ------------------------------------------------------------------ */

/** Fecha local en formato `YYYY-MM-DD` (sin desfases de zona horaria). */
export const toISODate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Convierte ISO/Date en `Date` a mediodía (evita saltos por zona horaria). */
export const parseDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  const raw = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Suma meses conservando el día cuando el mes destino lo permite. */
export const addMonths = (date, months) => {
  const day = date.getDate();
  const next = new Date(date.getTime());
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
};

/**
 * Fecha de la siguiente ronda según la cadencia.
 * @param {string} cadence daily|weekly|biweekly|monthly|quarterly
 * @param {Date|string} [from] Punto de partida (por defecto hoy).
 * @returns {string|null} `YYYY-MM-DD` o `null` si no hay cadencia.
 */
export const nextOccurrenceDate = (cadence, from = new Date()) => {
  const base = parseDate(from) || new Date();
  const key = normalizeRecurrence(cadence);

  if (key === "daily") base.setDate(base.getDate() + 1);
  else if (key === "weekly") base.setDate(base.getDate() + 7);
  else if (key === "biweekly") base.setDate(base.getDate() + 14);
  else if (key === "monthly") return toISODate(addMonths(base, 1));
  else if (key === "quarterly") return toISODate(addMonths(base, 3));
  else return null;

  return toISODate(base);
};

/** Texto de la siguiente ronda ("12 nov 2026" ya formateado por quien pinta). */
export const nextOccurrenceFrom = (task, from = new Date()) =>
  nextOccurrenceDate(recurrenceOf(task), task?.due_date ? parseDate(task.due_date) || from : from);

/* ------------------------------------------------------------------ */
/* Lectura de una tarea                                                */
/* ------------------------------------------------------------------ */

/** Descripción en texto plano (los buscadores y resúmenes no ven etiquetas). */
export const taskDescriptionText = (task) => richTextToPlain(task?.description);

/**
 * Cómo se agenda una tarea, para pintarla sin repetir condicionales:
 *
 * ```js
 * taskSchedule(task)
 * // { kind: "ongoing",  label: "Continua",   detail: "Se renueva cada semana" }
 * // { kind: "dated",    label: "12 nov 2026", detail: "" }
 * // { kind: "overdue",  label: "3 nov 2026",  detail: "Vencida" }
 * // { kind: "pending",  label: "Sin fecha",  detail: "Sin fecha de entrega" }
 * ```
 */
export const taskSchedule = (task) => {
  if (isOngoingTask(task)) {
    const cadence = recurrenceOf(task);
    return {
      kind: "ongoing",
      label: ONGOING_LABEL,
      detail:
        cadence === "none"
          ? "Trabajo continuo, sin fecha de entrega"
          : recurrenceMeta(cadence).hint,
    };
  }
  if (task?.due_date) {
    const late = isOverdue(task.due_date) && task.status !== "completed";
    return {
      kind: late ? "overdue" : "dated",
      label: formatDate(task.due_date),
      detail: late ? "Vencida" : "",
    };
  }
  return { kind: "pending", label: "Sin fecha", detail: "Sin fecha de entrega" };
};

/** ¿La tarea cuenta para los avisos de "vence pronto"? (las continuas no). */
export const hasDueDate = (task) => !isOngoingTask(task) && Boolean(task?.due_date);

/**
 * Payload para programar la siguiente ronda de una tarea continua:
 * una tarea nueva, igual pero limpia (sin subtareas ni comentarios del pasado).
 */
export const nextRoundPayload = (task, dateISO) => ({
  title: task?.title || "",
  description: task?.description || "",
  status: "pending",
  priority: task?.priority || "medium",
  // Todas las personas asignadas pasan a la siguiente ronda.
  ...assigneesPayload(taskAssigneeIds(task)),
  estimated_hours:
    task?.estimated_hours === undefined || task?.estimated_hours === null
      ? null
      : Number(task.estimated_hours),
  task_type: TASK_TYPE_ONCE,
  recurrence: "none",
  due_date: dateISO || null,
});
