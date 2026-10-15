/**
 * Utilidades analíticas del panel administrativo.
 *
 * Todas las funciones son puras: reciben datos crudos (proyectos, tareas,
 * clientes) y devuelven métricas agregadas. El backend puede sobrescribir
 * estos valores (ver `useAnalytics`), pero aquí siempre existe un cálculo
 * local para que el panel nunca se quede sin datos.
 */
import { isOverdue, projectProgress } from "./format";

/* ------------------------------------------------------------------ */
/* Fechas                                                               */
/* ------------------------------------------------------------------ */

/** Convierte cualquier fecha (ISO, "YYYY-MM-DD", Date) a Date o null. */
export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value);
  const date = new Date(raw.length <= 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfDay = (value) => {
  const d = toDate(value);
  if (!d) return null;
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** "2026-10" */
export const monthKey = (value) => {
  const d = toDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** "Oct 26" */
export const monthLabel = (key) => {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return String(key || "");
  const date = new Date(y, m - 1, 1);
  return date
    .toLocaleDateString("es-MX", { month: "short" })
    .replace(".", "")
    .concat(` ${String(y).slice(2)}`);
};

/** Suma meses a una fecha. */
export const addMonths = (date, n) => {
  const d = toDate(date);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
};

/** Últimos `n` meses (incluye el actual), de más antiguo a más reciente. */
export const lastMonths = (n = 6, from = new Date()) => {
  const base = toDate(from) || new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addMonths(base, -i);
    out.push({ key: monthKey(d), label: monthLabel(monthKey(d)), date: d });
  }
  return out;
};

/** Clave de semana ISO: "2026-W42". */
export const isoWeekKey = (value) => {
  const d = startOfDay(value);
  if (!d) return null;
  const target = new Date(d);
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

/** Inicio de la semana ISO de una fecha. */
export const startOfWeek = (value) => {
  const d = startOfDay(value);
  if (!d) return null;
  const x = new Date(d);
  const dayNr = (d.getDay() + 6) % 7;
  x.setDate(x.getDate() - dayNr);
  return x;
};

/** Últimas `n` semanas, de más antigua a más reciente. */
export const lastWeeks = (n = 8, from = new Date()) => {
  const base = startOfDay(from) || new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    out.push({
      key: isoWeekKey(d),
      label: `S${isoWeekKey(d)?.split("-W")[1] ?? ""}`,
      date: d,
    });
  }
  return out;
};

/** Días entre dos fechas (positivo si `b` es posterior). */
export const daysBetween = (a, b) => {
  const da = startOfDay(a);
  const db = startOfDay(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 86400000);
};

/* ------------------------------------------------------------------ */
/* Colecciones                                                          */
/* ------------------------------------------------------------------ */

export const asList = (v) => (Array.isArray(v) ? v : []);

export const groupBy = (list, keyFn) => {
  const map = new Map();
  asList(list).forEach((item) => {
    const key = keyFn(item);
    if (key === null || key === undefined || key === "") return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

export const sumBy = (list, fn) =>
  asList(list).reduce((acc, item) => acc + (Number(fn(item)) || 0), 0);

/** Porcentaje seguro (0-100). */
export const pct = (part, whole) => {
  const w = Number(whole) || 0;
  if (w <= 0) return 0;
  return Math.round(((Number(part) || 0) / w) * 1000) / 10;
};

/* ------------------------------------------------------------------ */
/* Estados                                                             */
/* ------------------------------------------------------------------ */

export const DONE_STATUSES = ["completed", "finished", "done", "finalizado", "cerrado"];
export const CLOSED_STATUSES = [...DONE_STATUSES, "rejected", "cancelled", "canceled"];

export const isDoneTask = (task) => DONE_STATUSES.includes(String(task?.status || "").toLowerCase());
export const isClosedTask = (task) => CLOSED_STATUSES.includes(String(task?.status || "").toLowerCase());

/** Estados de proyecto considerados "en curso". */
export const isActiveProject = (project) =>
  !CLOSED_STATUSES.includes(String(project?.status || "active").toLowerCase());

/* ------------------------------------------------------------------ */
/* Tareas                                                               */
/* ------------------------------------------------------------------ */

/**
 * Tareas asociadas a un proyecto.
 * Acepta `project.tasks`, `project.task_list` o un array plano.
 */
export const tasksOf = (project) =>
  asList(project?.tasks).length
    ? asList(project.tasks)
    : asList(project?.task_list).length
    ? asList(project.task_list)
    : [];

/** Identificador del responsable de una tarea (soporta objeto o id). */
export const assigneeOf = (task) => {
  const raw = task?.assigned_to ?? task?.assigned ?? task?.user_id ?? task?.user;
  if (raw && typeof raw === "object") {
    return { id: raw.id ?? null, name: raw.name || raw.email || "Sin asignar", raw };
  }
  if (raw !== null && raw !== undefined && raw !== "") {
    return { id: raw, name: `#${raw}`, raw: null };
  }
  return { id: null, name: "Sin asignar", raw: null };
};

/** ¿La tarea está vencida y sin cerrar? */
export const isTaskOverdue = (task) =>
  !isClosedTask(task) && isOverdue(task?.due_date);

/** Ciclo real de una tarea completada (días). */
export const taskCycleDays = (task) => {
  const created = toDate(task?.created_at);
  const done = toDate(task?.completed_at);
  if (!created || !done) return null;
  const d = daysBetween(created, done);
  return d === null ? null : Math.max(0, d);
};

/* ------------------------------------------------------------------ */
/* Métricas de proyecto                                                 */
/* ------------------------------------------------------------------ */

/** Avance esperado según el calendario del proyecto (0-100). */
export const expectedProgress = (project) => {
  const start = toDate(project?.start_date);
  const end = toDate(project?.end_date);
  if (!start || !end) return null;
  const total = daysBetween(start, end);
  if (total === null || total <= 0) return 100;
  const elapsed = daysBetween(start, new Date()) ?? 0;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
};

/**
 * Semáforo de salud de un proyecto (0-100) y su nivel de riesgo.
 *
 * Se combina: desviación de calendario, tareas vencidas, puntualidad,
 * consumo de presupuesto y retraso medio de entrega.
 */
export const projectHealth = (project, tasks = []) => {
  const progress = projectProgress(project);
  const expected = expectedProgress(project);
  const closed = tasks.filter(isClosedTask);
  const done = tasks.filter(isDoneTask);
  const overdue = tasks.filter(isTaskOverdue);
  const onTime = closed.filter((t) => {
    const due = toDate(t?.due_date);
    const fin = toDate(t?.completed_at);
    return due && fin && fin <= due;
  }).length;
  const onTimeRate = closed.length ? onTime / closed.length : null;

  let score = 70;
  if (expected !== null) {
    const gap = progress - expected;
    score += Math.max(-30, Math.min(30, gap * 1.1));
  }
  if (tasks.length) {
    score -= Math.min(20, pct(overdue.length, tasks.length) * 0.4);
  }
  if (onTimeRate !== null) {
    score -= (1 - onTimeRate) * 20;
  }
  const budget = Number(project?.budget) || 0;
  const spent = Number(project?.spent ?? project?.cost ?? 0);
  if (budget > 0 && spent > 0) {
    const consumption = spent / budget;
    const expectedConsumption = expected === null ? progress : expected;
    if (consumption > expectedConsumption + 10) score -= 12;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 75 ? "good" : score >= 50 ? "watch" : "risk";
  return {
    score,
    level,
    progress,
    expected,
    overdue: overdue.length,
    onTimeRate,
    total: tasks.length,
    completed: done.length,
  };
};

export const HEALTH_META = {
  good: { label: "En ritmo", tone: "green" },
  watch: { label: "En riesgo", tone: "amber" },
  risk: { label: "Crítico", tone: "red" },
};

/* ------------------------------------------------------------------ */
/* Series temporales                                                    */
/* ------------------------------------------------------------------ */

/**
 * Serie mensual de tareas creadas / completadas / vencidas.
 * @param {Array} tasks
 * @param {number} months Cuántos meses incluir.
 */
export const monthlySeries = (tasks = [], months = 6) => {
  const buckets = lastMonths(months);
  const index = new Map(buckets.map((b) => [b.key, b]));
  const series = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    date: b.date,
    created: 0,
    completed: 0,
    due: 0,
    value: 0,
  }));

  tasks.forEach((t) => {
    const created = monthKey(t?.created_at);
    if (created && index.has(created)) {
      const row = series.find((s) => s.key === created);
      row.created += 1;
      row.value += 1;
    }
    const done = monthKey(t?.completed_at);
    if (done && index.has(done)) {
      const row = series.find((s) => s.key === done);
      row.completed += 1;
    }
    const due = monthKey(t?.due_date);
    if (due && index.has(due) && !isClosedTask(t)) {
      const row = series.find((s) => s.key === due);
      row.due += 1;
    }
  });

  return series;
};

/** Velocidad semanal (tareas completadas por semana). */
export const weeklyVelocity = (tasks = [], weeks = 8) => {
  const buckets = lastWeeks(weeks);
  const index = new Map(buckets.map((b) => [b.key, b]));
  const series = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    date: b.date,
    completed: 0,
    created: 0,
    net: 0,
  }));

  tasks.forEach((t) => {
    const done = isoWeekKey(t?.completed_at);
    if (done && index.has(done)) {
      const row = series.find((s) => s.key === done);
      row.completed += 1;
    }
    const created = isoWeekKey(t?.created_at);
    if (created && index.has(created)) {
      const row = series.find((s) => s.key === created);
      row.created += 1;
    }
  });
  series.forEach((s) => {
    s.net = s.completed - s.created;
  });
  return series;
};

