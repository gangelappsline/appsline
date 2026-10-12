/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBriefcase, FiChevronDown, FiDownload, FiEdit2, FiMail, FiPhone,
  FiPlus, FiRefreshCw, FiTrash2, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Badge, Button, Card, CardsSkeleton, ConfirmDialog, EmptyState, Field,
  Modal, SearchInput, StatCard, useToast,
} from "../../components/admin";
import {
  deleteClient, fetchClients, fetchProjects, saveClient,
} from "../../services/admin";
import {
  cx, downloadCsv, formatCurrency, formatDate, initials, projectProgress,
  projectStatusMeta,
} from "../../utils/format";

const EMPTY_FORM = { name: "", email: "", phone: "" };
const FINISHED_STATUSES = ["completed", "finished", "finalizado", "rejected"];

const readClientFields = (client = {}) => ({
  id: client.id ?? client.client_id ?? null,
  name: String(client.name || client.full_name || client.client_name || "").trim(),
  email: String(client.email || client.client_email || "").trim(),
  phone: String(client.phone || client.phone_number || client.client_phone || "").trim(),
});

const readProjectClientFields = (project = {}) => {
  const relatedClient = project.client && typeof project.client === "object"
    ? project.client
    : {};
  return {
    id: project.client_id ?? project.clientId ?? relatedClient.id ?? null,
    name: String(project.client_name || relatedClient.name || "").trim(),
    email: String(project.client_email || relatedClient.email || "").trim(),
    phone: String(project.client_phone || relatedClient.phone || "").trim(),
  };
};

const projectBelongsToClient = (project, client) => {
  const projectContact = readProjectClientFields(project);
  if (projectContact.id != null && client.id != null) {
    return String(projectContact.id) === String(client.id);
  }

  const projectEmail = projectContact.email.toLowerCase();
  const clientEmail = client.email.toLowerCase();
  if (projectEmail && clientEmail) return projectEmail === clientEmail;

  const projectName = projectContact.name.toLowerCase();
  const clientName = client.name.toLowerCase();
  return Boolean(projectName && clientName && projectName === clientName);
};

const summarizeClient = (client, projects, source = "api") => {
  const active = projects.filter(
    (project) => !FINISHED_STATUSES.includes(String(project.status || "").toLowerCase())
  ).length;
  const budget = projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);
  const fields = readClientFields(client);

  return {
    ...client,
    ...fields,
    key: fields.id != null
      ? `client-${fields.id}`
      : `client-${(fields.email || fields.name || "sin-identificador").toLowerCase()}`,
    projects,
    active,
    budget,
    source,
  };
};

/* Mantiene la vista anterior si el backend aún no expone /clients. */
const clientsFromProjects = (projects) => {
  const groups = new Map();
  let orphanCount = 0;

  projects.forEach((project) => {
    const fields = readProjectClientFields(project);
    const identity = (fields.email || fields.name).toLowerCase();
    if (!identity) {
      orphanCount += 1;
      return;
    }

    if (!groups.has(identity)) {
      groups.set(identity, {
        name: fields.name || fields.email || "Cliente",
        email: fields.email,
        phone: fields.phone,
        projects: [],
      });
    }

    const group = groups.get(identity);
    group.projects.push(project);
    if (!group.email && fields.email) group.email = fields.email;
    if (!group.phone && fields.phone) group.phone = fields.phone;
    if ((!group.name || group.name === group.email) && fields.name) group.name = fields.name;
  });

  const clients = [...groups.entries()].map(([identity, client]) => {
    const summary = summarizeClient(client, client.projects, "project");
    return { ...summary, key: `project-${identity}` };
  });
  clients.sort((a, b) => b.budget - a.budget || a.name.localeCompare(b.name));
  return { clients, orphanCount };
};

