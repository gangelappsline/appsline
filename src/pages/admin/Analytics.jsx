/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiActivity, FiAlertTriangle, FiBriefcase, FiCalendar,
  FiDownload, FiPieChart, FiRefreshCw, FiTrendingUp, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import useAnalytics from "../../hooks/useAnalytics";
import useUrlTab from "../../hooks/useUrlTab";
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState, StatCard, Tabs,
} from "../../components/admin";
import {
  AreaChart, BubbleChart, BarsChart, DonutChart, Heatmap, RadarChart,
  StackedBars, TrendBadge,
} from "../../components/admin/DataViz";
import { cx, formatCurrency, formatNumber } from "../../utils/format";

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

const VIEW_TABS = [
  { key: "portafolio", label: "Portafolio", icon: FiBriefcase },
  { key: "clientes", label: "Clientes", icon: FiPieChart },
  { key: "equipo", label: "Equipo", icon: FiUsers },
  { key: "avanzado", label: "Avanzado", icon: FiActivity },
];

const METRICS = [
  { key: "created", label: "Tareas creadas", color: "#00A3FE", api: "created_tasks" },
  { key: "completed", label: "Tareas completadas", color: "#0060FC", api: "completed_tasks" },
  { key: "due", label: "Vencimientos", color: "#f59e0b", api: "due_tasks" },
];

const HEALTH_COLOR = { good: "#10b981", watch: "#f59e0b", risk: "#f43f5e" };