/** Actividad diaria para el mapa de calor. */
export const dailyActivity = (tasks = [], days = 98) => {
  const out = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    out.push({ date: key, value: 0 });
  }
  const index = new Map(out.map((o) => [o.date, o]));
  tasks.forEach((t) => {
    const key = String(t?.completed_at || t?.created_at || "").slice(0, 10);
    if (index.has(key)) index.get(key).value += 1;
  });
  return out;
};

/** Antigüedad de las tareas abiertas (días desde su creación). */
export const taskAging = (tasks = []) => {
  const buckets = [
    { key: "0-3", label: "0-3 días", value: 0 },
    { key: "4-7", label: "4-7 días", value: 0 },
    { key: "8-14", label: "8-14 días", value: 0 },
    { key: "15-30", label: "15-30 días", value: 0 },
    { key: "30+", label: "+30 días", value: 0 },
  ];
  const now = new Date();
  tasks.filter((t) => !isClosedTask(t)).forEach((t) => {
    const created = toDate(t?.created_at);
    const age = created ? Math.max(0, daysBetween(created, now) ?? 0) : 0;
    const idx = age <= 3 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : age <= 30 ? 3 : 4;
    buckets[idx].value += 1;
  });
  return buckets;
};

/* ------------------------------------------------------------------ */
/* Equipo y clientes                                                    */
/* ------------------------------------------------------------------ */

