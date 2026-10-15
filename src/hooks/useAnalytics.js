import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAnalyticsFinancial,
  fetchAnalyticsOverview,
  fetchAnalyticsProjects,
  fetchAnalyticsTeam,
  fetchAnalyticsTimeseries,
  fetchClients,
  fetchDashboard,
  fetchProjectTasks,
  fetchProjects,
} from "../services/admin";
import {
  HEALTH_META,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  clientPortfolio,
  computeKpis,
  dailyActivity,
  isActiveProject,
  isClosedTask,
  isTaskOverdue,
  monthlySeries,
  periodComparison,
  projectFunnel,
  projectHealth,
  sumBy,
  taskAging,
  teamWorkload,
  weeklyVelocity,
} from "../utils/analytics";
import { projectProgress, projectStatusMeta } from "../utils/format";

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                  */
/* ------------------------------------------------------------------ */

/** Ejecuta `worker` sobre `items` con un máximo de `limit` en paralelo. */
const mapLimit = async (items, limit, worker) => {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

/** Alias tolerante: acepta `total_projects` o `totalProjects`. */
const pick = (source, ...keys) => {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Normaliza 0-1 o 0-100 a 0-1. */
const ratio = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
};

/* ------------------------------------------------------------------ */
/* Hook                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Datos analíticos del panel.
 *
 * Calcula todas las métricas en el cliente (para que el panel funcione
 * siempre) y, si el backend expone `/analytics/*`, usa esos valores como
 * fuente de verdad para KPIs y series.
 *
 * @param {object} options
 *   - `period`  longitud en días del periodo comparado (por defecto 30)
 *   - `months`  meses del histórico (por defecto 6)
 *   - `weeks`   semanas de velocidad (por defecto 8)
 */
export const useAnalytics = ({ period = 30, months = 6, weeks = 8 } = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [server, setServer] = useState(null);
  const [serverSource, setServerSource] = useState("local");
  const [serverLoading, setServerLoading] = useState(false);
  const [timeseries, setTimeseries] = useState(null);

  /* ---- Carga principal: proyectos, clientes, dashboard y tareas ---- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [projRes, clientRes, dashRes] = await Promise.allSettled([
      fetchProjects(),
      fetchClients(),
      fetchDashboard(),
    ]);

    const projList = projRes.status === "fulfilled" ? projRes.value || [] : [];
    const clientList = clientRes.status === "fulfilled" ? clientRes.value || [] : [];
    const dashPayload = dashRes.status === "fulfilled" ? dashRes.value || {} : {};

    setProjects(projList);
    setClients(clientList);
    setDashboard(dashPayload);

    if (projRes.status === "rejected") {
      setError("No se pudo cargar la información del panel.");
    }

    // Tareas de todos los proyectos (el panel las necesita para los KPIs).
    const taskLists = await mapLimit(projList, 6, async (project) => {
      try {
        return await fetchProjectTasks(project.id);
      } catch {
        return [];
      }
    });

    const flatTasks = [];
    taskLists.forEach((list, i) => {
      const project = projList[i];
      (list || []).forEach((t) =>
        flatTasks.push({
          ...t,
          _project: {
            id: project?.id,
            name: t?.project?.name || project?.name || `Proyecto #${project?.id}`,
          },
        })
      );
    });
    setTasks(flatTasks);
    setLoading(false);
  }, []);

  /* ---- Endpoints opcionales de analítica (el panel degrada si no existen) ---- */
  const loadServer = useCallback(async () => {
    setServerLoading(true);
    const [overview, serverProjects, serverTeam, financial, series] = await Promise.all([
      fetchAnalyticsOverview({ days: period }).catch(() => null),
      fetchAnalyticsProjects().catch(() => null),
      fetchAnalyticsTeam().catch(() => null),
      fetchAnalyticsFinancial().catch(() => null),
      fetchAnalyticsTimeseries({ metric: "completed_tasks", granularity: "month" }).catch(() => null),
    ]);

    const hasServer = Boolean(overview || serverProjects?.length || serverTeam?.length);
    if (hasServer) {
      setServer({ overview, projects: serverProjects, team: serverTeam, financial, timeseries: series });
      setServerSource("server");
    } else {
      setServer(null);
      setServerSource("local");
    }
    setTimeseries(series);
    setServerLoading(false);
  }, [period]);

  /**
   * Pide una serie temporal concreta al backend.
   * Si el endpoint no existe devuelve `null` y el panel usa el cálculo local.
   *
   * @param {string} metric `created_tasks` | `completed_tasks` | `due_tasks` | ...
   * @param {string} granularity `day` | `week` | `month`
   */
  const loadTimeseries = useCallback(async (metric = "completed_tasks", granularity = "month") => {
    const data = await fetchAnalyticsTimeseries({ metric, granularity }).catch(() => null);
    setTimeseries(data);
    return data;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  /** Recarga todo (datos + analítica). */
  const reload = useCallback(async () => {
    await Promise.all([load(), loadServer()]);
  }, [load, loadServer]);

  /* ---------------- KPIs ---------------- */

  const localKpis = useMemo(() => computeKpis(projects, tasks), [projects, tasks]);

  const kpis = useMemo(() => {
    const s = server?.overview?.kpis || {};
    const periodInfo = server?.overview?.period || {};
    const prev = server?.overview?.previous_period || {};
    const k = {
      totalProjects: toNumber(pick(s, "total_projects", "totalProjects"), localKpis.totalProjects),
      activeProjects: toNumber(pick(s, "active_projects", "activeProjects"), localKpis.activeProjects),
      completedProjects: toNumber(
        pick(s, "completed_projects", "completedProjects"),
        localKpis.completedProjects
      ),
      totalTasks: toNumber(pick(s, "total_tasks", "totalTasks"), localKpis.totalTasks),
      completedTasks: toNumber(
        pick(s, "completed_tasks", "completedTasks"),
        localKpis.completedTasks
      ),
      pendingTasks: toNumber(pick(s, "pending_tasks", "pendingTasks"), localKpis.pendingTasks),
      overdueTasks: toNumber(pick(s, "overdue_tasks", "overdueTasks"), localKpis.overdueTasks),
      onTimeRate: ratio(pick(s, "on_time_rate", "onTimeRate")) ?? localKpis.onTimeRate,
      completionRate: ratio(pick(s, "completion_rate", "completionRate")) ?? localKpis.completionRate,
      avgCycleDays: toNumber(pick(s, "avg_cycle_days", "avgCycleDays"), localKpis.avgCycleDays),
      totalBudget: toNumber(pick(s, "total_budget", "totalBudget"), localKpis.totalBudget),
      spent: toNumber(pick(s, "spent", "spent_amount", "billed_amount"), localKpis.spent),
      billed: toNumber(pick(s, "billed_amount", "billed"), localKpis.spent),
      collected: toNumber(pick(s, "collected_amount", "collected"), 0),
      margin: toNumber(pick(s, "margin", "margin_percent"), localKpis.margin),
      activeClients: toNumber(
        pick(s, "active_clients", "activeClients"),
        localKpis.activeClients
      ),
      teamSize: toNumber(pick(s, "team_size", "teamSize"), localKpis.teamSize),
      utilization: ratio(pick(s, "utilization", "utilization_rate")) ?? null,
    };
    return {
      ...k,
      period: periodInfo.from || null,
      periodTo: periodInfo.to || null,
      previousPeriod: prev.from || null,
    };
  }, [server, localKpis]);

  /** Tendencias calculadas contra el periodo anterior. */
  const deltas = useMemo(() => {
    const serverDeltas = server?.overview?.deltas || {};
    const local = periodComparison(tasks, period);
    const pickDelta = (key, fallback) => {
      const v = pick(serverDeltas, key);
      if (v && typeof v === "object") return toNumber(v.value ?? v.percent ?? v.change, fallback);
      if (v !== undefined) return toNumber(v, fallback);
      return fallback;
    };
    return {
      totalTasks: pickDelta("total_tasks", local.deltas.created),
      completedTasks: pickDelta("completed_tasks", local.deltas.completed),
      createdTasks: pickDelta("created_tasks", local.deltas.created),
      onTimeRate: pickDelta("on_time_rate", 0),
      totalBudget: pickDelta("total_budget", 0),
      overdueTasks: pickDelta("overdue_tasks", 0),
    };
  }, [server, tasks, period]);

  /* ---------------- Distribuciones ---------------- */

  const statusDistribution = useMemo(() => {
    const source = server?.overview?.status_distribution;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.key || row.status,
        label: row.label || projectStatusMeta(row.key || row.status).label,
        value: toNumber(row.value ?? row.count),
        tone: row.tone || projectStatusMeta(row.key || row.status).tone,
      }));
    }
    const map = new Map();
    projects.forEach((p) => {
      const key = String(p.status || "active").toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      key,
      label: PROJECT_STATUS_LABELS[key] || projectStatusMeta(key).label,
      value,
      tone: projectStatusMeta(key).tone,
    }));
  }, [projects, server]);

  const taskStatusDistribution = useMemo(() => {
    const source = server?.overview?.task_status_distribution;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.key || row.status,
        label: row.label || TASK_STATUS_LABELS[row.key || row.status] || row.status,
        value: toNumber(row.value ?? row.count),
      }));
    }
    const map = new Map();
    tasks.forEach((t) => {
      const key = String(t.status || "pending").toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        label: TASK_STATUS_LABELS[key] || key,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tasks, server]);

  const priorityDistribution = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = String(t.priority || "medium").toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      key,
      label: PRIORITY_LABELS[key] || "Normal",
      value,
    }));
  }, [tasks]);

  /* ---------------- Series temporales ---------------- */

  const monthly = useMemo(() => {
    const source = server?.overview?.timeline;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.date || row.key,
        label: row.label || String(row.date || "").slice(0, 7),
        created: toNumber(row.created),
        completed: toNumber(row.completed ?? row.value),
        due: toNumber(row.due),
        value: toNumber(row.value ?? row.completed),
      }));
    }
    return monthlySeries(tasks, months);
  }, [server, tasks, months]);

  const velocity = useMemo(() => {
    const source = server?.overview?.velocity;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.week || row.date,
        label: row.label || String(row.week || row.date || ""),
        completed: toNumber(row.completed ?? row.value),
        created: toNumber(row.created),
        net: toNumber(row.net),
      }));
    }
    return weeklyVelocity(tasks, weeks);
  }, [server, tasks, weeks]);

  const activity = useMemo(() => {
    const source = server?.overview?.activity;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        date: row.date,
        value: toNumber(row.value ?? row.count),
      }));
    }
    return dailyActivity(tasks, Math.max(weeks * 7, 126));
  }, [server, tasks, weeks]);

  const aging = useMemo(() => {
    const source = server?.overview?.aging;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.bucket || row.key,
        label: row.label || row.bucket,
        value: toNumber(row.value ?? row.count),
      }));
    }
    return taskAging(tasks);
  }, [server, tasks]);

  /* ---------------- Equipo ---------------- */

  const team = useMemo(() => {
    const source = server?.team;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        id: pick(row, "user_id", "id"),
        name: pick(row, "name", "user_name") || "Sin nombre",
        role: pick(row, "role"),
        total: toNumber(pick(row, "assigned", "total")),
        completed: toNumber(pick(row, "completed")),
        inProgress: toNumber(pick(row, "in_progress")),
        pending: toNumber(pick(row, "pending")),
        overdue: toNumber(pick(row, "overdue")),
        onTime: toNumber(pick(row, "on_time")),
        late: toNumber(pick(row, "late")),
        onTimeRate: ratio(pick(row, "on_time_rate")),
        productivity: ratio(pick(row, "productivity")),
        avgCycle: toNumber(pick(row, "avg_cycle_days"), null),
        utilization: toNumber(pick(row, "utilization")),
        workload: toNumber(pick(row, "workload")),
      }));
    }
    return teamWorkload(tasks).map((row) => ({
      ...row,
      avgCycle: row.avgCycle,
      utilization: row.workload,
    }));
  }, [server, tasks]);

  /* ---------------- Clientes ---------------- */

  const portfolio = useMemo(() => {
    const source = server?.overview?.clients;
    if (Array.isArray(source) && source.length) {
      const rows = source.map((row) => ({
        key: String(pick(row, "client_id", "id") ?? pick(row, "name")),
        name: pick(row, "name", "client_name") || "Sin cliente",
        projects: toNumber(pick(row, "projects", "projects_count")),
        active: toNumber(pick(row, "active")),
        budget: toNumber(pick(row, "budget")),
        billed: toNumber(pick(row, "billed")),
        progress: toNumber(pick(row, "progress")),
        share: toNumber(pick(row, "share")),
      }));
      const total = sumBy(rows, (r) => r.budget);
      return {
        rows: rows
          .map((r) => ({ ...r, share: r.share || (total ? (r.budget / total) * 100 : 0) }))
          .sort((a, b) => b.budget - a.budget),
        total,
        hhi: toNumber(pick(server?.overview, "client_hhi")),
        topShare: rows[0]?.share || 0,
      };
    }
    return clientPortfolio(projects);
  }, [server, projects]);

  /* ---------------- Proyectos ---------------- */

  /** Tareas agrupadas por proyecto (para el cálculo local de salud). */
  const tasksByProject = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = t?._project?.id ?? t?.project?.id ?? t?.project_id;
      if (key === undefined || key === null) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return map;
  }, [tasks]);

  const projectMetrics = useMemo(() => {
    const source = server?.projects;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => {
        const health = toNumber(pick(row, "health_score", "health"), 0);
        const level = pick(row, "health_level") ||
          (health >= 75 ? "good" : health >= 50 ? "watch" : "risk");
        return {
          id: pick(row, "project_id", "id"),
          name: pick(row, "name", "project_name") || "Proyecto",
          client: pick(row, "client", "client_name") || "Sin cliente",
          status: pick(row, "status") || "active",
          budget: toNumber(pick(row, "budget")),
          spent: toNumber(pick(row, "spent")),
          invoiced: toNumber(pick(row, "invoiced")),
          progress: toNumber(pick(row, "progress")),
          total: toNumber(pick(row, "tasks_total", "total")),
          completed: toNumber(pick(row, "tasks_completed", "completed")),
          overdue: toNumber(pick(row, "overdue")),
          onTimeRate: ratio(pick(row, "on_time_rate")),
          avgCycle: toNumber(pick(row, "avg_cycle_days"), null),
          daysRemaining: toNumber(pick(row, "days_remaining"), null),
          health,
          level,
          meta: HEALTH_META[level] || HEALTH_META.watch,
        };
      });
    }

    return projects.map((p) => {
      const list = tasksByProject.get(p.id) || (Array.isArray(p.tasks) ? p.tasks : []);
      const health = projectHealth(p, list);
      const progress = list.length
        ? Math.round((health.completed / Math.max(health.total, 1)) * 100)
        : projectProgress(p);
      const onTime = list.filter(
        (t) =>
          t.completed_at &&
          t.due_date &&
          new Date(t.completed_at) <= new Date(t.due_date)
      ).length;
      const closed = list.filter(
        (t) => t.completed_at || t.status === "completed"
      ).length;
      const cycles = list
        .filter((t) => t.created_at && t.completed_at)
        .map(
          (t) =>
            Math.max(
              0,
              Math.round(
                (new Date(t.completed_at) - new Date(t.created_at)) / 86400000
              )
            )
        );
      return {
        id: p.id,
        name: p.name || "Proyecto",
        client: p.client?.name || p.client_name || "Sin cliente",
        status: p.status || "active",
        budget: toNumber(p.budget),
        spent: toNumber(p.spent ?? p.cost),
        invoiced: toNumber(p.invoiced),
        progress,
        total: health.total,
        completed: health.completed,
        overdue: health.overdue,
        onTimeRate: closed ? onTime / closed : health.onTimeRate,
        avgCycle: cycles.length
          ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10
          : null,
        daysRemaining: p.end_date
          ? Math.round((new Date(`${String(p.end_date).slice(0, 10)}T12:00:00`) - new Date()) / 86400000)
          : null,
        health: health.score,
        level: health.level,
        meta: HEALTH_META[health.level],
        raw: p,
      };
    });
  }, [server, projects, tasksByProject]);

  const atRisk = useMemo(
    () =>
      projectMetrics
        .filter((p) => p.level !== "good")
        .sort((a, b) => a.health - b.health),
    [projectMetrics]
  );

  const funnel = useMemo(() => {
    const source = server?.overview?.funnel;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        label: row.label || row.stage,
        value: toNumber(row.value ?? row.count),
      }));
    }
    return projectFunnel(projects);
  }, [server, projects]);

  /* ---------------- Radar de salud del portafolio ---------------- */

  const radar = useMemo(() => {
    const source = server?.overview?.portfolio_health;
    if (source && typeof source === "object") {
      return Object.entries(source).map(([label, value]) => ({
        label,
        value: toNumber(value),
        max: 100,
      }));
    }
    const list = projectMetrics;
    const avg = (fn, fallback = 0) =>
      list.length ? Math.round(list.reduce((s, p) => s + fn(p), 0) / list.length) : fallback;
    const onTime = list.filter((p) => p.onTimeRate !== null);
    return [
      { label: "Avance", value: avg((p) => p.progress), max: 100 },
      {
        label: "Puntualidad",
        value: onTime.length
          ? Math.round((onTime.reduce((s, p) => s + (p.onTimeRate || 0), 0) / onTime.length) * 100)
          : 0,
        max: 100,
      },
      { label: "Presupuesto", value: avg((p) => (p.budget ? 100 : 0)), max: 100 },
      { label: "Salud", value: avg((p) => p.health), max: 100 },
      {
        label: "Sin retrasos",
        value: list.length
          ? Math.round((list.filter((p) => !p.overdue).length / list.length) * 100)
          : 0,
        max: 100,
      },
    ];
  }, [server, projectMetrics]);

  /* ---------------- Tendencias de presupuesto ---------------- */

  const budgetByMonth = useMemo(() => {
    const source = server?.overview?.budget_timeline;
    if (Array.isArray(source) && source.length) {
      return source.map((row) => ({
        key: row.date || row.key,
        label: row.label || String(row.date || ""),
        budget: toNumber(row.budget),
        spent: toNumber(row.spent),
      }));
    }
    return [];
  }, [server]);

  /* ---------------- Próximos vencimientos ---------------- */

  const upcoming = useMemo(
    () =>
      tasks
        .filter((t) => t.due_date && !isClosedTask(t))
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 8),
    [tasks]
  );

  const overdueTasks = useMemo(() => tasks.filter(isTaskOverdue), [tasks]);

  const activeProjects = useMemo(
    () => projectMetrics.filter((p) => isActiveProject({ status: p.status })),
    [projectMetrics]
  );

  /** Cierre de tareas por mes (para el gráfico de barras). */
  const monthlyClosures = useMemo(
    () => monthly.map((m) => ({ label: m.label, value: m.completed })),
    [monthly]
  );

  return {
    loading,
    serverLoading,
    error,
    reload,
    source: serverSource,
    period,
    projects,
    tasks,
    clients,
    dashboard,
    kpis,
    deltas,
    statusDistribution,
    taskStatusDistribution,
    priorityDistribution,
    monthly,
    monthlyClosures,
    velocity,
    activity,
    aging,
    team,
    portfolio,
    projectMetrics,
    atRisk,
    funnel,
    radar,
    budgetByMonth,
    financial: server?.financial || null,
    timeseries,
    loadTimeseries,
    upcoming,
    overdueTasks,
    activeProjects,
    hasServer: Boolean(server),
  };
};

export default useAnalytics;