/** Colores por estado de proyecto (mismos tonos que el resto del panel). */
const STATUS_COLOR = {
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

const statusColor = (status) =>
  STATUS_COLOR[String(status || "active").toLowerCase()] || "#64748b";

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const Analytics = () => {
  const [view, setView] = useUrlTab(
    VIEW_TABS.map((t) => t.key),
    "portafolio"
  );
  const [metric, setMetric] = useState("completed");
  const [metricMode, setMetricMode] = useState("absolute");

  const {
    loading, error, reload,
    kpis, deltas,
    statusDistribution, taskStatusDistribution, priorityDistribution,
    monthly, velocity, activity, aging,
    team, portfolio, projectMetrics, atRisk, radar, funnel,
    timeseries, loadTimeseries,
  } = useAnalytics({ period: 30 });

  const metricDef = METRICS.find((m) => m.key === metric) || METRICS[1];

  /* Pide la serie al backend cuando cambia la métrica (si existe, la usa). */
  useEffect(() => {
    loadTimeseries(metricDef.api, "month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  /* Serie explorable: absoluta o acumulada. */
  const explorerData = useMemo(() => {
    const serverRows =
      timeseries?.series?.length && metricMode === "absolute"
        ? timeseries.series.map((row) => ({
            label: row.label || String(row.date || "").slice(0, 7),
            value: Number(row.value ?? 0),
          }))
        : null;

    if (serverRows) return serverRows;

    let running = 0;
    return monthly.map((m) => {
      const value = Number(m[metric] || 0);
      running += value;
      return {
        label: m.label,
        value: metricMode === "cumulative" ? running : value,
      };
    });
  }, [monthly, metric, metricMode, timeseries]);

  const explorerStats = useMemo(() => {
    const values = explorerData.map((d) => d.value);
    if (!values.length) return { total: 0, avg: 0, peak: 0, peakLabel: "—" };
    const total = values.reduce((a, b) => a + b, 0);
    const peakIdx = values.indexOf(Math.max(...values));
    return {
      total,
      avg: Math.round((total / values.length) * 10) / 10,
      peak: values[peakIdx],
      peakLabel: explorerData[peakIdx]?.label || "—",
    };
  }, [explorerData]);

  /* Burbujas: presupuesto vs avance (tamaño = número de tareas). */
  const bubbles = useMemo(
    () =>
      projectMetrics
        .filter((p) => p.budget > 0 || p.progress > 0)
        .map((p) => ({
          x: p.budget,
          y: p.progress,
          r: p.total || 1,
          label: p.name,
          color: HEALTH_COLOR[p.level] || "#0060FC",
          meta: `${p.client} · ${p.completed}/${p.total} tareas`,
        })),
    [projectMetrics]
  );

  /* Concentración acumulada de clientes (curva de Pareto). */
  const pareto = useMemo(() => {
    const rows = portfolio?.rows || [];
    const total = rows.reduce((s, r) => s + r.budget, 0) || 1;
    let acc = 0;
    return rows.map((r) => {
      acc += r.budget;
      return {
        label: r.name,
        value: Math.round((acc / total) * 100),
        share: r.share,
      };
    });
  }, [portfolio]);

  const teamRanking = useMemo(
    () =>
      [...team]
        .map((t) => ({
          ...t,
          score: t.productivity ?? t.onTimeRate ?? 0,
        }))
        .sort((a, b) => (b.score || 0) - (a.score || 0)),
    [team]
  );

  if (loading && !projectMetrics.length) {
    return (
      <LayoutAdmin title="Analítica" subtitle="Análisis profundo del portafolio">
        <div className="space-y-6" aria-label="Cargando analítica">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="admin-card h-32 animate-pulse" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="admin-card h-80 animate-pulse" />
            <div className="admin-card h-80 animate-pulse" />
          </div>
        </div>
      </LayoutAdmin>
    );
  }

  if (error && !projectMetrics.length) {
    return (
      <LayoutAdmin title="Analítica" subtitle="Análisis profundo del portafolio">
        <Card>
          <EmptyState
            icon={FiAlertTriangle}
            title="No se pudo cargar la analítica"
            description="Verifica tu conexión o vuelve a intentarlo más tarde."
            action={<Button variant="secondary" onClick={reload}>Reintentar</Button>}
          />
        </Card>
      </LayoutAdmin>
    );
  }

  return (
    <LayoutAdmin
      title="Analítica"
      subtitle="Profundiza en el portafolio, los clientes y el equipo"
      actions={
        <>
          <Button variant="secondary" onClick={reload}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Link to="/admin/reports" className="btn-secondary">
            <FiDownload /> <span className="hidden sm:inline">Reportes</span>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {/* ---------- KPIs ---------- */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Proyectos en curso"
            value={kpis.activeProjects}
            icon={FiBriefcase}
            tone="brand"
            trend={deltas.totalProjects}
            hint={`${kpis.totalProjects} registrados`}
          />
          <StatCard
            label="Tasa de finalización"
            value={`${Math.round((kpis.completionRate || 0) * 100)}%`}
            icon={FiTrendingUp}
            tone="green"
            progress={(kpis.completionRate || 0) * 100}
            hint={`${kpis.completedTasks} de ${kpis.totalTasks}`}
          />
          <StatCard
            label="Ciclo promedio"
            value={`${kpis.avgCycleDays || 0} días`}
            icon={FiCalendar}
            tone="sky"
            hint="De creación a cierre"
          />
          <StatCard
            label="Tareas vencidas"
            value={kpis.overdueTasks}
            icon={FiAlertTriangle}
            tone={kpis.overdueTasks ? "red" : "green"}
            trend={deltas.overdueTasks}
            invert
            hint="Fuera de la fecha límite"
          />
        </div>

        {/* ---------- Navegación ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <Tabs tabs={VIEW_TABS} active={view} onChange={setView} variant="pill" />
          <span className="text-xs text-slate-500">
            Actualizado con {projectMetrics.length} proyectos y {kpis.totalTasks} tareas
          </span>
        </div>

        {/* ---------- Explorador de series ---------- */}
        {view !== "avanzado" && (
          <Card className="p-6">
            <CardHeader
              title="Explorador de series"
              subtitle="Evolución mensual de la métrica seleccionada."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                    {METRICS.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMetric(m.key)}
                        className={cx(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                          metric === m.key
                            ? "bg-white text-slate-900 shadow-card"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setMetricMode("absolute")}
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        metricMode === "absolute"
                          ? "bg-white text-slate-900 shadow-card"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Mensual
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricMode("cumulative")}
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        metricMode === "cumulative"
                          ? "bg-white text-slate-900 shadow-card"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Acumulado
                    </button>
                  </div>
                </div>
              }
            />
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <AreaChart
                  data={explorerData}
                  series={[{ key: "value", label: metricDef.label, color: metricDef.color }]}
                  height={260}
                  showValues
                />
              </div>
              <div className="space-y-3">
                <MiniMetric label="Total del periodo" value={formatNumber(explorerStats.total)} />
                <MiniMetric label="Promedio mensual" value={formatNumber(explorerStats.avg)} />
                <MiniMetric label="Pico" value={`${formatNumber(explorerStats.peak)} · ${explorerStats.peakLabel}`} />
                <MiniMetric
                  label="Tasa de cumplimiento"
                  value={`${Math.round((kpis.onTimeRate || 0) * 100)}%`}
                  hint="Entregas a tiempo"
                />
              </div>
            </div>
          </Card>
        )}

        {/* ---------- Portafolio ---------- */}
        {view === "portafolio" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardHeader
                  title="Presupuesto vs. avance"
                  subtitle="Cada burbuja es un proyecto; el tamaño indica las tareas."
                />
                <BubbleChart
                  points={bubbles}
                  height={320}
                  xLabel="Presupuesto (MXN)"
                  yLabel="Avance (%)"
                  xFormatter={(v) => `$${formatNumber(v)}`}
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Salud multidimensional" subtitle="Promedio del portafolio." />
                <RadarChart axes={radar} size={260} color="#0060FC" />
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader title="Estado de proyectos" subtitle="Distribución actual." />
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
                <CardHeader title="Distribución de tareas" subtitle="Por estado actual." />
                <DonutChart
                  data={taskStatusDistribution.map((s) => ({ label: s.label, value: s.value }))}
                  size={180}
                  thickness={26}
                  centerLabel="tareas"
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Prioridades" subtitle="Peso de cada prioridad." />
                <DonutChart
                  data={priorityDistribution.map((s) => ({ label: s.label, value: s.value }))}
                  size={180}
                  thickness={26}
                  centerLabel="tareas"
                />
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="p-6 pb-4">
                <CardHeader
                  title="Tablero de proyectos"
                  subtitle="Salud, avance y presupuesto de cada proyecto."
                />
              </div>
              {projectMetrics.length === 0 ? (
                <EmptyState icon={FiBriefcase} title="Sin proyectos" description="No hay datos para analizar." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="admin-table-head">
                        <th className="px-6 py-3.5">Proyecto</th>
                        <th className="px-6 py-3.5">Cliente</th>
                        <th className="px-6 py-3.5">Avance</th>
                        <th className="px-6 py-3.5 text-right">Presupuesto</th>
                        <th className="px-6 py-3.5 text-right">Consumido</th>
                        <th className="px-6 py-3.5 text-right">A tiempo</th>
                        <th className="px-6 py-3.5">Salud</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectMetrics.map((p) => {
                        const consumption =
                          p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : null;
                        return (
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
                                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, p.progress))}%`,
                                      background: HEALTH_COLOR[p.level] || "#0060FC",
                                    }}
                                  />
                                </span>
                                <span className="text-xs font-semibold tabular-nums text-slate-600">
                                  {p.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.budget ? formatCurrency(p.budget) : "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.spent ? formatCurrency(p.spent) : "—"}
                              {consumption !== null && (
                                <span className="ml-1 text-xs text-slate-400">({consumption}%)</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.onTimeRate === null ? "—" : `${Math.round(p.onTimeRate * 100)}%`}
                            </td>
                            <td className="px-6 py-3.5">
                              <Badge tone={p.level === "good" ? "green" : p.level === "watch" ? "amber" : "red"}>
                                {p.health} · {p.meta?.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ---------- Clientes ---------- */}
        {view === "clientes" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <CardHeader
                  title="Concentración de cartera"
                  subtitle="Porcentaje acumulado del presupuesto por cliente (curva de Pareto)."
                  actions={
                    <span className="text-xs text-slate-400">
                      Índice HHI: {portfolio?.hhi || "—"}
                    </span>
                  }
                />
                {pareto.length ? (
                  <AreaChart
                    data={pareto.map((p) => ({ label: p.label, Acumulado: p.value }))}
                    series={[{ key: "Acumulado", label: "% acumulado", color: "#0060FC" }]}
                    height={260}
                    yFormatter={(v) => `${Math.round(v)}%`}
                    showValues
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">Sin clientes con presupuesto.</p>
                )}
              </Card>

              <Card className="p-6">
                <CardHeader title="Peso por cliente" subtitle="Participación en la cartera." />
                <DonutChart
                  data={(portfolio?.rows || []).map((r) => ({
                    label: r.name,
                    value: r.budget,
                  }))}
                  size={190}
                  thickness={28}
                  centerLabel="presupuesto"
                  formatter={(v) => formatCurrency(v)}
                />
              </Card>
            </div>

            <Card className="p-6">
              <CardHeader title="Detalle por cliente" subtitle="Proyectos, presupuesto y avance promedio." />
              {(portfolio?.rows || []).length === 0 ? (
                <EmptyState icon={FiBriefcase} title="Sin clientes" description="Aún no hay cartera registrada." />
              ) : (
                <StackedBars
                  data={portfolio.rows.map((r) => ({
                    label: r.name,
                    segments: [
                      {
                        key: "budget",
                        label: "Presupuesto",
                        value: r.budget,
                        color: "#0060FC",
                      },
                    ],
                  }))}
                  formatter={(v) => formatCurrency(v)}
                />
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="p-6 pb-4">
                <CardHeader title="Tabla de clientes" subtitle="Participación y concentración." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="admin-table-head">
                      <th className="px-6 py-3.5">Cliente</th>
                      <th className="px-6 py-3.5 text-right">Proyectos</th>
                      <th className="px-6 py-3.5 text-right">Activos</th>
                      <th className="px-6 py-3.5 text-right">Presupuesto</th>
                      <th className="px-6 py-3.5 text-right">Participación</th>
                      <th className="px-6 py-3.5 text-right">Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {portfolio.rows.map((r) => (
                      <tr key={r.key} className="transition hover:bg-slate-50">
                        <td className="px-6 py-3.5 font-medium text-slate-800">{r.name}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{r.projects}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{r.active}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(r.budget)}
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                          {Math.round(r.share)}%
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                          {r.progress}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ---------- Equipo ---------- */}
        {view === "equipo" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <CardHeader
                  title="Ranking de productividad"
                  subtitle="Porcentaje de entregas a tiempo por persona."
                />
                {teamRanking.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">Sin datos de usuarios.</p>
                ) : (
                  <div className="space-y-3">
                    {teamRanking.slice(0, 8).map((t, i) => {
                      const score = Math.round((t.score <= 1 ? t.score * 100 : t.score) || 0);
                      return (
                        <div key={t.id} className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-slate-300">
                            {i + 1}
                          </span>
                          <Avatar user={t} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                              <span className="text-sm font-bold tabular-nums text-slate-800">{score}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cx(
                                  "h-full rounded-full transition-all duration-500",
                                  score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500"
                                )}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <CardHeader title="Antigüedad de tareas" subtitle="Días que llevan abiertas." />
                <DonutChart
                  data={aging.map((a, i) => ({
                    label: a.label,
                    value: a.value,
                    color: ["#10b981", "#00A3FE", "#f59e0b", "#f97316", "#f43f5e"][i % 5],
                  }))}
                  size={180}
                  thickness={26}
                  centerLabel="abiertas"
                />
              </Card>
            </div>

            <Card className="p-6">
              <CardHeader
                title="Carga de trabajo comparada"
                subtitle="Tareas asignadas por persona."
              />
              <BarsChart
                data={teamRanking.map((t) => ({ label: t.name, value: t.total }))}
                height={240}
                color="#8b5cf6"
              />
            </Card>

            <Card className="overflow-hidden">
              <div className="p-6 pb-4">
                <CardHeader title="Detalle por persona" subtitle="Carga, entregas y puntualidad." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="admin-table-head">
                      <th className="px-6 py-3.5">Persona</th>
                      <th className="px-6 py-3.5 text-right">Asignadas</th>
                      <th className="px-6 py-3.5 text-right">Finalizadas</th>
                      <th className="px-6 py-3.5 text-right">Vencidas</th>
                      <th className="px-6 py-3.5 text-right">Ciclo (d)</th>
                      <th className="px-6 py-3.5 text-right">Puntualidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamRanking.map((t) => {
                      const score = Math.round((t.score <= 1 ? t.score * 100 : t.score) || 0);
                      return (
                        <tr key={t.id} className="transition hover:bg-slate-50">
                          <td className="px-6 py-3.5">
                            <span className="flex items-center gap-2.5">
                              <Avatar user={t} size="xs" />
                              <span className="font-medium text-slate-800">{t.name}</span>
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{t.total}</td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-emerald-600">
                            {t.completed}
                          </td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-red-500">{t.overdue}</td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                            {t.avgCycle ?? "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <Badge tone={score >= 80 ? "green" : score >= 50 ? "amber" : "red"}>
                              {score}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ---------- Avanzado ---------- */}
        {view === "avanzado" && (
          <div className="space-y-6">
            <Card className="p-6">
              <CardHeader
                title="Mapa de actividad"
                subtitle="Tareas cerradas o creadas por día (16 semanas)."
              />
              <Heatmap data={activity} weeks={16} color="#0060FC" />
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardHeader title="Velocidad semanal" subtitle="Tareas completadas por semana." />
                <BarsChart
                  data={velocity.map((v) => ({ label: v.label, value: v.completed }))}
                  height={240}
                  color="#10b981"
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Embudo de proyectos" subtitle="Del registro a la entrega." />
                <StackedBars
                  data={funnel.map((f, i) => ({
                    label: f.label,
                    segments: [
                      {
                        key: f.label,
                        label: f.label,
                        value: f.value,
                        color: ["#0060FC", "#00A3FE", "#8b5cf6", "#10b981"][i % 4],
                      },
                    ],
                  }))}
                />
              </Card>
            </div>

            {atRisk.length > 0 && (
              <Card className="p-6">
                <CardHeader
                  title="Alertas de riesgo"
                  subtitle="Proyectos fuera de ritmo o con tareas vencidas."
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {atRisk.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                        <Badge tone={p.level === "risk" ? "red" : "amber"}>{p.health}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{p.client}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>Avance {p.progress}%</span>
                        <TrendBadge value={p.onTimeRate === null ? 0 : p.onTimeRate * 100} suffix="% puntual" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
};

const MiniMetric = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900">{value}</p>
    {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
  </div>
);

export default Analytics;