/**
 * Carga de trabajo por persona.
 * @param {Array} tasks
 */
export const teamWorkload = (tasks = []) => {
  const map = new Map();
  tasks.forEach((t) => {
    const { id, name, raw } = assigneeOf(t);
    const key = id ?? `unassigned-${name}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: name || "Sin asignar",
        avatar: raw,
        role: raw?.role || null,
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        onTime: 0,
        late: 0,
        cycleDays: [],
      });
    }
    const row = map.get(key);
    row.total += 1;
    const status = String(t?.status || "").toLowerCase();
    if (isDoneTask(t)) row.completed += 1;
    else if (status === "in_progress") row.inProgress += 1;
    else row.pending += 1;
    if (isTaskOverdue(t)) row.overdue += 1;
    if (isClosedTask(t)) {
      const due = toDate(t?.due_date);
      const fin = toDate(t?.completed_at);
      if (due && fin) {
        if (fin <= due) row.onTime += 1;
        else row.late += 1;
      }
    }
    const cycle = taskCycleDays(t);
    if (cycle !== null) row.cycleDays.push(cycle);
  });

  return Array.from(map.values())
    .map((row) => {
      const closed = row.onTime + row.late;
      const avgCycle = row.cycleDays.length
        ? Math.round((row.cycleDays.reduce((a, b) => a + b, 0) / row.cycleDays.length) * 10) / 10
        : null;
      return {
        ...row,
        closed,
        onTimeRate: closed ? row.onTime / closed : null,
        productivity: closed ? Math.round((row.onTime / closed) * 100) : null,
        avgCycle,
        workload: row.total ? Math.round((row.inProgress / row.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
};

/**
 * Concentración de cartera por cliente.
 * Devuelve peso en presupuesto, número de proyectos y concentración HHI.
 */
export const clientPortfolio = (projects = []) => {
  const groups = groupBy(projects, (p) => p?.client_id ?? p?.client?.id ?? p?.client_name ?? "Sin cliente");
  const rows = Array.from(groups.entries()).map(([key, list]) => {
    const budget = sumBy(list, (p) => p?.budget);
    const progress = list.length
      ? Math.round(sumBy(list, (p) => projectProgress(p)) / list.length)
      : 0;
    const active = list.filter(isActiveProject).length;
    return {
      key: String(key),
      name: list[0]?.client?.name || list[0]?.client_name || "Sin cliente",
      projects: list.length,
      active,
      budget,
      progress,
      avgProgress: progress,
    };
  });
  const total = sumBy(rows, (r) => r.budget);
  const withShare = rows
    .map((r) => ({ ...r, share: pct(r.budget, total) }))
    .sort((a, b) => b.budget - a.budget);
  const hhi = Math.round(
    withShare.reduce((acc, r) => acc + (r.share / 100) ** 2, 0) * 10000
  );
  return { rows: withShare, total, hhi, topShare: withShare[0]?.share ?? 0 };
};

/* ------------------------------------------------------------------ */
/* Resumen global                                                       */
/* ------------------------------------------------------------------ */

/**
 * KPIs globales calculados en el cliente.
 * @param {Array} projects
 * @param {Array} tasks
 */
export const computeKpis = (projects = [], tasks = []) => {
  const budget = sumBy(projects, (p) => p?.budget);
  const spent = sumBy(projects, (p) => p?.spent ?? p?.cost);
  const done = tasks.filter(isDoneTask);
  const closed = tasks.filter(isClosedTask);
  const overdue = tasks.filter(isTaskOverdue);
  const onTime = closed.filter((t) => {
    const due = toDate(t?.due_date);
    const fin = toDate(t?.completed_at);
    return due && fin && fin <= due;
  }).length;
  const cycles = tasks.map(taskCycleDays).filter((c) => c !== null);

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter(isActiveProject).length,
    completedProjects: projects.filter((p) => DONE_STATUSES.includes(String(p.status).toLowerCase())).length,
    totalTasks: tasks.length,
    completedTasks: done.length,
    pendingTasks: tasks.filter((t) => !isClosedTask(t)).length,
    overdueTasks: overdue.length,
    onTimeRate: closed.length ? onTime / closed.length : 0,
    completionRate: tasks.length ? done.length / tasks.length : 0,
    avgCycleDays: cycles.length
      ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10
      : 0,
    totalBudget: budget,
    spent,
    margin: budget ? Math.max(0, Math.round(((budget - spent) / budget) * 100)) : 0,
    activeClients: new Set(
      projects
        .map((p) => p?.client_id ?? p?.client?.id ?? p?.client_name)
        .filter(Boolean)
    ).size,
    teamSize: new Set(tasks.map((t) => assigneeOf(t).id).filter(Boolean)).size,
  };
};

/** Diferencia porcentual entre dos periodos (para las tendencias). */
export const deltaPct = (current, previous) => {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Math.round(((c - p) / p) * 1000) / 10;
};

/**
 * Comparativa entre dos periodos a partir de las tareas.
 * @param {Array} tasks
 * @param {number} days Longitud del periodo en días.
 */
export const periodComparison = (tasks = [], days = 30) => {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const inRange = (value, from, to) => {
    const d = toDate(value);
    return d && d >= from && d < to;
  };

  const current = {
    created: tasks.filter((t) => inRange(t?.created_at, currentStart, now)).length,
    completed: tasks.filter((t) => inRange(t?.completed_at, currentStart, now)).length,
  };
  const previous = {
    created: tasks.filter((t) => inRange(t?.created_at, previousStart, currentStart)).length,
    completed: tasks.filter((t) => inRange(t?.completed_at, previousStart, currentStart)).length,
  };

  return {
    current,
    previous,
    deltas: {
      created: deltaPct(current.created, previous.created),
      completed: deltaPct(current.completed, previous.completed),
    },
  };
};

/** Distribución de tareas por estado (etiquetas en español). */
export const TASK_STATUS_LABELS = {
  pending: "Pendientes",
  in_progress: "En progreso",
  completed: "Finalizadas",
  rejected: "Rechazadas",
  cancelled: "Canceladas",
};

/** Distribución de proyectos por estado (etiquetas en español). */
export const PROJECT_STATUS_LABELS = {
  active: "En curso",
  pending: "Pendientes",
  in_progress: "En progreso",
  completed: "Finalizados",
  finished: "Finalizados",
  finalizado: "Finalizados",
  rejected: "Rechazados",
  paused: "En pausa",
  on_hold: "En pausa",
};

/** Distribución por prioridad. */
export const PRIORITY_LABELS = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

/** Embudo comercial a partir de los proyectos. */
export const projectFunnel = (projects = []) => {
  const total = projects.length;
  const withBudget = projects.filter((p) => Number(p?.budget) > 0).length;
  const started = projects.filter(
    (p) => !["pending", "pendiente"].includes(String(p?.status || "").toLowerCase())
  ).length;
  const delivered = projects.filter((p) =>
    DONE_STATUSES.includes(String(p?.status || "").toLowerCase())
  ).length;
  return [
    { label: "Proyectos registrados", value: total },
    { label: "Con presupuesto", value: withBudget },
    { label: "En ejecución", value: started },
    { label: "Entregados", value: delivered },
  ];
};
