/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle, FiBarChart2, FiBriefcase, FiCheckCircle, FiClock,
  FiDownload, FiFileText, FiLayers, FiRefreshCw, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import useAnalytics from "../../hooks/useAnalytics";
import useUrlTab from "../../hooks/useUrlTab";
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState, StatCard, Tabs, useToast,
} from "../../components/admin";
import {
  AreaChart, BarsChart, DonutChart, RadarChart, StackedBars,
} from "../../components/admin/DataViz";
import { downloadCsv, downloadJson, formatCurrency, formatNumber } from "../../utils/format";

const REPORT_TABS = [
  { key: "resumen", label: "Resumen ejecutivo", icon: FiBarChart2 },
  { key: "proyectos", label: "Proyectos", icon: FiBriefcase },
  { key: "equipo", label: "Equipo", icon: FiUsers },
  { key: "financiero", label: "Financiero", icon: FiLayers },
];

/* ------------------------------------------------------------------ */

const Reports = () => {
  const { notify } = useToast();
  const [tab, setTab] = useUrlTab(
    REPORT_TABS.map((t) => t.key),
    "resumen"
  );
  const [exporting, setExporting] = useState(false);

  const {
    loading, error, reload,
    kpis, deltas,
    statusDistribution, taskStatusDistribution,
    monthly, velocity, aging,
    team, portfolio, projectMetrics, radar, funnel,
    financial,
  } = useAnalytics({ period: 30 });

  const completionRate = Math.round((kpis.completionRate || 0) * 100);
  const onTimeRate = Math.round((kpis.onTimeRate || 0) * 100);

  const rankedUsers = useMemo(
    () =>
      [...team]
        .map((u) => ({
          ...u,
          score: Math.round(
            (u.productivity ?? u.onTimeRate ?? 0) <= 1
              ? (u.productivity ?? u.onTimeRate ?? 0) * 100
              : u.productivity ?? u.onTimeRate ?? 0
          ),
        }))
        .sort((a, b) => b.score - a.score),
    [team]
  );

  const stamp = () => new Date().toISOString().slice(0, 10);

  /* ---------------- Exportaciones ---------------- */

  const exportUsersCsv = () => {
    downloadCsv(`productividad-usuarios-${stamp()}.csv`, [
      ["Usuario", "Tareas totales", "Finalizadas", "A tiempo", "Tarde", "Vencidas", "Ciclo (días)", "Puntualidad %"],
      ...rankedUsers.map((u) => [
        u.name,
        u.total,
        u.completed,
        u.on_time || 0,
        u.late || 0,
        u.overdue || 0,
        u.avgCycle ?? "",
        u.score,
      ]),
    ]);
    notify("Archivo CSV descargado");
  };

  const exportProjectsCsv = () => {
    downloadCsv(`proyectos-${stamp()}.csv`, [
      ["Proyecto", "Cliente", "Estado", "Avance %", "Tareas", "Finalizadas", "Vencidas", "Presupuesto (MXN)", "Consumido (MXN)", "A tiempo %", "Salud"],
      ...projectMetrics.map((p) => [
        p.name,
        p.client,
        p.status || "",
        p.progress,
        p.total,
        p.completed,
        p.overdue,
        p.budget,
        p.spent,
        p.onTimeRate === null ? "" : Math.round(p.onTimeRate * 100),
        p.health,
      ]),
    ]);
    notify("Archivo CSV descargado");
  };

  const exportClientsCsv = () => {
    downloadCsv(`clientes-${stamp()}.csv`, [
      ["Cliente", "Proyectos", "Activos", "Presupuesto (MXN)", "Participación %", "Avance %"],
      ...(portfolio?.rows || []).map((r) => [
        r.name,
        r.projects,
        r.active,
        r.budget,
        Math.round(r.share),
        r.progress,
      ]),
    ]);
    notify("Archivo CSV descargado");
  };

  const exportMonthlyCsv = () => {
    downloadCsv(`evolucion-mensual-${stamp()}.csv`, [
      ["Mes", "Creadas", "Completadas", "Vencimientos"],
      ...monthly.map((m) => [m.label, m.created, m.completed, m.due]),
    ]);
    notify("Archivo CSV descargado");
  };

  const exportJson = () => {
    downloadJson(`reporte-appsline-${stamp()}.json`, {
      generado_en: new Date().toISOString(),
      periodo: { dias: 30 },
      kpis,
      deltas,
      distribucion_proyectos: statusDistribution,
      distribucion_tareas: taskStatusDistribution,
      evolucion_mensual: monthly,
      velocidad_semanal: velocity,
      antiguedad_tareas: aging,
      equipo: rankedUsers,
      clientes: portfolio?.rows || [],
      proyectos: projectMetrics,
      salud_portafolio: radar,
      embudo: funnel,
    });
    notify("Reporte JSON descargado");
  };

  const exportAllCsv = () => {
    exportProjectsCsv();
    exportUsersCsv();
    exportClientsCsv();
  };

  const runExport = (fn) => {
    setExporting(true);
    try {
      fn();
    } finally {
      setTimeout(() => setExporting(false), 400);
    }
  };

  /* ---------------- Estados de carga/error ---------------- */

  if (loading && !projectMetrics.length) {
    return (
      <LayoutAdmin title="Reportes" subtitle="Análisis de rendimiento, cumplimiento y cartera">
        <div className="space-y-6" aria-label="Cargando reportes">
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

  if (error && !projectMetrics.length && !kpis.totalTasks) {
    return (
      <LayoutAdmin title="Reportes" subtitle="Análisis de rendimiento, cumplimiento y cartera">
        <Card>
          <EmptyState
            icon={FiAlertTriangle}
            title="No se pudieron cargar los reportes"
            description="Verifica tu conexión o vuelve a intentarlo más tarde."
            action={<Button variant="secondary" onClick={reload}>Reintentar</Button>}
          />
        </Card>
      </LayoutAdmin>
    );
  }

  /* ---------------- Render ---------------- */

  return (
    <LayoutAdmin
      title="Reportes"
      subtitle="Centro de reportes del portafolio, el equipo y las finanzas"
      actions={
        <>
          <Button variant="secondary" onClick={reload}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="secondary" onClick={() => runExport(exportJson)} disabled={exporting}>
            <FiFileText /> JSON
          </Button>
          <Button onClick={() => runExport(exportAllCsv)} disabled={exporting}>
            <FiDownload /> Exportar CSV
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ---------- Pestañas ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <Tabs tabs={REPORT_TABS} active={tab} onChange={setTab} variant="pill" />
          <span className="text-xs text-slate-500">
            {kpis.totalProjects} proyectos · {kpis.totalTasks} tareas · {kpis.activeClients} clientes
          </span>
        </div>

        {/* ---------- KPIs ---------- */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tasa de finalización"
            value={`${completionRate}%`}
            icon={FiCheckCircle}
            tone="green"
            progress={completionRate}
            trend={deltas.completedTasks}
            hint={`${kpis.completedTasks} de ${kpis.totalTasks} tareas`}
          />
          <StatCard
            label="Entrega a tiempo"
            value={`${onTimeRate}%`}
            icon={FiClock}
            tone="brand"
            progress={onTimeRate}
            trend={deltas.onTimeRate}
            hint="Cumplimiento de fechas"
          />
          <StatCard
            label="Valor del portafolio"
            value={formatCurrency(kpis.totalBudget)}
            icon={FiBriefcase}
            tone="violet"
            trend={deltas.totalBudget}
            hint={`${kpis.activeProjects} proyectos en curso`}
          />
          <StatCard
            label="Ciclo promedio"
            value={`${kpis.avgCycleDays || 0} días`}
            icon={FiLayers}
            tone="sky"
            hint="De creación a cierre"
          />
        </div>

        {/* ---------- Resumen ejecutivo ---------- */}
        {tab === "resumen" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardHeader
                  title="Evolución mensual"
                  subtitle="Tareas creadas y completadas."
                  actions={
                    <Button variant="subtle" onClick={() => runExport(exportMonthlyCsv)}>
                      <FiDownload /> CSV
                    </Button>
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
                  height={260}
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Tareas por estado" subtitle="Distribución del trabajo." />
                <DonutChart
                  data={taskStatusDistribution.map((s) => ({ label: s.label, value: s.value }))}
                  size={200}
                  thickness={28}
                  centerLabel="tareas"
                />
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader title="Velocidad semanal" subtitle="Cierres por semana." />
                <BarsChart
                  data={velocity.map((v) => ({ label: v.label, value: v.completed }))}
                  height={220}
                  color="#10b981"
                />
              </Card>

              <Card className="p-6">
                <CardHeader title="Salud del portafolio" subtitle="Promedio multidimensional." />
                <RadarChart axes={radar} size={230} color="#8b5cf6" />
              </Card>

              <Card className="p-6">
                <CardHeader title="Antigüedad de tareas" subtitle="Días abiertas." />
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
                title="Resumen del portafolio"
                subtitle="Métricas clave por proyecto."
                actions={
                  <Button variant="secondary" onClick={() => runExport(exportProjectsCsv)}>
                    <FiDownload /> Exportar CSV
                  </Button>
                }
              />
              {projectMetrics.length === 0 ? (
                <EmptyState icon={FiBriefcase} title="Sin proyectos" description="No hay datos para reportar." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="admin-table-head">
                        <th className="px-6 py-3.5">Proyecto</th>
                        <th className="px-6 py-3.5">Cliente</th>
                        <th className="px-6 py-3.5 text-right">Avance</th>
                        <th className="px-6 py-3.5 text-right">Presupuesto</th>
                        <th className="px-6 py-3.5 text-right">A tiempo</th>
                        <th className="px-6 py-3.5">Salud</th>
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
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                            {p.progress}%
                          </td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                            {p.budget ? formatCurrency(p.budget) : "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                            {p.onTimeRate === null ? "—" : `${Math.round(p.onTimeRate * 100)}%`}
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge
                              tone={p.level === "good" ? "green" : p.level === "watch" ? "amber" : "red"}
                            >
                              {p.health}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ---------- Proyectos ---------- */}
        {tab === "proyectos" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader title="Estado de proyectos" subtitle="Distribución actual." />
                <DonutChart
                  data={statusDistribution.map((s) => ({ label: s.label, value: s.value }))}
                  size={180}
                  thickness={26}
                  centerLabel="proyectos"
                />
              </Card>

              <Card className="p-6 lg:col-span-2">
                <CardHeader
                  title="Detalle de proyectos"
                  subtitle="Avance, presupuesto, cumplimiento y salud."
                  actions={
                    <Button variant="secondary" onClick={() => runExport(exportProjectsCsv)}>
                      <FiDownload /> Exportar CSV
                    </Button>
                  }
                />
                {projectMetrics.length === 0 ? (
                  <EmptyState icon={FiBriefcase} title="Sin proyectos" description="No hay datos para reportar." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead>
                        <tr className="admin-table-head">
                          <th className="px-6 py-3.5">Proyecto</th>
                          <th className="px-6 py-3.5">Cliente</th>
                          <th className="px-6 py-3.5 text-right">Tareas</th>
                          <th className="px-6 py-3.5 text-right">Presupuesto</th>
                          <th className="px-6 py-3.5 text-right">Consumido</th>
                          <th className="px-6 py-3.5 text-right">A tiempo</th>
                          <th className="px-6 py-3.5">Salud</th>
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
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.completed}/{p.total || "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.budget ? formatCurrency(p.budget) : "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.spent ? formatCurrency(p.spent) : "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {p.onTimeRate === null ? "—" : `${Math.round(p.onTimeRate * 100)}%`}
                            </td>
                            <td className="px-6 py-3.5">
                              <Badge
                                tone={p.level === "good" ? "green" : p.level === "watch" ? "amber" : "red"}
                              >
                                {p.health} · {p.meta?.label}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ---------- Equipo ---------- */}
        {tab === "equipo" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <CardHeader
                  title="Detalle por usuario"
                  subtitle="Tareas asignadas, a tiempo y tardías."
                  actions={
                    <Button variant="secondary" onClick={() => runExport(exportUsersCsv)}>
                      <FiDownload /> Exportar CSV
                    </Button>
                  }
                />
                {rankedUsers.length === 0 ? (
                  <EmptyState icon={FiUsers} title="Sin datos" description="Aún no hay actividad registrada por usuario." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="admin-table-head">
                          <th className="px-6 py-3.5">Usuario</th>
                          <th className="px-6 py-3.5 text-right">Total</th>
                          <th className="px-6 py-3.5 text-right">Finalizadas</th>
                          <th className="px-6 py-3.5 text-right">Vencidas</th>
                          <th className="px-6 py-3.5 text-right">Ciclo (d)</th>
                          <th className="px-6 py-3.5 text-right">Productividad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rankedUsers.map((u) => (
                          <tr key={u.id} className="transition hover:bg-slate-50">
                            <td className="px-6 py-3.5">
                              <span className="flex items-center gap-2.5">
                                <Avatar user={u} size="xs" />
                                <span className="font-medium text-slate-800">{u.name}</span>
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{u.total}</td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-emerald-600">
                              {u.completed}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-red-500">{u.overdue}</td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">
                              {u.avgCycle ?? "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <Badge tone={u.score >= 80 ? "green" : u.score >= 50 ? "amber" : "red"}>
                                {u.score}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <CardHeader title="Carga de trabajo" subtitle="Tareas por persona." />
                <BarsChart
                  data={rankedUsers.map((u) => ({ label: u.name, value: u.total }))}
                  height={240}
                  color="#8b5cf6"
                />
              </Card>
            </div>
          </div>
        )}

        {/* ---------- Financiero ---------- */}
        {tab === "financiero" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader title="Presupuesto por cliente" subtitle="Reparto de la cartera." />
                <DonutChart
                  data={(portfolio?.rows || []).map((r) => ({ label: r.name, value: r.budget }))}
                  size={190}
                  thickness={28}
                  centerLabel="presupuesto"
                  formatter={(v) => formatCurrency(v)}
                />
              </Card>

              <Card className="p-6 lg:col-span-2">
                <CardHeader
                  title="Cartera por cliente"
                  subtitle="Presupuesto asignado a cada cliente."
                  actions={
                    <Button variant="secondary" onClick={() => runExport(exportClientsCsv)}>
                      <FiDownload /> Exportar CSV
                    </Button>
                  }
                />
                {(portfolio?.rows || []).length === 0 ? (
                  <EmptyState icon={FiBriefcase} title="Sin datos" description="No hay presupuestos registrados." />
                ) : (
                  <StackedBars
                    data={portfolio.rows.map((r) => ({
                      label: r.name,
                      segments: [
                        { key: "budget", label: "Presupuesto", value: r.budget, color: "#0060FC" },
                      ],
                    }))}
                    formatter={(v) => formatCurrency(v)}
                  />
                )}
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="p-6 pb-4">
                <CardHeader title="Resumen financiero" subtitle="Valores del portafolio." />
              </div>
              <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                <FinanceTile label="Presupuesto total" value={formatCurrency(kpis.totalBudget)} />
                <FinanceTile
                  label="Consumido"
                  value={formatCurrency(kpis.spent)}
                  hint={
                    kpis.totalBudget > 0
                      ? `${Math.round((kpis.spent / kpis.totalBudget) * 100)}% del presupuesto`
                      : null
                  }
                />
                <FinanceTile
                  label="Margen estimado"
                  value={`${kpis.margin}%`}
                  hint="Presupuesto menos consumo"
                />
                <FinanceTile
                  label="Por proyecto"
                  value={
                    kpis.totalProjects > 0
                      ? formatCurrency(kpis.totalBudget / kpis.totalProjects)
                      : "—"
                  }
                  hint="Promedio por proyecto"
                />
              </div>
            </Card>

            {/* ---------- Facturación (endpoint opcional /analytics/financial) ---------- */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6">
                <CardHeader title="Flujo de facturación" subtitle="Facturado, cobrado y pendiente." />
                {financial ? (
                  <>
                    <DonutChart
                      data={[
                        { label: "Cobrado", value: Number(financial.collected_amount || 0), color: "#10b981" },
                        { label: "Pendiente", value: Number(financial.pending_amount || 0), color: "#f59e0b" },
                        { label: "No facturado", value: Math.max(0, Number(financial.billed_amount || 0) - Number(financial.collected_amount || 0)), color: "#00A3FE" },
                      ]}
                      size={190}
                      thickness={28}
                      centerLabel="facturado"
                      formatter={(v) => formatCurrency(v)}
                    />
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                      <FinanceMini label="Facturado" value={formatCurrency(financial.billed_amount)} />
                      <FinanceMini label="Cobrado" value={formatCurrency(financial.collected_amount)} />
                      <FinanceMini label="Pendiente" value={formatCurrency(financial.pending_amount)} />
                    </div>
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">
                    Sin datos de facturación. Conecta <code className="text-xs">/analytics/financial</code> para
                    verlos aquí.
                  </p>
                )}
              </Card>

              <Card className="p-6 lg:col-span-2">
                <CardHeader title="Flujo de caja mensual" subtitle="Facturado frente a cobrado." />
                {financial?.monthly?.length ? (
                  <AreaChart
                    data={financial.monthly.map((row) => ({
                      label: row.label || String(row.date || ""),
                      Facturado: Number(row.billed ?? row.billed_amount ?? 0),
                      Cobrado: Number(row.collected ?? row.collected_amount ?? 0),
                    }))}
                    series={[
                      { key: "Facturado", label: "Facturado", color: "#00A3FE" },
                      { key: "Cobrado", label: "Cobrado", color: "#10b981" },
                    ]}
                    height={260}
                    yFormatter={(v) => `$${formatNumber(v)}`}
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">
                    Conecta <code className="text-xs">/analytics/financial</code> con la serie
                    <code className="text-xs"> monthly[]</code> para ver el flujo de caja.
                  </p>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
};

const FinanceTile = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
    {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const FinanceMini = ({ label, value }) => (
  <div className="text-center">
    <p className="text-[11px] text-slate-400">{label}</p>
    <p className="text-sm font-bold tabular-nums text-slate-800">{value}</p>
  </div>
);

export default Reports;