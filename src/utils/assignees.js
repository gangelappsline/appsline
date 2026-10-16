/**
 * Varias personas asignadas a una tarea.
 *
 * La API histórica solo tenía `assigned_to` (un id o un objeto de usuario).
 * Ahora las tareas pueden tener **varias personas**; el panel envía
 * `assignees: [ids]` y, por compatibilidad, `assigned_to` con la primera.
 *
 * Estas funciones leen cualquiera de las formas que puede devolver el backend:
 *   - `assignees: [{ id, name }, ...]` o `assignees: [3, 7]`
 *   - `assigned_users`, `users`, `assignee_ids`
 *   - `assigned_to: 3` o `assigned_to: { id: 3, name }`
 *   - `user_id`, `user`
 *
 * No tocan el DOM: están cubiertas por `tests/unit/assignees.test.mjs`.
 */

const ARRAY_KEYS = ["assignees", "assigned_users", "assignee_ids", "assigned_user_ids", "members"];

const idOf = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return idOf(value.id ?? value.user_id ?? value.value);
  return /^\d+$/.test(String(value)) ? Number(value) : value;
};

const sameId = (a, b) => String(a) === String(b);

/** Ids únicos sin vacíos (`["3", 3, { id: 7 }]` -> `[3, 7]`). */
export const uniqueIds = (values = []) =>
  (Array.isArray(values) ? values : [values]).reduce((ids, value) => {
    const id = idOf(value);
    if (id === null) return ids;
    if (!ids.some((known) => sameId(known, id))) ids.push(id);
    return ids;
  }, []);

/** Ids de todas las personas asignadas a la tarea (vacío si no hay nadie). */
export const taskAssigneeIds = (task) => {
  if (!task) return [];
  for (const key of ARRAY_KEYS) {
    const raw = task[key];
    if (Array.isArray(raw)) {
      const ids = uniqueIds(raw);
      // Un arreglo presente (aunque vacío) es la fuente de verdad, salvo que
      // `assigned_to` traiga a alguien que el arreglo no incluye (API antigua).
      const single = idOf(task.assigned_to ?? task.user_id ?? task.user);
      if (single !== null && !ids.some((id) => sameId(id, single))) ids.unshift(single);
      return ids;
    }
  }
  return uniqueIds([task.assigned_to ?? task.user_id ?? task.user]);
};

/**
 * Personas asignadas como objetos de usuario. Si el backend solo mandó ids se
 * completan con el directorio `users`; si tampoco están ahí se devuelve un
 * objeto mínimo `{ id, name: "Usuario N" }` para no romper la vista.
 */
export const taskAssignees = (task, users = []) => {
  if (!task) return [];
  const embedded = [];
  for (const key of ARRAY_KEYS) {
    if (Array.isArray(task[key])) {
      task[key].forEach((item) => {
        if (item && typeof item === "object" && item.id !== undefined) embedded.push(item);
      });
    }
  }
  if (task.assigned_to && typeof task.assigned_to === "object") embedded.push(task.assigned_to);
  if (task.user && typeof task.user === "object") embedded.push(task.user);

  return taskAssigneeIds(task).map((id) => {
    const known = users.find((u) => sameId(u.id, id));
    const inline = embedded.find((u) => sameId(u.id, id));
    return {
      ...(inline || null),
      ...(known || null),
      id,
      name: known?.name || inline?.name || known?.email || inline?.email || `Usuario ${id}`,
    };
  });
};

/** Primera persona asignada (para vistas que solo muestran una). */
export const primaryAssignee = (task, users = []) => taskAssignees(task, users)[0] || null;

/** ¿La tarea está asignada a este usuario (por id o correo)? */
export const isAssignedTo = (task, user) => {
  if (!task || !user) return false;
  const ids = taskAssigneeIds(task);
  if (ids.some((id) => sameId(id, user.id) || (user.email && sameId(id, user.email)))) return true;
  const people = taskAssignees(task);
  return people.some((p) => user.email && p.email && p.email === user.email);
};

/** Nombres legibles: "Ana, Luis y 2 más". */
export const assigneeNames = (task, users = [], max = 2) => {
  const people = taskAssignees(task, users);
  if (!people.length) return "Sin asignar";
  const names = people.map((p) => p.name);
  if (names.length <= max) return names.join(names.length === 2 ? " y " : ", ");
  const shown = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return `${shown} y ${rest} más`;
};

/**
 * Parte del payload con la asignación para `POST/PUT .../tasks`.
 * Envía la lista completa en `assignees` y, por compatibilidad con la API
 * anterior, la primera persona en `assigned_to` (o `null` si no hay nadie).
 */
export const assigneesPayload = (ids = []) => {
  const clean = uniqueIds(ids);
  return { assignees: clean, assigned_to: clean[0] ?? null };
};

/** ¿Cambió la asignación? (mismo conjunto, sin importar el orden). */
export const sameAssignees = (a = [], b = []) => {
  const left = uniqueIds(a).map(String).sort();
  const right = uniqueIds(b).map(String).sort();
  return left.length === right.length && left.every((id, i) => id === right[i]);
};
