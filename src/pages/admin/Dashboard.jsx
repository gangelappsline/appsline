/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle, FiArrowUpRight, FiBarChart2, FiBriefcase,
  FiCalendar, FiCheckCircle, FiCheckSquare, FiClock, FiGrid, FiLayers, FiPlus,
  FiRefreshCw, FiShield, FiTarget, FiTrendingUp, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import useAnalytics from "../../hooks/useAnalytics";
import useUrlTab from "../../hooks/useUrlTab";
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState, StatCard, Tabs,
} from "../../components/admin";
import {
  AreaChart, BarsChart, DonutChart, GaugeChart, Heatmap, RadarChart, StackedBars,
} from "../../components/admin/DataViz";
import { cx, formatCurrency, formatNumber, isOverdue } from "../../utils/format";

/* ------------------------------------------------------------------ */
/* Configuración de la vista                                           */
/* ------------------------------------------------------------------ */

const RANGES = [
  { key: 7, label: "7 días" },
  { key: 30, label: "30 días" },
  { key: 90, label: "90 días" },
  { key: 365, label: "12 meses" },
];

const VIEW_TABS = [
  { key: "resumen", label: "Resumen", icon: FiGrid },
  { key: "proyectos", label: "Proyectos", icon: FiBriefcase },
  { key: "equipo", label: "Equipo", icon: FiUsers },
];

const STATUS_COLORS = {
  active: "#10b981",
  pending: "#8b5cf6",
  in_progress: "#0ea5e9",
  completed: "#64748b",
  finished: "#64748b",
  finalizado: "#64748b",
  rejected: "#f43f5e",
  paused: "#f59e0b",
  on_hold: "#f59e0b",
};

