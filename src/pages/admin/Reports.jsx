import { Link } from "react-router-dom";
import {
  FiAlertTriangle, FiBriefcase, FiCheckCircle, FiClock,
  FiDownload, FiLayers, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import useDashboard from "../../hooks/useDashboard";
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState,
  ProgressRing, BarChart, RankBars, StatCard, useToast,
} from "../../components/admin";
import { downloadCsv, formatCurrency } from "../../utils/format";

const Reports = () => {
  const { notify } = useToast();
  const {
    loading, error, reload, kpis, perUser, tasksByStatus,
    onTimeRate, forecast, projects, totalBudget,
  } = useDashboard();

  const completionRate = kpis.total ? Math.round((kpis.completed / kpis.total) * 100) : 0;

  const rankedUsers = [...perUser]
    .map((u) => {
      const base = u.total_completed || u.total || 0;
      const prod = 100 - (u.late > 0 && base ? (u.late * 100) / base : 0);
      return { ...u, productivity: Math.round(prod), base };
    })
    .sort((a, b) => b.productivity - a.productivity);

  const exportUsersCsv = () => {
    downloadCsv(
      `productividad-usuarios-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Usuario", "Tareas totales", "A tiempo", "Tarde", "Productividad %"],
        ...rankedUsers.map((u) => [u.name, u.base, u.on_time || 0, u.late || 0, u.productivity]),
      ]
    );
    notify("Archivo CSV descargado");
  };

  const exportProjectsCsv = () => {
    downloadCsv(
      `proyectos-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Proyecto", "Cliente", "Estado", "Presupuesto (MXN)", "Fecha de entrega"],
        ...projects.map((p) => [p.name, p.client_name || "", p.status || "", p.budget || 0, p.end_date || ""]),
      ]
    );
    notify("Archivo CSV descargado");
  };

  return (
    <LayoutAdmin
      title="Reportes"
      subtitle="Análisis de rendimiento, cumplimiento y cartera"
      actions={
        <>
          <Button variant="secondary" onClick={exportProjectsCsv} disabled={projects.length === 0}>
            <FiDownload /> Proyectos CSV
          </Button>
          <Button onClick={exportUsersCsv} disabled={rankedUsers.length === 0}>
            <FiDownload /> Usuarios CSV
          </Button>
        </>
      }
    >
      {loading ? (
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
      ) : error && !kpis.total && perUser.length === 0 ? (
        <Card>
          <EmptyState
            icon={FiAlertTriangle}
            title="No se pudieron cargar los reportes"
            description="Verifica tu conexión o vuelve a intentarlo más tarde."
            action={<Button variant="secondary" onClick={reload}>Reintentar</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ---------- KPIs ---------- */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total de tareas" value={kpis.total} icon={FiLayers} tone="slate" hint={`${kpis.completed} finalizadas`} />
            <StatCard label="Tasa de finalización" value={`${completionRate}%`} icon={FiCheckCircle} tone="green" progress={completionRate} />
            <StatCard label="Entrega a tiempo" value={`${Math.round(onTimeRate * 100)}%`} icon={FiClock} tone="brand" progress={onTimeRate * 100} />
            <StatCard label="Valor del portafolio" value={formatCurrency(totalBudget)} icon={FiBriefcase} tone="amber" hint={`${projects.length} proyectos`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---------- Tareas por estado ---------- */}
            <Card className="p-6">
              <CardHeader title="Tareas por estado" subtitle="Distribución del trabajo actual." />
              <BarChart data={tasksByStatus} />
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
                {[
                  { label: "Completadas", value: kpis.completed, tone: "green" },
                  { label: "En progreso", value: kpis.inProgress, tone: "brand" },
                  { label: "Pendientes", value: kpis.pending, tone: "amber" },
                  { label: "Total", value: kpis.total, tone: "slate" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
                    <p className="text-xl font-bold tabular-nums text-slate-800">{s.value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ---------- Ranking de productividad ---------- */}
            <Card className="p-6">
              <CardHeader
                title="Ranking de productividad"
                subtitle="Porcentaje de entregas a tiempo por usuario."
                actions={<Link to="/admin/users" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Ver equipo →</Link>}
              />
              {rankedUsers.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Aún no hay datos de usuarios.</p>
              ) : (
                <div className="space-y-4">
                  {rankedUsers.slice(0, 5).map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-slate-300">{i + 1}</span>
                      <Avatar user={u} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                          <span className="text-sm font-bold tabular-nums text-slate-800">{u.productivity}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${u.productivity >= 80 ? "bg-emerald-500" : u.productivity >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                            style={{ width: `${u.productivity}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------- Entrega a tiempo ---------- */}
            <Card className="p-6">
              <CardHeader title="Cumplimiento global" subtitle="Probabilidad de entregar a tiempo." />
              <div className="flex justify-center py-2">
                <ProgressRing value={onTimeRate} size={150} />
              </div>
              {forecast.filter((p) => p.pct !== null).length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Pronóstico por proyecto</h3>
                  <RankBars
                    data={forecast.filter((p) => p.pct !== null).map((p) => ({
                      label: p.name,
                      value: p.pct,
                      display: `${p.pct}%`,
                      barClass: p.pct >= 80 ? "bg-emerald-500" : p.pct >= 50 ? "bg-amber-400" : "bg-red-500",
                    }))}
                  />
                </div>
              )}
            </Card>

            {/* ---------- Tabla por usuario ---------- */}
            <Card className="overflow-hidden lg:col-span-2">
              <div className="p-6 pb-4">
                <CardHeader
                  title="Detalle por usuario"
                  subtitle="Tareas asignadas, a tiempo y tardías."
                  actions={
                    <Button variant="secondary" onClick={exportUsersCsv} disabled={rankedUsers.length === 0}>
                      <FiDownload /> Exportar CSV
                    </Button>
                  }
                />
              </div>
              {rankedUsers.length === 0 ? (
                <EmptyState icon={FiUsers} title="Sin datos" description="Aún no hay actividad registrada por usuario." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="admin-table-head">
                        <th className="px-6 py-3.5">Usuario</th>
                        <th className="px-6 py-3.5 text-right">Total</th>
                        <th className="px-6 py-3.5 text-right">A tiempo</th>
                        <th className="px-6 py-3.5 text-right">Tarde</th>
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
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{u.base}</td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-emerald-600">{u.on_time || 0}</td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-red-500">{u.late || 0}</td>
                          <td className="px-6 py-3.5 text-right">
                            <Badge tone={u.productivity >= 80 ? "green" : u.productivity >= 50 ? "amber" : "red"}>
                              {u.productivity}%
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
    </LayoutAdmin>
  );
};

export default Reports;
