import test from "node:test";
import assert from "node:assert/strict";

/**
 * Varias personas por tarea (`src/utils/assignees.js`).
 *
 * Se protege la lectura tolerante de las distintas formas de la API
 * (`assignees` como objetos o ids, `assigned_to` suelto…), la detección de
 * "es mía" y el payload que se envía (lista + `assigned_to` de compatibilidad).
 */
import {
  assigneeNames,
  assigneesPayload,
  isAssignedTo,
  primaryAssignee,
  sameAssignees,
  taskAssigneeIds,
  taskAssignees,
  uniqueIds,
} from "../../src/utils/assignees.js";

const users = [
  { id: 3, name: "Ana García", email: "ana@appsline.mx" },
  { id: 7, name: "Luis Pérez", email: "luis@appsline.mx" },
  { id: 9, name: "Marta Ruiz" },
];

test("lee los ids desde cualquiera de las formas de la API", () => {
  assert.deepEqual(taskAssigneeIds({ assignees: [{ id: 3 }, { id: 7 }] }), [3, 7]);
  assert.deepEqual(taskAssigneeIds({ assignees: ["3", 7, 7] }), [3, 7]);
  assert.deepEqual(taskAssigneeIds({ assigned_to: 7 }), [7]);
  assert.deepEqual(taskAssigneeIds({ assigned_to: { id: 3, name: "Ana" } }), [3]);
  assert.deepEqual(taskAssigneeIds({ user_id: 9 }), [9]);
  assert.deepEqual(taskAssigneeIds({ assigned_user_ids: [9, 3] }), [9, 3]);
  assert.deepEqual(taskAssigneeIds({}), []);
  assert.deepEqual(taskAssigneeIds(null), []);
});

test("si la API manda assigned_to y una lista que no lo incluye, lo agrega", () => {
  assert.deepEqual(taskAssigneeIds({ assigned_to: 3, assignees: [7] }), [3, 7]);
  assert.deepEqual(taskAssigneeIds({ assigned_to: 3, assignees: [3, 7] }), [3, 7]);
  // Lista vacía explícita y sin assigned_to: nadie.
  assert.deepEqual(taskAssigneeIds({ assignees: [], assigned_to: null }), []);
});

test("completa las personas con el directorio de usuarios", () => {
  const people = taskAssignees({ assignees: [7, 3] }, users);
  assert.deepEqual(
    people.map((p) => p.name),
    ["Luis Pérez", "Ana García"],
  );
  // Sin directorio conserva lo que venía embebido.
  assert.equal(taskAssignees({ assignees: [{ id: 42, name: "Externo" }] })[0].name, "Externo");
  // Ni directorio ni objeto: nombre de respaldo.
  assert.equal(taskAssignees({ assignees: [42] })[0].name, "Usuario 42");
  assert.equal(primaryAssignee({ assigned_to: 9 }, users).name, "Marta Ruiz");
  assert.equal(primaryAssignee({}, users), null);
});

test("detecta si la tarea es de un usuario aunque no sea el primero", () => {
  const task = { assigned_to: 3, assignees: [3, 7] };
  assert.equal(isAssignedTo(task, { id: 7 }), true);
  assert.equal(isAssignedTo(task, { id: 9 }), false);
  assert.equal(isAssignedTo({ assignees: [{ id: 1, email: "x@y.z" }] }, { id: 99, email: "x@y.z" }), true);
  assert.equal(isAssignedTo(task, null), false);
});

test("nombres legibles", () => {
  assert.equal(assigneeNames({}, users), "Sin asignar");
  assert.equal(assigneeNames({ assignees: [3] }, users), "Ana García");
  assert.equal(assigneeNames({ assignees: [3, 7] }, users), "Ana García y Luis Pérez");
  assert.equal(assigneeNames({ assignees: [3, 7, 9] }, users), "Ana García, Luis Pérez y 1 más");
});

test("el payload lleva la lista y la primera persona por compatibilidad", () => {
  assert.deepEqual(assigneesPayload(["7", 3, 7]), { assignees: [7, 3], assigned_to: 7 });
  assert.deepEqual(assigneesPayload([]), { assignees: [], assigned_to: null });
  assert.deepEqual(uniqueIds([{ id: 2 }, "2", null, "", 5]), [2, 5]);
});

test("compara asignaciones sin importar el orden", () => {
  assert.equal(sameAssignees([3, 7], ["7", "3"]), true);
  assert.equal(sameAssignees([3], [3, 7]), false);
});