const Clients = () => {
  const { notify } = useToast();
  const [clientRecords, setClientRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientApiAvailable, setClientApiAvailable] = useState(false);
  const [clientApiError, setClientApiError] = useState(false);
  const [projectsError, setProjectsError] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [clientsResult, projectsResult] = await Promise.allSettled([
      fetchClients(),
      fetchProjects(),
    ]);

    if (clientsResult.status === "fulfilled") {
      setClientRecords(clientsResult.value);
      setClientApiAvailable(true);
      setClientApiError(false);
    } else {
      setClientRecords([]);
      setClientApiAvailable(false);
      setClientApiError(true);
    }

    if (projectsResult.status === "fulfilled") {
      setProjects(projectsResult.value);
      setProjectsError(false);
    } else {
      setProjects([]);
      setProjectsError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { clients, orphanCount } = useMemo(() => {
    if (!clientApiAvailable) return clientsFromProjects(projects);

    const linkedProjectIds = new Set();
    const list = clientRecords.map((record) => {
      const fields = readClientFields(record);
      const linkedProjects = projects.filter((project) => projectBelongsToClient(project, fields));
      linkedProjects.forEach((project) => linkedProjectIds.add(project.id ?? project));
      return summarizeClient(record, linkedProjects);
    });
    list.sort((a, b) => b.budget - a.budget || a.name.localeCompare(b.name));
    return { clients: list, orphanCount: Math.max(0, projects.length - linkedProjectIds.size) };
  }, [clientApiAvailable, clientRecords, projects]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      `${client.name} ${client.email} ${client.phone}`.toLowerCase().includes(query)
    );
  }, [clients, search]);

  const totalBudget = clients.reduce((sum, client) => sum + client.budget, 0);
  const linkedProjectCount = projects.length - orphanCount;

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    if (formError) setFormError("");
  };

  const openCreate = () => {
    if (!clientApiAvailable) return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (client) => {
    if (!clientApiAvailable || client.id == null) return;
    setEditing(client);
    setForm({ name: client.name || "", email: client.email || "", phone: client.phone || "" });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("Escribe el nombre del cliente.");
      return;
    }

    setSaving(true);
    try {
      await saveClient(
        {
          name,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        },
        editing?.id ?? null
      );
      notify(editing ? "Cliente actualizado" : "Cliente creado");
      setShowModal(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      const message = error?.response?.data?.message;
      notify(
        typeof message === "string" && message.trim()
          ? message
          : editing ? "No se pudo actualizar el cliente" : "No se pudo crear el cliente",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || confirmDelete.id == null) return;
    setDeleting(true);
    try {
      await deleteClient(confirmDelete.id);
      setClientRecords((old) => old.filter((client) => String(readClientFields(client).id) !== String(confirmDelete.id)));
      setExpanded(null);
      notify("Cliente eliminado");
      setConfirmDelete(null);
      await load();
    } catch {
      notify("No se pudo eliminar el cliente", "error");
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Cliente", "Correo", "Teléfono", "Proyectos", "Activos", "Presupuesto total (MXN)"],
        ...filtered.map((client) => [
          client.name,
          client.email,
          client.phone,
          client.projects.length,
          client.active,
          client.budget,
        ]),
      ]
    );
    notify("Archivo CSV descargado");
  };

  return (
    <LayoutAdmin
      title="Clientes"
      subtitle="Administra tu cartera y consulta los proyectos vinculados."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
            <FiDownload /> Exportar CSV
          </Button>
          <Button
            onClick={openCreate}
            disabled={!clientApiAvailable}
            title={!clientApiAvailable ? "El servicio de clientes no está disponible" : undefined}
          >
            <FiPlus /> Nuevo cliente
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={clients.length} icon={FiBriefcase} tone="brand" hint="Registros en la cartera" />
        <StatCard label="Proyectos vinculados" value={linkedProjectCount} icon={FiUsers} tone="sky" hint={`De ${projects.length} en total`} />
        <StatCard label="Presupuesto total" value={formatCurrency(totalBudget)} icon={FiBriefcase} tone="green" hint="Valor de la cartera" />
        <StatCard label="Ticket promedio" value={formatCurrency(clients.length ? totalBudget / clients.length : 0)} icon={FiBriefcase} tone="amber" hint="Por cliente" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar cliente por nombre o contacto..."
            className="w-full sm:max-w-sm"
          />
          <span className="text-sm text-slate-500">
            {filtered.length} de {clients.length} cliente{clients.length === 1 ? "" : "s"}
            {orphanCount > 0 && ` · ${orphanCount} proyecto${orphanCount === 1 ? "" : "s"} sin cliente vinculado`}
          </span>
        </div>

        {(clientApiError || projectsError) && (
          <div className="space-y-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {clientApiError && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  El servicio de clientes no está disponible. Se muestran los contactos encontrados en proyectos en modo de solo lectura; crear, editar y eliminar requiere que la API <code className="rounded bg-amber-100 px-1">/clients</code> responda correctamente.
                </p>
                <Button variant="secondary" onClick={load} loading={loading} className="shrink-0">
                  <FiRefreshCw /> Reintentar
                </Button>
              </div>
            )}
            {projectsError && <p>No se pudieron cargar los proyectos asociados a los clientes.</p>}
          </div>
        )}

        <div className="p-4 sm:p-5">
          {loading ? (
            <CardsSkeleton count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FiBriefcase}
              title={
                search
                  ? "Sin coincidencias"
                  : clientApiError
                    ? "No se pudo cargar la gestión de clientes"
                    : "No hay clientes registrados"
              }
              description={
                search
                  ? "Prueba con otro nombre, correo o teléfono."
                  : clientApiError
                    ? "Comprueba la conexión con la API y vuelve a intentarlo."
                    : "Agrega tu primer cliente para empezar a organizar su cartera de proyectos."
              }
              action={search ? undefined : clientApiError ? (
                <Button variant="secondary" onClick={load} loading={loading}>
                  <FiRefreshCw /> Reintentar
                </Button>
              ) : (
                <Button onClick={openCreate}><FiPlus /> Agregar cliente</Button>
              )}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((client) => (
                <ClientCard
                  key={client.key}
                  client={client}
                  canManage={clientApiAvailable}
                  expanded={expanded === client.key}
                  onToggle={() => setExpanded(expanded === client.key ? null : client.key)}
                  onEdit={() => openEdit(client)}
                  onDelete={() => setConfirmDelete(client)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? "Editar cliente" : "Nuevo cliente"}
        subtitle={editing ? "Actualiza sus datos de contacto." : "Completa los datos para agregarlo a tu cartera."}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="client-form" loading={saving}>
              {editing ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre del cliente" required error={formError}>
            <input
              className="admin-input"
              value={form.name}
              onChange={set("name")}
              placeholder="Ej. Acme S.A. de C.V."
              maxLength={150}
              required
              autoFocus
            />
          </Field>
          <Field label="Correo electrónico">
            <input
              type="email"
              className="admin-input"
              value={form.email}
              onChange={set("email")}
              placeholder="contacto@empresa.com"
              maxLength={255}
            />
          </Field>
          <Field label="Teléfono">
            <input
              type="tel"
              className="admin-input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+52 55 1234 5678"
              maxLength={40}
            />
          </Field>
          <p className="text-xs leading-5 text-slate-400">
            Los proyectos existentes se vinculan al cliente por correo o nombre.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`¿Eliminar a ${confirmDelete?.name || "este cliente"}?`}
        message="Se eliminará el registro del cliente. Los proyectos asociados no se eliminarán. Esta acción no se puede deshacer."
      />
    </LayoutAdmin>
  );
};

const ClientCard = ({ client, canManage, expanded, onToggle, onEdit, onDelete }) => (
  <article className="admin-card admin-card-hover flex min-w-0 flex-col p-5">
    <div className="flex items-start gap-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-500 text-sm font-extrabold text-white">
        {initials(client.name, "C")}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-[15px] font-semibold text-slate-900">{client.name || "Cliente"}</h3>
        <div className="mt-1 space-y-0.5 text-[13px] text-slate-500">
          {client.email ? (
            <a href={`mailto:${client.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-brand-600">
              <FiMail className="shrink-0 text-slate-300" />
              <span className="truncate">{client.email}</span>
            </a>
          ) : <p className="text-xs text-slate-400">Sin correo</p>}
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="flex min-w-0 items-center gap-1.5 hover:text-brand-600">
              <FiPhone className="shrink-0 text-slate-300" />
              <span className="truncate">{client.phone}</span>
            </a>
          ) : <p className="text-xs text-slate-400">Sin teléfono</p>}
        </div>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="subtle"
            title={`Editar ${client.name}`}
            aria-label={`Editar ${client.name}`}
            onClick={onEdit}
          >
            <FiEdit2 />
          </Button>
          <Button
            variant="subtle"
            tone="red"
            title={`Eliminar ${client.name}`}
            aria-label={`Eliminar ${client.name}`}
            onClick={onDelete}
          >
            <FiTrash2 />
          </Button>
        </div>
      ) : (
        <Badge tone="amber">Solo lectura</Badge>
      )}
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

    {client.projects.length > 0 ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        {expanded ? "Ocultar proyectos" : `Ver ${client.projects.length} proyecto${client.projects.length === 1 ? "" : "s"}`}
        <FiChevronDown className={cx("transition", expanded && "rotate-180")} />
      </button>
    ) : (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-2 text-center text-[13px] text-slate-400">
        Sin proyectos vinculados
      </p>
    )}

    {expanded && (
      <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        {client.projects.map((project) => {
          const status = projectStatusMeta(project.status);
          const progress = projectProgress(project);
          return (
            <li key={project.id}>
              <Link
                to={`/admin/projects/${project.id}`}
                className="block rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{project.name || "Proyecto sin nombre"}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{progress}%</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Entrega: {project.end_date ? formatDate(project.end_date) : "Sin fecha"}
                  {Number(project.budget) > 0 && ` · ${formatCurrency(project.budget)}`}
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