const statusColor = (status) => STATUS_COLORS[String(status || "active").toLowerCase()] || "#64748b";

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const [view, setView] = useUrlTab(
    VIEW_TABS.map((t) => t.key),
    "resumen"
  );
  const [range, setRange] = useState(30);

  const {
    loading, error, reload, source,
    kpis, deltas,
    statusDistribution, taskStatusDistribution,
    monthly, velocity, activity, aging,
    team, portfolio, projectMetrics, atRisk, radar, funnel,
    upcoming, overdueTasks, activeProjects,
  } = useAnalytics({ period: range });

  const completionsSeries = useMemo(() => monthly.map((m) => m.completed), [monthly]);

  const healthAverage = useMemo(() => {
    if (!projectMetrics.length) return 0;
    return Math.round(
      projectMetrics.reduce((s, p) => s + (p.health || 0), 0) / projectMetrics.length
    );
  }, [projectMetrics]);

  const completionRate = Math.round((kpis.completionRate || 0) * 100);
  const onTimeRate = Math.round((kpis.onTimeRate || 0) * 100);

  const riskTone = (level) =>
    level === "good" ? "green" : level === "watch" ? "amber" : "red";

  if (loading && !projectMetrics.length && !kpis.totalTasks) {
    return (
      <LayoutAdmin title="Dashboard" subtitle="Resumen ejecutivo del portafolio">
        <DashboardSkeleton />
      </LayoutAdmin>
    );
  }

  if (error && !kpis.totalProjects && !kpis.totalTasks) {
    return (
      <LayoutAdmin title="Dashboard" subtitle="Resumen ejecutivo del portafolio">
        <Card>
          <EmptyState
            icon={FiAlertTriangle}
            title="No se pudo cargar el dashboard"
            description="Verifica tu conexión o vuelve a intentarlo más tarde."
            action={<Button variant="secondary" onClick={reload}>Reintentar</Button>}
          />
        </Card>
      </LayoutAdmin>
    );
  }

  return (
    <LayoutAdmin
      title="Dashboard"
      subtitle="Resumen ejecutivo de productividad, portafolio y riesgo"
      actions={
        <>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  range === r.key
                    ? "bg-white text-slate-900 shadow-card"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={reload} aria-label="Actualizar datos">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Link to="/admin/analytics" className="btn-secondary">
            <FiBarChart2 /> <span className="hidden sm:inline">Analítica</span>
          </Link>
          <Link to="/admin/reports" className="btn-secondary">
            <span className="hidden sm:inline">Reportes</span>
          </Link>
          <Link to="/admin/projects?action=new" className="btn-primary">
            <FiPlus /> <span className="hidden sm:inline">Nuevo proyecto</span>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {/* ---------- Barra de contexto ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <Tabs tabs={VIEW_TABS} active={view} onChange={setView} variant="pill" />
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  source === "server" ? "bg-emerald-500" : "bg-amber-400"
                )}
              />
              {source === "server" ? "Datos de la API analítica" : "Cálculo local (API sin /analytics)"}
            </span>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" />
            <span>
              {kpis.totalProjects} proyectos · {kpis.totalTasks} tareas · {kpis.teamSize} personas
            </span>
          </div>
        </div>

        {view === "resumen" && (
          <>
            {/* ---------- KPIs principales ---------- */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Proyectos en curso"
                value={kpis.activeProjects}
                icon={FiBriefcase}
                tone="brand"
                trend={deltas.totalProjects}
                hint={`${kpis.totalProjects} en total`}
                spark={monthly.map((m) => m.created)}
              />
              <StatCard
                label="Tareas completadas"
                value={kpis.completedTasks}
                icon={FiCheckCircle}
                tone="green"
                progress={completionRate}
                trend={deltas.completedTasks}
                hint={`${completionRate}% del total`}
                spark={completionsSeries}
              />
              <StatCard
                label="Entrega a tiempo"
                value={`${onTimeRate}%`}
                icon={FiTarget}
                tone={onTimeRate >= 85 ? "green" : onTimeRate >= 65 ? "amber" : "red"}
                progress={onTimeRate}
                trend={deltas.onTimeRate}
                hint="Cumplimiento de fechas"
              />
              <StatCard
                label="Valor del portafolio"
                value={formatCurrency(kpis.totalBudget)}
                icon={FiTrendingUp}
                tone="violet"
                trend={deltas.totalBudget}
                hint={`${kpis.activeClients} clientes · ${kpis.teamSize} personas`}
              />
            </div>

            {/* ---------- KPIs secundarios ---------- */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SecondaryKpi
                icon={FiClock}
                label="Ciclo promedio"
                value={`${kpis.avgCycleDays || 0} d`}
                hint="De creación a cierre"
                tone="sky"
              />
              <SecondaryKpi
                icon={FiAlertTriangle}
                label="Tareas vencidas"
                value={kpis.overdueTasks}
                hint={kpis.overdueTasks ? "Requieren atención" : "Todo en tiempo"}
                tone={kpis.overdueTasks ? "red" : "green"}
              />
              <SecondaryKpi
                icon={FiLayers}
                label="Tareas abiertas"
                value={kpis.pendingTasks}
                hint={`${kpis.totalTasks} en total`}
                tone="violet"
              />
              <SecondaryKpi
                icon={FiShield}
                label="Salud promedio"
                value={`${healthAverage}/100`}
                hint={`${atRisk.length} proyectos en riesgo`}
                tone={healthAverage >= 75 ? "green" : healthAverage >= 50 ? "amber" : "red"}
              />
            </div>

            {/* ---------- Evolución + salud ---------- */}
            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="p-6 xl:col-span-2">
                <CardHeader
                  title="Evolución mensual"
                  subtitle="Tareas creadas frente a completadas en los últimos meses."
                  actions={
                    <Link to="/admin/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Explorar →
                    </Link>
                  }
                />
                <AreaChart
                  data={monthly.map((m) => ({
                    label: m.label,
                    Creadas: m.created,
                    Completadas: m.completed,
                  }))}
                  series={[
                    { key: "Creadas", label: "Creadas", color: "#00A3FE" },
                    { key: "Completadas", label: "Completadas", color: "#0060FC" },
                  ]}
                  height={280}
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Salud del portafolio" subtitle="Semáforo global de los proyectos." />
                <div className="flex flex-col items-center rounded-xl bg-gradient-to-b from-slate-50 to-white py-5">
                  <GaugeChart
                    value={healthAverage / 100}
                    label={healthAverage >= 75 ? "En ritmo" : healthAverage >= 50 ? "En riesgo" : "Crítico"}
                    sublabel={`${projectMetrics.length} proyectos analizados`}
                  />
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Estado de los proyectos
                  </p>
                  <DonutChart
                    data={statusDistribution.map((s) => ({
                      label: s.label,
                      value: s.value,
                      color: statusColor(s.key),
                    }))}
                    size={168}
                    thickness={24}
                    centerLabel="proyectos"
                    showLegend={false}
                  />
                </div>
              </Card>
            </div>

            {/* ---------- Velocidad, estados y equipo ---------- */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader
                  title="Velocidad semanal"
                  subtitle="Tareas completadas por semana."
                />
                <BarsChart
                  data={velocity.map((v) => ({ label: v.label, value: v.completed }))}
                  height={220}
                  color="#0060FC"
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Tareas por estado" subtitle="Distribución del trabajo abierto." />
                <DonutChart
                  data={taskStatusDistribution.map((s) => ({
                    label: s.label,
                    value: s.value,
                  }))}
                  size={168}
                  thickness={24}
                  centerLabel="tareas"
                />
              </Card>

              <Card className="p-6">
                <CardHeader
                  title="Carga del equipo"
                  subtitle="Tareas por persona y estado."
                  actions={
                    <Link to="/admin/users" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Ver equipo →
                    </Link>
                  }
                />
                {team.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">Sin tareas asignadas.</p>
                ) : (
                  <StackedBars
                    data={team.slice(0, 6).map((t) => ({
                      label: t.name,
                      segments: [
                        { key: "completed", label: "Finalizadas", value: t.completed, color: "#10b981" },
                        { key: "in_progress", label: "En progreso", value: t.inProgress, color: "#0060FC" },
                        { key: "pending", label: "Pendientes", value: t.pending, color: "#f59e0b" },
                      ],
                    }))}
                    legend={[
                      { key: "completed", label: "Finalizadas", color: "#10b981" },
                      { key: "in_progress", label: "En progreso", color: "#0060FC" },
                      { key: "pending", label: "Pendientes", color: "#f59e0b" },
                    ]}
                  />
                )}
              </Card>
            </div>

            {/* ---------- Riesgo y vencimientos ---------- */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardHeader
                  title="Proyectos en riesgo"
                  subtitle="Requieren seguimiento cercano."
                  actions={
                    <Link to="/admin/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Ver todos →
                    </Link>
                  }
                />
                {atRisk.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                      <FiCheckCircle className="text-2xl" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-700">Todo bajo control</p>
                    <p className="text-xs text-slate-400">Ningún proyecto fuera de ritmo.</p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {atRisk.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/admin/projects/${p.id}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <span
                            className={cx(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                              p.level === "risk"
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-600"
                            )}
                          >
                            {p.health}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">
                              {p.name}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {p.client} · {p.progress}% de avance
                              {p.overdue > 0 ? ` · ${p.overdue} vencidas` : ""}
                            </span>
                          </span>
                          <Badge tone={riskTone(p.level)}>{p.meta?.label}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-6">
                <CardHeader
                  title="Próximos vencimientos"
                  subtitle={
                    overdueTasks.length
                      ? `${overdueTasks.length} tareas ya están vencidas.`
                      : "Entregas más cercanas."
                  }
                  actions={
                    <Link to="/admin/calendar" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Calendario →
                    </Link>
                  }
                />
                {upcoming.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No hay tareas próximas a vencer.</p>
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
                            <span
                              className={cx(
                                "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold leading-none",
                                late ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                              )}
                            >
                              <span className="text-base tabular-nums">{day.getDate()}</span>
                              <span className="uppercase">
                                {day.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">
                                {t.title}
                              </span>
                              <span className="block truncate text-xs text-slate-400">
                                {t._project?.name || "Tarea"}
                              </span>
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

            {/* ---------- Actividad ---------- */}
            <Card className="p-6">
              <CardHeader
                title="Actividad del equipo"
                subtitle="Tareas cerradas o creadas por día en las últimas semanas."
                actions={
                  <Link to="/admin/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Analítica avanzada →
                  </Link>
                }
              />
              <Heatmap data={activity} weeks={16} color="#0060FC" />
            </Card>

            {/* ---------- Proyectos activos ---------- */}
            {activeProjects.length > 0 && (
              <Card className="overflow-hidden">
                <div className="p-6 pb-4">
                  <CardHeader
                    title="Portafolio activo"
                    subtitle="Accede rápidamente a los tableros en curso."
                    actions={
                      <Link to="/admin/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                        Ver todos →
                      </Link>
                    }
                  />
                </div>
                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {activeProjects.slice(0, 10).map((p) => (
                    <Link
                      key={p.id}
                      to={`/admin/projects/${p.id}`}
                      className="group bg-white p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                        <Badge tone={riskTone(p.level)}>{p.health}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{p.client}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-brand-gradient transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                          />
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                          {p.progress}%
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs text-slate-500">
                        {p.completed}/{p.total || 0} tareas · {formatCurrency(p.budget)}
                      </p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {view === "proyectos" && (
          <ProjectsView
            projectMetrics={projectMetrics}
            statusDistribution={statusDistribution}
            radar={radar}
            funnel={funnel}
            portfolio={portfolio}
            atRisk={atRisk}
            riskTone={riskTone}
          />
        )}

        {view === "equipo" && (
          <TeamView
            team={team}
            aging={aging}
            activity={activity}
            velocity={velocity}
            kpis={kpis}
          />
        )}

        {/* ---------- Accesos rápidos ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/admin/tasks", icon: FiCheckSquare, tone: "bg-brand-50 text-brand-600", title: "Mi trabajo", desc: "Tareas asignadas" },
            { to: "/admin/calendar", icon: FiCalendar, tone: "bg-violet-50 text-violet-600", title: "Calendario", desc: "Vencimientos" },
            { to: "/admin/projects", icon: FiBriefcase, tone: "bg-sky-50 text-sky-600", title: "Proyectos", desc: "Tableros kanban" },
            { to: "/admin/reports", icon: FiBarChart2, tone: "bg-emerald-50 text-emerald-600", title: "Reportes", desc: "Análisis y CSV" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="admin-card admin-card-hover group flex items-center gap-3.5 p-4">
              <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg", l.tone)}>
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
      </div>
    </LayoutAdmin>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-vistas                                                           */
/* ------------------------------------------------------------------ */

const SecondaryKpi = ({ icon: Icon, label, value, hint, tone = "brand" }) => {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-500",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="admin-card flex items-center gap-3.5 px-4 py-3.5">
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
};

const ProjectsView = ({ projectMetrics, statusDistribution, radar, funnel, portfolio, atRisk, riskTone }) => (
  <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6">
        <CardHeader title="Estado del portafolio" subtitle="Proyectos por estado actual." />
        <DonutChart
          data={statusDistribution.map((s) => ({
            label: s.label,
            value: s.value,
            color: statusColor(s.key),
          }))}
          size={180}
          thickness={26}
          centerLabel="proyectos"
        />
      </Card>

      <Card className="p-6">
        <CardHeader title="Embudo de proyectos" subtitle="Del registro a la entrega." />
        <FunnelBars data={funnel} />
      </Card>

      <Card className="p-6">
        <CardHeader title="Salud multidimensional" subtitle="Promedio del portafolio." />
        <RadarChart axes={radar} size={230} color="#0060FC" />
      </Card>
    </div>

    <Card className="overflow-hidden">
      <div className="p-6 pb-4">
        <CardHeader
          title="Métricas por proyecto"
          subtitle="Avance, salud, presupuesto y cumplimiento de fechas."
          actions={
            <Link to="/admin/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Ver analítica →
            </Link>
          }
        />
      </div>
      {projectMetrics.length === 0 ? (
        <EmptyState icon={FiBriefcase} title="Sin proyectos" description="Aún no hay proyectos registrados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="admin-table-head">
                <th className="px-6 py-3.5">Proyecto</th>
                <th className="px-6 py-3.5">Cliente</th>
                <th className="px-6 py-3.5">Avance</th>
                <th className="px-6 py-3.5 text-right">Tareas</th>
                <th className="px-6 py-3.5 text-right">Presupuesto</th>
                <th className="px-6 py-3.5 text-right">Salud</th>
                <th className="px-6 py-3.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectMetrics.map((p) => (
                <tr key={p.id} className="transition hover:bg-slate-50">
                  <td className="px-6 py-3.5">
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="font-medium text-slate-800 hover:text-brand-600"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-slate-500">{p.client}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-brand-gradient"
                          style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                        />
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-slate-600">
                        {p.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                    {p.completed}/{p.total || "—"}
                  </td>
                  <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                    {p.budget ? formatCurrency(p.budget) : "—"}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span
                      className={cx(
                        "font-semibold tabular-nums",
                        p.health >= 75 ? "text-emerald-600" : p.health >= 50 ? "text-amber-500" : "text-red-500"
                      )}
                    >
                      {p.health}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge tone={riskTone(p.level)} dot>
                      {p.meta?.label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {atRisk.length > 0 && (
      <Card className="p-6">
        <CardHeader title="Alertas" subtitle="Proyectos que requieren acción inmediata." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atRisk.slice(0, 6).map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                <Badge tone={riskTone(p.level)}>{p.health}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{p.client}</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                {p.overdue > 0 && <li>• {p.overdue} tareas vencidas</li>}
                {p.onTimeRate !== null && p.onTimeRate < 0.8 && (
                  <li>• {Math.round(p.onTimeRate * 100)}% de entregas a tiempo</li>
                )}
                {p.budget > 0 && p.spent > p.budget * 0.9 && <li>• Presupuesto casi agotado</li>}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    )}

    {portfolio?.rows?.length > 0 && (
      <Card className="p-6">
        <CardHeader
          title="Concentración de cartera"
          subtitle={`${portfolio.topShare}% de la cartera está en el cliente principal (HHI ${portfolio.hhi || "—"}).`}
        />
        <StackedBars
          data={portfolio.rows.slice(0, 6).map((r) => ({
            label: r.name,
            segments: [{ key: "budget", label: "Presupuesto", value: r.budget, color: "#0060FC" }],
          }))}
        />
      </Card>
    )}
  </div>
);

const FunnelBars = ({ data = [] }) => {
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = Math.round(((d.value || 0) / max) * 100);
        const colors = ["#0060FC", "#00A3FE", "#8b5cf6", "#10b981"];
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-slate-600">{d.label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{d.value}</span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-lg bg-slate-50">
              <div
                className="flex h-full items-center justify-end rounded-lg pr-2 text-[11px] font-semibold text-white transition-all duration-700"
                style={{
                  width: `${Math.max(pct, 8)}%`,
                  background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${
                    colors[(i + 1) % colors.length]
                  })`,
                }}
              >
                {pct}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TeamView = ({ team, aging, activity, velocity, kpis }) => (
  <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <CardHeader
          title="Productividad por persona"
          subtitle="Entregas a tiempo frente a entregas tardías."
          actions={
            <Link to="/admin/users" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Ver equipo →
            </Link>
          }
        />
        {team.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aún no hay datos de usuarios.</p>
        ) : (
          <div className="space-y-4">
            {team.slice(0, 8).map((t) => {
              const prod = t.productivity ?? t.onTimeRate ?? 0;
              const pctValue = Math.round((prod <= 1 ? prod * 100 : prod) || 0);
              return (
                <div key={t.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar user={t} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.total} tareas · {t.completed} finalizadas
                        {t.overdue > 0 ? ` · ${t.overdue} vencidas` : ""}
                      </p>
                    </div>
                    <Badge tone={pctValue >= 80 ? "green" : pctValue >= 50 ? "amber" : "red"}>
                      {pctValue}%
                    </Badge>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${((t.onTime || 0) / Math.max(t.total || 1, 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{
                        width: `${((t.late || 0) / Math.max(t.total || 1, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader title="Antigüedad de tareas" subtitle="Días que llevan abiertas." />
          <DonutChart
            data={aging.map((a, i) => ({
              label: a.label,
              value: a.value,
              color: ["#10b981", "#00A3FE", "#f59e0b", "#f97316", "#f43f5e"][i % 5],
            }))}
            size={168}
            thickness={24}
            centerLabel="abiertas"
          />
        </Card>

        <Card className="p-6">
          <CardHeader title="Velocidad reciente" subtitle="Tareas cerradas por semana." />
          <BarsChart
            data={velocity.map((v) => ({ label: v.label, value: v.completed }))}
            height={180}
            color="#10b981"
          />
        </Card>
      </div>
    </div>

    <Card className="p-6">
      <CardHeader
        title="Mapa de actividad"
        subtitle="Cierres y creaciones de tareas por día."
        actions={
          <span className="text-xs text-slate-400">
            {kpis.teamSize} personas · {formatNumber(kpis.totalTasks)} tareas
          </span>
        }
      />
      <Heatmap data={activity} weeks={18} color="#8b5cf6" />
    </Card>
  </div>
);

/* ------------------------------------------------------------------ */
/* Esqueleto de carga                                                   */
/* ------------------------------------------------------------------ */

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