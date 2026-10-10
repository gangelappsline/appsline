import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDashboard, fetchProjects } from "../services/admin";

const asList = (v) => (Array.isArray(v) ? v : []);

/**
 * Datos agregados del panel: KPIs, productividad, vencimientos y proyectos.
 * Fuente única para el Dashboard y la página de Reportes.
 *
 * @example const { loading, kpis, perUser, upcoming } = useDashboard();
 */
export const useDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState({});
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dash, projs] = await Promise.allSettled([fetchDashboard(), fetchProjects()]);
      if (dash.status === "fulfilled") {
        const raw = dash.value || {};
        setPayload(raw.data ?? raw);
      } else {
        setError("No se pudo cargar la información del dashboard.");
      }
      if (projs.status === "fulfilled") setProjects(projs.value);
    } catch {
      setError("No se pudo cargar la información del dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Todas las tareas (de proyectos[].tasks o del payload directo). */
  const allTasks = useMemo(() => {
    const list = [];
    asList(payload.projects).forEach((p) => {
      asList(p.tasks).forEach((t) =>
        list.push({ ...t, _project: { id: p.id, name: p.name } })
      );
    });
    asList(payload.tasks).forEach((t) =>
      list.push({
        ...t,
        _project: t.project
          ? { id: t.project.id, name: t.project.name }
          : t._project,
      })
    );
    return list;
  }, [payload]);

  const kpis = useMemo(() => {
    const counts = payload.tasks_by_status || {};
    const fromApi = ["completed", "in_progress", "pending"].some((k) => counts[k] !== undefined);
    const completed = fromApi
      ? Number(counts.completed ?? 0)
      : allTasks.filter((t) => t.status === "completed").length;
    const inProgress = fromApi
      ? Number(counts.in_progress ?? 0)
      : allTasks.filter((t) => t.status === "in_progress").length;
    const pending = fromApi
      ? Number(counts.pending ?? 0)
      : allTasks.filter((t) => t.status === "pending").length;
    return { completed, inProgress, pending, total: completed + inProgress + pending };
  }, [payload, allTasks]);

  const perUser = useMemo(() => {
    if (asList(payload.tasks_per_user).length) return payload.tasks_per_user;
    const map = {};
    const now = new Date();
    allTasks.forEach((t) => {
      const uid =
        typeof t.assigned_to === "object"
          ? t.assigned_to?.id
          : t.assigned_to ?? t.user_id ?? null;
      const name =
        typeof t.assigned_to === "object"
          ? t.assigned_to?.name
          : t.user?.name ?? `#${uid ?? "?"}`;
      if (!uid) return;
      if (!map[uid]) map[uid] = { id: uid, name, total: 0, on_time: 0, late: 0 };
      map[uid].total++;
      const due = t.due_date ? new Date(t.due_date) : null;
      const finished = t.completed_at ? new Date(t.completed_at) : null;
      if (finished && due) {
        if (finished <= due) map[uid].on_time++;
        else map[uid].late++;
      } else if (!finished && due && due < now) {
        map[uid].late++;
      }
    });
    return Object.values(map);
  }, [payload, allTasks]);

  const tasksByStatus = useMemo(() => {
    const fromApi = asList(payload.tasks_by_status || payload.tasks_summary);
    if (fromApi.length && typeof fromApi[0] === "object" && "status" in fromApi[0]) {
      return fromApi.map((s) => ({
        label: s.status,
        value: Number(s.count ?? s.total ?? s.value ?? 0),
      }));
    }
    const labels = {
      pending: "Pendientes",
      in_progress: "En progreso",
      completed: "Finalizadas",
      rejected: "Rechazadas",
    };
    const counts = {};
    allTasks.forEach((t) => {
      counts[t.status || "pending"] = (counts[t.status || "pending"] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ label: labels[k] || k, value: v }));
  }, [payload, allTasks]);

  const onTimeRate = useMemo(() => {
    const v = Number(
      payload.overall?.on_time_rate ??
        payload.on_time_rate ??
        payload.on_time_percentage ??
        payload.on_time ??
        NaN
    );
    if (!Number.isNaN(v)) return v > 1 ? v / 100 : v;
    const finished = allTasks.filter((t) => t.completed_at || t.status === "completed");
    if (!finished.length) return 0;
    const onTime = finished.filter(
      (t) => t.due_date && t.completed_at && new Date(t.completed_at) <= new Date(t.due_date)
    ).length;
    return onTime / finished.length;
  }, [payload, allTasks]);

  const forecast = useMemo(() => {
    const list = asList(payload.projects_forecast).length
      ? payload.projects_forecast
      : asList(payload.projects);
    return list.slice(0, 8).map((p) => ({
      id: p.project?.id ?? p.id,
      name: p.project?.name || p.name || `#${p.id}`,
      pct:
        Math.round(
          Number(p.on_time_percent ?? p.probability ?? p.estimated_on_time ?? 0) * 100
        ) || null,
    }));
  }, [payload]);

  const upcoming = useMemo(
    () =>
      allTasks
        .filter((t) => t.due_date && t.status !== "completed")
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 6),
    [allTasks]
  );

  const activeProjects = useMemo(
    () =>
      projects
        .filter((p) => !["completed", "finished", "finalizado", "rejected"].includes(p.status))
        .slice(0, 5),
    [projects]
  );

  const totalBudget = useMemo(
    () => projects.reduce((s, p) => s + Number(p.budget || 0), 0),
    [projects]
  );

  return {
    loading, error, reload: load,
    payload, projects, allTasks,
    kpis, perUser, tasksByStatus, onTimeRate, forecast,
    upcoming, activeProjects, totalBudget,
  };
};

export default useDashboard;
