/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBriefcase, FiChevronDown, FiDownload, FiMail, FiPhone, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Badge, Button, Card, CardsSkeleton, EmptyState, SearchInput,
  StatCard, useToast,
} from "../../components/admin";
import { fetchProjects } from "../../services/admin";
import {
  cx, downloadCsv, formatCurrency, formatDate, projectProgress, projectStatusMeta,
} from "../../utils/format";

const Clients = () => {
  const { notify } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setProjects(await fetchProjects());
      } catch {
        setProjects([]);
        notify("No se pudieron cargar los clientes", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Agrupa proyectos por cliente (email o nombre). */
  const { clients, orphanCount } = useMemo(() => {
    const map = new Map();
    let orphans = 0;
    projects.forEach((p) => {
      const key = (p.client_email || p.client_name || "").trim().toLowerCase();
      if (!key) {
        orphans++;
        return;
      }
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: p.client_name || p.client_email || "Cliente",
          email: p.client_email || "",
          phone: p.client_phone || "",
          projects: [],
        });
      }
      map.get(key).projects.push(p);
      // Completa datos de contacto si otro proyecto los trae.
      const c = map.get(key);
      if (!c.email && p.client_email) c.email = p.client_email;
      if (!c.phone && p.client_phone) c.phone = p.client_phone;
      if ((!c.name || c.name === c.email) && p.client_name) c.name = p.client_name;
    });
    const list = [...map.values()].map((c) => ({
      ...c,
      active: c.projects.filter((p) => !["completed", "finished", "finalizado", "rejected"].includes(p.status)).length,
      budget: c.projects.reduce((s, p) => s + Number(p.budget || 0), 0),
    }));
    list.sort((a, b) => b.budget - a.budget);
    return { clients: list, orphanCount: orphans };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const totalBudget = clients.reduce((s, c) => s + c.budget, 0);

  const exportCsv = () => {
    downloadCsv(
      `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Cliente", "Correo", "Teléfono", "Proyectos", "Activos", "Presupuesto total (MXN)"],
        ...filtered.map((c) => [c.name, c.email, c.phone, c.projects.length, c.active, c.budget]),
      ]
    );
    notify("Archivo CSV descargado");
  };

  return (
    <LayoutAdmin
      title="Clientes"
      subtitle="Cartera de clientes construida a partir de tus proyectos"
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <FiDownload /> Exportar CSV
        </Button>
      }
    >
      {/* ---------- Resumen ---------- */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={clients.length} icon={FiBriefcase} tone="brand" hint="Con al menos un proyecto" />
        <StatCard label="Proyectos vinculados" value={projects.length - orphanCount} icon={FiUsers} tone="sky" hint={`De ${projects.length} en total`} />
        <StatCard label="Presupuesto total" value={formatCurrency(totalBudget)} icon={FiBriefcase} tone="green" hint="Valor de la cartera" />
        <StatCard label="Ticket promedio" value={formatCurrency(clients.length ? totalBudget / clients.length : 0)} icon={FiBriefcase} tone="amber" hint="Por cliente" />
      </div>

      {/* ---------- Lista ---------- */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar cliente..."
            className="w-full sm:max-w-xs"
          />
          <span className="text-sm text-slate-500">
            {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
            {orphanCount > 0 && ` · ${orphanCount} proyecto${orphanCount === 1 ? "" : "s"} sin cliente`}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <CardsSkeleton count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FiBriefcase}
              title={search ? "Sin coincidencias" : "No hay clientes registrados"}
              description={
                search
                  ? "Prueba con otro nombre o correo."
                  : "Los clientes aparecen aquí cuando un proyecto tiene datos de contacto."
              }
              action={!search && (
                <Link to="/admin/projects" className="btn-secondary">Ir a proyectos</Link>
              )}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((client) => (
                <ClientCard
                  key={client.key}
                  client={client}
                  expanded={expanded === client.key}
                  onToggle={() => setExpanded(expanded === client.key ? null : client.key)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </LayoutAdmin>
  );
};

/* ------------------------------------------------------------------ */

const ClientCard = ({ client, expanded, onToggle }) => (
  <article className="admin-card admin-card-hover flex flex-col p-5">
    <div className="flex items-start gap-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-500 text-sm font-extrabold text-white">
        {(client.name || "C").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-slate-900">{client.name}</h3>
        <div className="mt-1 space-y-0.5 text-[13px] text-slate-500">
          {client.email && (
            <a href={`mailto:${client.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 truncate hover:text-brand-600">
              <FiMail className="shrink-0 text-slate-300" /> <span className="truncate">{client.email}</span>
            </a>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 hover:text-brand-600">
              <FiPhone className="shrink-0 text-slate-300" /> {client.phone}
            </a>
          )}
        </div>
      </div>
    </div>

    <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Proyectos</dt>
        <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">{client.projects.length}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Activos</dt>
        <dd className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">{client.active}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Valor</dt>
        <dd className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-800" title={formatCurrency(client.budget)}>
          {formatCurrency(client.budget)}
        </dd>
      </div>
    </dl>

    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {expanded ? "Ocultar proyectos" : `Ver ${client.projects.length} proyecto${client.projects.length === 1 ? "" : "s"}`}
      <FiChevronDown className={cx("transition", expanded && "rotate-180")} />
    </button>

    {expanded && (
      <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        {client.projects.map((p) => {
          const status = projectStatusMeta(p.status);
          const pct = projectProgress(p);
          return (
            <li key={p.id}>
              <Link
                to={`/admin/projects/${p.id}`}
                className="block rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{pct}%</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Entrega: {p.end_date ? formatDate(p.end_date) : "Sin fecha"}
                  {Number(p.budget) > 0 && ` · ${formatCurrency(p.budget)}`}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </article>
);

export default Clients;
