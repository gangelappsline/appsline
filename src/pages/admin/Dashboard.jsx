import React, { useEffect, useState, useMemo } from "react";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import ProgressBar from "../../components/ProgressBar";
import UserAvatar from "../../components/UserAvatar";

const API_DASH = `${import.meta.env.VITE_API_URL || ""}/dashboard`;

// --- Simple BarChart & Donut (existente) ---
function BarChart({ data = [], height = 160, color = "#60A5FA" }) {
  if (!data.length)
    return <div className="text-sm text-gray-400">Sin datos</div>;
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
              fill="#cbd5e1"
              textAnchor="middle"
            >
              {d.label}
            </text>
            <text
              x={x + w / 2}
              y={y - 4}
              fontSize="11"
              fill="#e6edf3"
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

function Donut({ value = 0, size = 120, stroke = 14, color = "#34d399" }) {
  const v = Math.max(0, Math.min(1, Number(value)));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - v);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={radius} stroke="#24303a" strokeWidth={stroke} fill="none" />
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
          fill="#e6edf3"
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
    return <div className="text-sm text-gray-400">Sin datos para Gantt</div>;

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
    <div className="border border-gray-700 rounded bg-[#0b1114] overflow-auto">
      <div style={{ minWidth: width }} className="relative">
        <div style={{ height: headerHeight, display: "flex" }}>
          {labels.map((d, i) => (
            <div
              key={i}
              style={{
                width: pxPerDay,
                borderLeft: "1px solid rgba(255,255,255,0.03)",
                textAlign: "center",
                fontSize: 11,
                color: "#cbd5e1",
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
                  color: "#e6edf3",
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
                  background: r.color || "#60a5fa",
                  borderRadius: 6,
                  boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
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
                : "#60a5fa",
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
              : "#60a5fa",
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

  return (
    <LayoutAdmin>
      <div className="p-6">

        {loading && <div className="text-gray-400">Cargando métricas...</div>}
        {err && <div className="text-red-500">{err}</div>}

        {!loading && payload && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white">Tareas completas</h2>
                <span className="text-3xl text-white">{data.data.tasks_by_status.completed}</span>                
              </div>
              <div className="bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white">Tareas en progreso</h2>
                <span className="text-3xl text-white">{data.data.tasks_by_status.in_progress}</span>
              </div>
              <div className="bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white">Tareas pendientes</h2>
                <span className="text-3xl text-white">{data.data.tasks_by_status.pending}</span>
              </div>
              <div className="bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white">Tareas</h2>
                <span className="text-3xl text-white">{data.data.tasks_by_status.completed + data.data.tasks_by_status.in_progress + data.data.tasks_by_status.pending + data.data.tasks_by_status.completed}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-3">
                  Productividad por usuario
                </h2>
                <div className="mb-4">
                  {data.data.tasks_per_user.map((user) => {
                    const productivity =
                      100 -
                      (user.late > 0 ? (user.late * 100) / user.total_completed : 0);
                    return (
                      <div
                        key={user.id}
                        className="flex flex-col gap-2 items-start justify-between"
                      >
                        <div className="text-sm flex gap-2 text-gray-200">
                          <div>
                            <UserAvatar profile={user} size={42} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">{user.name}</span>{" "}
                            <span className="text-gray-400">
                              (Productividad: {Math.round(productivity)}%)
                            </span>
                          </div>
                        </div>
                        <ProgressBar
                          on_time={user.on_time}
                          late={user.late}
                          total={user.total}
                        />
                      </div>
                    );
                  })}
                  <BarChart data={productivity} />
                </div>

                <h2 className="text-lg font-semibold text-white mb-3 mt-6">
                  Tareas por estado
                </h2>
                <div className="mb-4">
                  <BarChart data={tasksByStatus} color="#F59E0B" />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  {onTimeByUser.slice(0, 6).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-[#0b1320] p-2 rounded"
                    >
                      <div>
                        <div className="text-sm text-gray-200 font-medium">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {u.on_time}/{u.total} a tiempo
                        </div>
                      </div>
                      <div className="text-sm text-white font-semibold">
                        {Math.round((u.rate || 0) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0f1720] p-4 rounded-lg border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-3">
                  Probabilidad de entrega a tiempo
                </h2>
                <div className="flex items-center gap-4">
                  <Donut value={onTimeRate} />
                  <div className="flex-1">
                    <div className="text-white font-semibold text-2xl">
                      {Math.round((onTimeRate || 0) * 100)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      Proyectos que se entregarán a tiempo (estimado)
                    </div>

                    <div className="mt-4 space-y-2">
                      {projectsForecast.length === 0 && (
                        <div className="text-sm text-gray-400">
                          Sin datos de proyectos
                        </div>
                      )}
                      {projectsForecast.map((p) => {
                        const pct = Math.round((p.on_time_percent || 0) * 100);
                        const color =
                          pct >= 80
                            ? "bg-green-500"
                            : pct >= 50
                            ? "bg-yellow-400"
                            : "bg-red-500";
                        return (
                          <div key={p.id} className="text-sm">
                            <div className="flex justify-between mb-1">
                              <div className="text-gray-200">{p.name}</div>
                              <div className="text-white font-semibold">
                                {pct}%
                              </div>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded">
                              <div
                                className={`${color} h-2 rounded`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm text-gray-300 font-medium mb-2">
                    Usuarios entregando a tiempo 80%
                  </h3>
                  <div className="space-y-2">
                    {onTimeByUser.filter((u) => (u.rate || 0) >= 0.8).length ===
                      0 && (
                      <div className="text-sm text-gray-400">
                        Nadie cumple 80%
                      </div>
                    )}
                    {onTimeByUser
                      .filter((u) => (u.rate || 0) >= 0.8)
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between bg-[#071018] p-2 rounded"
                        >
                          <div className="text-sm text-gray-200">{u.name}</div>
                          <div className="text-xs text-green-300 font-semibold">
                            {Math.round((u.rate || 0) * 100)}%
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !payload && (
          <div className="text-gray-400">No hay métricas disponibles.</div>
        )}
      </div>
    </LayoutAdmin>
  );
};

export default Dashboard;
