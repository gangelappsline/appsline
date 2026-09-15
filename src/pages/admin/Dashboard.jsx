/* eslint-disable react/prop-types */
import { useEffect, useState, useMemo } from "react";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import ProgressBar from "../../components/ProgressBar";
import UserAvatar from "../../components/UserAvatar";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiLayers,
} from "react-icons/fi";

const API_DASH = `${import.meta.env.VITE_API_URL || ""}/dashboard`;

// --- Simple BarChart & Donut (existente) ---
function BarChart({ data = [], height = 160, color = "#0060FC" }) {
  if (!data.length)
    return <div className="py-8 text-center text-sm text-slate-400">Sin datos</div>;
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  return (
    <svg viewBox={`0 0 ${data.length * 60} ${height}`} className="w-full h-40">
      {data.map((d, i) => {
        const w = 36;
        const x = i * 60 + 12;
        const h = Math.round((Number(d.value || 0) / max) * (height - 40) || 0);
        const y = height - h - 20;
        return (
          <g key={d.label || i}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill={color} />
            <text
              x={x + w / 2}
              y={height - 4}
              fontSize="11"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {d.label}
            </text>
            <text
              x={x + w / 2}
              y={y - 4}
              fontSize="11"
              fill="#334155"
              textAnchor="middle"
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ value = 0, size = 120, stroke = 14, color = "#0060FC" }) {
  const v = Math.max(0, Math.min(1, Number(value)));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - v);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          transform="rotate(-90)"
        />
        <text
          y="6"
          fontSize="18"
          textAnchor="middle"
          fill="#334155"
          fontWeight="700"
        >
          {Math.round(v * 100)}%
        </text>
      </g>
    </svg>
  );
}

// --- Gantt chart simple ---
function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
function diffDays(a, b) {
  const ms = 1000 * 60 * 60 * 24;
  return Math.ceil((b - a) / ms);
}

function Gantt({
  items = [],
  pxPerDay = 18,
  rowHeight = 28,
  headerHeight = 28,
}) {
  if (!items || !items.length)
    return <div className="py-8 text-center text-sm text-slate-400">Sin datos para Gantt</div>;

  const starts = items.map((it) => it.start).filter(Boolean);
  const ends = items.map((it) => it.end).filter(Boolean);
  const minStart = new Date(Math.min(...starts.map((d) => d.getTime())));
  const maxEnd = new Date(Math.max(...ends.map((d) => d.getTime())));

  // ensure at least 1 day window
  if (minStart >= maxEnd) maxEnd.setDate(minStart.getDate() + 1);

  const totalDays = diffDays(minStart, maxEnd) + 1;
  const width = Math.max(totalDays * pxPerDay, 600);
  const rows = items.map((it, idx) => {
    const s = it.start || minStart;
    const e = it.end || new Date(s.getTime() + 24 * 60 * 60 * 1000);
    const leftDays = Math.max(0, diffDays(minStart, s));
    const wDays = Math.max(1, diffDays(s, e));
    return {
      ...it,
      leftPx: leftDays * pxPerDay,
      widthPx: wDays * pxPerDay,
      top: headerHeight + idx * rowHeight,
    };
  });

  // generate date labels
  const labels = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(minStart.getTime());
    d.setDate(minStart.getDate() + i);
    labels.push(d);
  }

  const monthLabel = (d) => d.toLocaleString("es-ES", { month: "short" });

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <div style={{ minWidth: width }} className="relative">
        <div style={{ height: headerHeight, display: "flex" }}>
          {labels.map((d, i) => (
            <div
              key={i}
              style={{
                width: pxPerDay,
                borderLeft: "1px solid #f1f5f9",
                textAlign: "center",
                fontSize: 11,
                color: "#94a3b8",
                paddingTop: 4,
              }}
              title={d.toLocaleDateString()}
            >
              {i % 7 === 0 ? `${monthLabel(d)} ${d.getDate()}` : d.getDate()}
            </div>
          ))}
        </div>

        <div style={{ position: "relative", paddingBottom: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id || r.label}
              style={{ height: rowHeight }}
              className="flex items-center"
            >
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: r.top,
                  width: "30%",
                  maxWidth: 240,
                  color: "#334155",
                  fontSize: 13,
                  paddingLeft: 8,
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 260 + r.leftPx,
                  top: r.top + 6,
                  height: rowHeight - 12,
                  width: r.widthPx,
                  background: r.color || "#0060FC",
                  borderRadius: 6,
                  boxShadow: "0 1px 2px rgba(15,23,42,.15)",
                }}
                title={`${r.label} — ${r.start?.toLocaleDateString() || ""} → ${
                  r.end?.toLocaleDateString() || ""
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Dashboard principal ---
const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const token =
          localStorage.getItem("user_token") ||
          localStorage.getItem("token") ||
          "";
        const res = await fetch(API_DASH, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json().catch(() => ({}));
        if (!mounted) return;
        setData(json || {});
      } catch (e) {
        if (!mounted) return;
        setErr("Error cargando el dashboard");
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const payload = data?.data ?? data ?? {};

  // Productividad, tareas por estado, on-time, forecast (mismos mapeos previos)
  const productivity =
    (payload.productivity_by_user || []).map((u) => ({
      label:
        u.user?.name || u.name || u.username || `#${u.user_id ?? u.id ?? ""}`,
      value: Number(u.completed ?? u.count ?? u.tasks_completed ?? 0),
    })).length > 0
      ? (payload.productivity_by_user || []).map((u) => ({
          label:
            u.user?.name ||
            u.name ||
            u.username ||
            `#${u.user_id ?? u.id ?? ""}`,
          value: Number(u.completed ?? u.count ?? u.tasks_completed ?? 0),
        }))
      : (() => {
          const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
          const map = {};
          tasks.forEach((t) => {
            const user =
              typeof t.assigned_to === "object"
                ? t.assigned_to?.name
                : t.assigned_to || t.user?.name || t.user_id;
            const uid =
              typeof t.assigned_to === "object"
                ? t.assigned_to?.id
                : t.assigned_to ?? t.user_id ?? "sin-asignar";
            if (!map[uid])
              map[uid] = { label: user || `#${uid}`, completed: 0 };
            if (t.status === "completed") map[uid].completed++;
          });
          return Object.keys(map).map((k) => ({
            label: map[k].label,
            value: map[k].completed,
          }));
        })();

  const tasksByStatus =
    (payload.tasks_by_status || payload.tasks_summary || []).length > 0
      ? (payload.tasks_by_status || payload.tasks_summary).map((s) => ({
          label: s.status || s.key,
          value: Number(s.count ?? s.total ?? s.value ?? 0),
        }))
      : (() => {
          const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
          const counts = tasks.reduce((acc, t) => {
            const st = t.status || t.state || "unknown";
            acc[st] = (acc[st] || 0) + 1;
            return acc;
          }, {});
          return Object.keys(counts).map((k) => ({
            label: k,
            value: counts[k],
          }));
        })();

  const onTimeRate = Number(
    payload.overall?.on_time_rate ??
      payload.on_time_rate ??
      payload.on_time_percentage ??
      payload.on_time ??
      0
  );

  const onTimeByUser =
    (payload.on_time_by_user || payload.users_on_time || []).length > 0
      ? (payload.on_time_by_user || payload.users_on_time).map((u) => ({
          id: u.user?.id ?? u.id ?? u.user_id,
          name:
            u.user?.name ||
            u.name ||
            u.username ||
            `#${u.user_id ?? u.id ?? ""}`,
          rate: Number(
            u.rate ??
              (u.on_time && u.total ? u.on_time / u.total : u.on_time_rate ?? 0)
          ),
          on_time: u.on_time ?? u.completed_on_time ?? 0,
          total: u.total ?? u.assigned ?? 0,
        }))
      : (() => {
          const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
          const map = {};
          tasks.forEach((t) => {
            const uid =
              typeof t.assigned_to === "object"
                ? t.assigned_to.id
                : t.assigned_to ?? t.user_id ?? null;
            const name =
              typeof t.assigned_to === "object"
                ? t.assigned_to.name
                : t.assigned_to || t.user?.name || uid;
            if (!uid) return;
            if (!map[uid]) map[uid] = { id: uid, name, on_time: 0, total: 0 };
            map[uid].total++;
            const due = t.due_date ? new Date(t.due_date) : null;
            const finished = t.completed_at ? new Date(t.completed_at) : null;
            if (due && finished && finished <= due) map[uid].on_time++;
          });
          return Object.keys(map).map((k) => ({
            id: map[k].id,
            name: map[k].name,
            rate: map[k].total ? map[k].on_time / map[k].total : 0,
            on_time: map[k].on_time,
            total: map[k].total,
          }));
        })();

  const projectsForecast =
    (payload.projects_forecast || payload.projects || []).length > 0
      ? (payload.projects_forecast || payload.projects).map((p) => ({
          id: p.project?.id ?? p.id,
          name: p.project?.name || p.name || `#${p.id}`,
          on_time_percent: Number(
            p.on_time_percent ?? p.probability ?? p.estimated_on_time ?? 0
          ),
        }))
      : [];

  // --- Construir items para Gantt ---
  const ganttItems = useMemo(() => {
    const items = [];

    // payload.projects with tasks[]
    if (Array.isArray(payload.projects)) {
      payload.projects.forEach((pr) => {
        const projectName =
          pr.name ||
          pr.project?.name ||
          `Proyecto #${pr.id || pr.project?.id || ""}`;
        const tasks = Array.isArray(pr.tasks) ? pr.tasks : [];
        tasks.forEach((t, i) => {
          const s = parseDateSafe(
            t.start_date ||
              t.start ||
              t.created_at ||
              t.created_at_at ||
              t.created_at
          );
          const e =
            parseDateSafe(
              t.end_date || t.end || t.due_date || t.completed_at
            ) || (s ? new Date(s.getTime() + 24 * 60 * 60 * 1000) : null);
          if (!s && !e) return;
          items.push({
            id: t.id ?? `${pr.id}-${i}`,
            label: `${projectName} — ${
              t.title || t.name || `Tarea #${t.id ?? i}`
            }`,
            start: s || e,
            end: e || s,
            color:
              t.priority === "high"
                ? "#ef4444"
                : t.priority === "medium"
                ? "#f59e0b"
                : "#0060FC",
          });
        });
      });
    }

    // fallback: payload.tasks (grouped by project if available)
    if (!items.length && Array.isArray(payload.tasks)) {
      payload.tasks.forEach((t, i) => {
        const projectName =
          t.project?.name ||
          t.project_name ||
          `Proyecto #${t.project_id ?? t.project?.id ?? "?"}`;
        const s = parseDateSafe(t.start_date || t.start || t.created_at);
        const e =
          parseDateSafe(t.end_date || t.end || t.due_date || t.completed_at) ||
          (s ? new Date(s.getTime() + 24 * 60 * 60 * 1000) : null);
        if (!s && !e) return;
        items.push({
          id: t.id ?? i,
          label: `${projectName} — ${
            t.title || t.name || `Tarea #${t.id ?? i}`
          }`,
          start: s || e,
          end: e || s,
          color:
            t.priority === "high"
              ? "#ef4444"
              : t.priority === "medium"
              ? "#f59e0b"
              : "#0060FC",
        });
      });
    }

    return items;
  }, [payload]);

  // construir lista plana de todas las tareas (projects[].tasks + payload.tasks)
  const allTasks = (() => {
    const list = [];
    if (Array.isArray(payload.projects)) {
      payload.projects.forEach((p) => {
        if (Array.isArray(p.tasks)) {
          p.tasks.forEach((t) =>
            list.push({ ...t, _project: { id: p.id, name: p.name } })
          );
        }
      });
    }
    if (Array.isArray(payload.tasks)) {
      payload.tasks.forEach((t) => list.push(t));
    }
    return list;
  })();

  // tasks_per_user: total, on_time (entregadas a tiempo) y late/overdue (no cumplieron la fecha)
  const tasksPerUser = (() => {
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
          : t.assigned_to ?? t.user?.name ?? `#${uid ?? "sin-asignar"}`;
      if (!uid) return;
      if (!map[uid])
        map[uid] = { id: uid, name, total: 0, on_time: 0, late: 0, overdue: 0 };
      map[uid].total++;

      const due = parseDateSafe(t.due_date || t.end_date || t.due);
      const finished = parseDateSafe(
        t.completed_at || t.finished_at || t.completed
      );
      if (finished) {
        if (due && finished <= due) {
          map[uid].on_time++;
        } else if (due && finished > due) {
          map[uid].late++;
        }
      } else {
        // no finalizada: si la fecha de entrega ya pasó -> overdue
        if (due && due < now) {
          map[uid].overdue++;
        }
      }
    });
    return Object.values(map);
  })();

  // KPIs seguros: la API puede no devolver tasks_by_status.
  const statusCounts = payload.tasks_by_status || {};
  const kpiCompleted = Number(statusCounts.completed ?? 0);
  const kpiInProgress = Number(statusCounts.in_progress ?? 0);
  const kpiPending = Number(statusCounts.pending ?? 0);
  const kpiTotal = kpiCompleted + kpiInProgress + kpiPending;
  const perUser = Array.isArray(payload.tasks_per_user)
    ? payload.tasks_per_user
    : tasksPerUser;

  const kpis = [
    {
      label: "Tareas completadas",
      value: kpiCompleted,
      icon: FiCheckCircle,
      tone: "text-emerald-600 bg-emerald-50 ring-emerald-100",
    },
    {
      label: "En progreso",
      value: kpiInProgress,
      icon: FiActivity,
      tone: "text-brand-700 bg-brand-50 ring-brand-100",
    },
    {
      label: "Pendientes",
      value: kpiPending,
      icon: FiClock,
      tone: "text-amber-600 bg-amber-50 ring-amber-100",
    },
    {
      label: "Total de tareas",
      value: kpiTotal,
      icon: FiLayers,
      tone: "text-slate-600 bg-slate-100 ring-slate-200",
    },
  ];

  return (
    <LayoutAdmin
      title="Dashboard"
      subtitle="Resumen de productividad y avance de tus proyectos"
    >
      {/* Estado de carga */}
      {loading && (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="admin-card p-5">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="admin-card h-80 animate-pulse lg:col-span-2" />
            <div className="admin-card h-80 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && err && (
        <div className="admin-card flex items-start gap-3 border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-base" />
          <div>
            <p className="font-semibold">{err}</p>
            <p className="mt-1 text-red-600/80">
              Verifica tu conexión o vuelve a intentarlo más tarde.
            </p>
          </div>
        </div>
      )}

      {!loading && !err && (
        <div className="space-y-6">
          {/* ---------- KPIs ---------- */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="admin-card admin-card-hover p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {value}
                    </p>
                  </div>
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tone}`}
                  >
                    <Icon className="text-lg" />
                  </span>
                </div>
                {kpiTotal > 0 && (
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{
                        width: `${Math.round((value / kpiTotal) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------- Productividad ---------- */}
            <section className="admin-card p-6 lg:col-span-2">
              <header className="mb-5">
                <h2 className="text-base font-semibold text-slate-800">
                  Productividad por usuario
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Entregas a tiempo frente a entregas tardías.
                </p>
              </header>

              <div className="space-y-5">
                {perUser.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Aún no hay datos de usuarios.
                  </p>
                )}
                {perUser.map((user) => {
                  const base = user.total_completed || user.total || 0;
                  const prod =
                    100 - (user.late > 0 && base ? (user.late * 100) / base : 0);
                  return (
                    <div
                      key={user.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <UserAvatar profile={user} size={40} color="#0060FC" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Productividad: {Math.round(prod)}%
                          </p>
                        </div>
                        <span
                          className={
                            prod >= 80
                              ? "badge-green"
                              : prod >= 50
                              ? "badge-amber"
                              : "badge-red"
                          }
                        >
                          {Math.round(prod)}%
                        </span>
                      </div>
                      <ProgressBar
                        on_time={user.on_time}
                        late={user.late}
                        total={user.total}
                      />
                    </div>
                  );
                })}
              </div>

              {productivity.length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Tareas completadas por usuario
                  </h3>
                  <BarChart data={productivity} />
                </div>
              )}

              {tasksByStatus.length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Tareas por estado
                  </h3>
                  <BarChart data={tasksByStatus} color="#00A3FE" />
                </div>
              )}
            </section>

            {/* ---------- Entrega a tiempo ---------- */}
            <section className="admin-card h-fit p-6">
              <header className="mb-5">
                <h2 className="text-base font-semibold text-slate-800">
                  Entrega a tiempo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Estimación global de cumplimiento.
                </p>
              </header>

              <div className="flex flex-col items-center rounded-xl bg-slate-50 py-6">
                <Donut value={onTimeRate} />
                <p className="mt-3 text-center text-sm text-slate-500">
                  Proyectos que se entregarán a tiempo
                </p>
              </div>

              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Pronóstico por proyecto
                </h3>
                <div className="space-y-3">
                  {projectsForecast.length === 0 && (
                    <p className="text-sm text-slate-400">
                      Sin datos de proyectos.
                    </p>
                  )}
                  {projectsForecast.map((p) => {
                    const pct = Math.round((p.on_time_percent || 0) * 100);
                    const color =
                      pct >= 80
                        ? "bg-emerald-500"
                        : pct >= 50
                        ? "bg-amber-400"
                        : "bg-red-500";
                    return (
                      <div key={p.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-slate-600">
                            {p.name}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-800">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`${color} h-full rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Cumplimiento por usuario
                </h3>
                <div className="space-y-2">
                  {onTimeByUser.length === 0 && (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                  {onTimeByUser.slice(0, 6).map((u) => {
                    const pct = Math.round((u.rate || 0) * 100);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {u.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.on_time}/{u.total} a tiempo
                          </p>
                        </div>
                        <span
                          className={pct >= 80 ? "badge-green" : "badge-slate"}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </LayoutAdmin>
  );
};

export default Dashboard;
