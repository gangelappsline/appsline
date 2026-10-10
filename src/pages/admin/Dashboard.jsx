import { Link } from "react-router-dom";
import {
  FiActivity, FiAlertTriangle, FiArrowUpRight, FiBriefcase, FiCalendar,
  FiCheckCircle, FiCheckSquare, FiClock, FiLayers, FiPlus, FiBarChart2,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import ProgressBar from "../../components/ProgressBar";
import useDashboard from "../../hooks/useDashboard";
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState,
  ProgressRing, RankBars, BarChart, StatCard,
} from "../../components/admin";
import { formatDate, isOverdue } from "../../utils/format";

const Dashboard = () => {
  const {
    loading, error, reload, kpis, perUser, tasksByStatus,
    onTimeRate, forecast, upcoming, activeProjects,
  } = useDashboard();

  return (
    <LayoutAdmin
      title="Dashboard"
      subtitle="Resumen de productividad y avance de tus proyectos"
      actions={
        <>
          <Link to="/admin/reports" className="btn-secondary">
            <FiBarChart2 /> Ver reportes
          </Link>
          <Link to="/admin/projects?action=new" className="btn-primary">
            <FiPlus /> Nuevo proyecto
          </Link>
        </>
      }
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error && !kpis.total && perUser.length === 0 ? (
        <Card>
          <EmptyState
            icon={FiAlertTriangle}
            title="No se pudo cargar el dashboard"
            description="Verifica tu conexión o vuelve a intentarlo más tarde."
            action={<Button variant="secondary" onClick={reload}>Reintentar</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ---------- KPIs ---------- */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tareas completadas" value={kpis.completed} icon={FiCheckCircle} tone="green" progress={kpis.total ? (kpis.completed / kpis.total) * 100 : 0} />
            <StatCard label="En progreso" value={kpis.inProgress} icon={FiActivity} tone="brand" progress={kpis.total ? (kpis.inProgress / kpis.total) * 100 : 0} />
            <StatCard label="Pendientes" value={kpis.pending} icon={FiClock} tone="amber" progress={kpis.total ? (kpis.pending / kpis.total) * 100 : 0} />
            <StatCard label="Total de tareas" value={kpis.total} icon={FiLayers} tone="slate" />
          </div>

          {/* ---------- Accesos directos ---------- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: "/admin/tasks", icon: FiCheckSquare, tone: "bg-brand-50 text-brand-600", title: "Mi trabajo", desc: "Tareas asignadas" },
              { to: "/admin/calendar", icon: FiCalendar, tone: "bg-violet-50 text-violet-600", title: "Calendario", desc: "Vencimientos" },
              { to: "/admin/projects", icon: FiBriefcase, tone: "bg-sky-50 text-sky-600", title: "Proyectos", desc: "Tableros kanban" },
              { to: "/admin/reports", icon: FiBarChart2, tone: "bg-emerald-50 text-emerald-600", title: "Reportes", desc: "Análisis y CSV" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="admin-card admin-card-hover group flex items-center gap-3.5 p-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${l.tone}`}>
                  <l.icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{l.title}</span>
                  <span className="block truncate text-xs text-slate-400">{l.desc}</span>
                </span>
                <FiArrowUpRight className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------- Productividad ---------- */}
            <Card className="p-6 lg:col-span-2">
              <CardHeader
                title="Productividad por usuario"
                subtitle="Entregas a tiempo frente a entregas tardías."
                actions={<Link to="/admin/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Ver reporte →</Link>}
              />
              {perUser.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aún no hay datos de usuarios.</p>
              ) : (
                <div className="space-y-4">
                  {perUser.slice(0, 6).map((u) => {
                    const base = u.total_completed || u.total || 0;
                    const prod = 100 - (u.late > 0 && base ? (u.late * 100) / base : 0);
                    return (
                      <div key={u.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <div className="mb-3 flex items-center gap-3">
                          <Avatar user={u} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.total || 0} tareas asignadas</p>
                          </div>
                          <Badge tone={prod >= 80 ? "green" : prod >= 50 ? "amber" : "red"}>
                            {Math.round(prod)}%
                          </Badge>
                        </div>
                        <ProgressBar on_time={u.on_time} late={u.late} total={u.total} height={10} />
                      </div>
                    );
                  })}
                </div>
              )}

              {tasksByStatus.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Tareas por estado</h3>
                  <BarChart data={tasksByStatus} />
                </div>
              )}
            </Card>

            {/* ---------- Columna lateral ---------- */}
            <div className="space-y-6">
              {/* Entrega a tiempo */}
              <Card className="p-6">
                <CardHeader title="Entrega a tiempo" subtitle="Estimación global de cumplimiento." />
                <div className="flex flex-col items-center rounded-xl bg-slate-50 py-5">
                  <ProgressRing value={onTimeRate} />
                  <p className="mt-3 px-4 text-center text-sm text-slate-500">
                    Proyectos que se entregarán a tiempo
                  </p>
                </div>
                {forecast.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Pronóstico por proyecto</h3>
                    <RankBars
                      data={forecast
                        .filter((p) => p.pct !== null)
                        .map((p) => ({
                          label: p.name,
                          value: p.pct,
                          display: `${p.pct}%`,
                          barClass: p.pct >= 80 ? "bg-emerald-500" : p.pct >= 50 ? "bg-amber-400" : "bg-red-500",
                        }))}
                    />
                    {forecast.every((p) => p.pct === null) && (
                      <p className="text-sm text-slate-400">Sin datos de pronóstico.</p>
                    )}
                  </div>
                )}
              </Card>

              {/* Próximos vencimientos */}
              <Card className="p-6">
                <CardHeader
                  title="Próximos vencimientos"
                  actions={<Link to="/admin/calendar" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Calendario →</Link>}
                />
                {upcoming.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No hay tareas próximas a vencer.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {upcoming.map((t) => {
                      const late = isOverdue(t.due_date);
                      const day = new Date(`${String(t.due_date).slice(0, 10)}T12:00:00`);
                      return (
                        <li key={`${t._project?.id}-${t.id}`}>
                          <Link
                            to={t._project?.id ? `/admin/projects/${t._project.id}?task=${t.id}` : "/admin/tasks"}
                            className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                          >
                            <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold leading-none ${late ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                              <span className="text-base tabular-nums">{day.getDate()}</span>
                              <span className="uppercase">{day.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
                              <span className="block truncate text-xs text-slate-400">{t._project?.name || "Tarea"}</span>
                            </span>
                            {late && <Badge tone="red">Vencida</Badge>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* ---------- Proyectos activos ---------- */}
          {activeProjects.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-6 pb-4">
                <CardHeader
                  title="Proyectos activos"
                  subtitle="Accede rápidamente a los tableros en curso."
                  actions={<Link to="/admin/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Ver todos →</Link>}
                />
              </div>
              <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {activeProjects.map((p) => (
                  <Link key={p.id} to={`/admin/projects/${p.id}`} className="group bg-white p-5 transition hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-violet-500 text-xs font-extrabold text-white">
                        {p.logo ? <img src={p.logo} alt="" className="h-full w-full object-cover" /> : (p.name || "P").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="truncate text-xs text-slate-400">{p.client_name || "Sin cliente"}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Entrega: <span className="font-semibold text-slate-700">{p.end_date ? formatDate(p.end_date) : "Sin fecha"}</span>
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </LayoutAdmin>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-label="Cargando dashboard">
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="admin-card space-y-3 p-5">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="admin-card h-96 animate-pulse lg:col-span-2" />
      <div className="admin-card h-96 animate-pulse" />
    </div>
  </div>
);

export default Dashboard;
