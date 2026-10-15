import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pruebas del modelo de tareas continuas / recurrentes (`src/utils/tasks.js`).
 *
 * Lo que se protege aquí:
 *  - La lectura tolerante de `task_type` (y de los alias que ya podría estar
 *    mandando la API: `is_recurring`, `recurring`, `type`…).
 *  - Que una fecha de entrega ausente **no** convierta una tarea puntual en
 *    continua (son cosas distintas: "sin agendar" ≠ "ongoing").
 *  - La aritmética de la siguiente ronda (diaria, semanal, quincenal, mensual
 *    y trimestral, con meses cortos).
 */
import {
  TASK_TYPE_ONCE,
  TASK_TYPE_ONGOING,
  hasDueDate,
  isOngoingTask,
  nextOccurrenceDate,
  nextOccurrenceFrom,
  nextRoundPayload,
  normalizeRecurrence,
  ongoingLabel,
  recurrenceMeta,
  recurrenceOf,
  taskDescriptionText,
  taskSchedule,
  taskTypeOf,
} from "../../src/utils/tasks.js";

test("reconoce las tareas continuas por sus distintas formas", () => {
  assert.equal(taskTypeOf({ task_type: "ongoing" }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ task_type: "recurring" }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ type: "permanente" }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ is_ongoing: true }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ is_recurring: 1 }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ recurring: "true" }), TASK_TYPE_ONGOING);
  assert.equal(taskTypeOf({ recurrence: "weekly" }), TASK_TYPE_ONGOING);
});

test("una tarea sin fecha no es continua por sí sola", () => {
  assert.equal(isOngoingTask({ id: 1, title: "Sin agendar" }), false);
  assert.equal(isOngoingTask({ due_date: null, task_type: "once" }), false);
  assert.equal(isOngoingTask({ task_type: "puntual" }), false);
  assert.equal(isOngoingTask({ recurrence: "none" }), false);
  assert.equal(isOngoingTask(null), false);
});

test("normaliza las cadencias y sus alias", () => {
  assert.equal(normalizeRecurrence("weekly"), "weekly");
  assert.equal(normalizeRecurrence("semanal"), "weekly");
  assert.equal(normalizeRecurrence("bi-weekly"), "biweekly");
  assert.equal(normalizeRecurrence("Quarterly"), "quarterly");
  assert.equal(normalizeRecurrence(""), "none");
  assert.equal(normalizeRecurrence("lo-que-sea"), "none");
  assert.equal(recurrenceOf({ recurrence_type: "mensual" }), "monthly");
  assert.equal(recurrenceMeta("daily").label, "Diaria");
  assert.equal(recurrenceMeta("desconocida").key, "none");
  assert.equal(
    ongoingLabel({ task_type: "ongoing", recurrence: "weekly" }),
    "Continua · semanal"
  );
  assert.equal(ongoingLabel({ task_type: "ongoing" }), "Continua");
});

test("calcula la siguiente ronda según la cadencia", () => {
  assert.equal(nextOccurrenceDate("daily", "2026-12-31"), "2027-01-01");
  assert.equal(nextOccurrenceDate("weekly", "2026-10-15"), "2026-10-22");
  assert.equal(nextOccurrenceDate("biweekly", "2026-10-15"), "2026-10-29");
  assert.equal(nextOccurrenceDate("monthly", "2026-10-15"), "2026-11-15");
  // Los meses cortos se ajustan al último día disponible.
  assert.equal(nextOccurrenceDate("monthly", "2026-01-31"), "2026-02-28");
  assert.equal(nextOccurrenceDate("quarterly", "2026-11-30"), "2027-02-28");
  assert.equal(nextOccurrenceDate("none", "2026-10-15"), null);
  assert.equal(nextOccurrenceDate("desconocida", "2026-10-15"), null);
});

test("la siguiente ronda de una tarea continua parte de hoy si no tiene fecha", () => {
  const from = "2026-10-15";
  assert.equal(
    nextOccurrenceFrom({ task_type: "ongoing", recurrence: "weekly" }, from),
    "2026-10-22"
  );
  // Si ya tiene fecha, se cuenta desde esa fecha.
  assert.equal(
    nextOccurrenceFrom(
      { task_type: "ongoing", recurrence: "weekly", due_date: "2026-11-05" },
      from
    ),
    "2026-11-12"
  );
});

test("describe cómo se agenda cada tarea", () => {
  assert.deepEqual(taskSchedule({ task_type: "ongoing", recurrence: "monthly" }), {
    kind: "ongoing",
    label: "Continua",
    detail: "Se renueva cada mes.",
  });
  const dated = taskSchedule({ task_type: "once", due_date: "2026-11-01" });
  assert.equal(dated.kind, "dated");
  assert.match(dated.label, /nov/i);

  const overdue = taskSchedule({ status: "pending", due_date: "2020-01-01" });
  assert.equal(overdue.kind, "overdue");
  assert.equal(overdue.detail, "Vencida");

  assert.deepEqual(taskSchedule({ title: "Sin fecha" }), {
    kind: "pending",
    label: "Sin fecha",
    detail: "Sin fecha de entrega",
  });
});

test("las tareas continuas quedan fuera de los avisos por vencimiento", () => {
  assert.equal(hasDueDate({ task_type: "ongoing", due_date: "2026-11-01" }), false);
  assert.equal(hasDueDate({ task_type: "once", due_date: "2026-11-01" }), true);
  assert.equal(hasDueDate({ task_type: "once" }), false);
});

test("la siguiente ronda se crea como tarea puntual con su fecha", () => {
  const payload = nextRoundPayload(
    {
      title: "Reporte semanal",
      description: "<p>Enviar el <strong>reporte</strong></p>",
      priority: "high",
      assigned_to: 7,
      estimated_hours: "2",
      task_type: "ongoing",
      recurrence: "weekly",
    },
    "2026-10-22"
  );

  assert.deepEqual(payload, {
    title: "Reporte semanal",
    description: "<p>Enviar el <strong>reporte</strong></p>",
    status: "pending",
    priority: "high",
    assigned_to: 7,
    estimated_hours: 2,
    task_type: TASK_TYPE_ONCE,
    recurrence: "none",
    due_date: "2026-10-22",
  });
});

test("la descripción se lee en texto plano para buscadores y resúmenes", () => {
  assert.equal(
    taskDescriptionText({ description: "<p>Uno</p><ul><li>Dos</li></ul>" }),
    "Uno\n• Dos"
  );
  assert.equal(taskDescriptionText({ description: "Texto antiguo" }), "Texto antiguo");
  assert.equal(taskDescriptionText({}), "");
});
