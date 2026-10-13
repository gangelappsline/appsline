/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle, FiArrowDown, FiArrowUp, FiBriefcase, FiChevronDown, FiChevronLeft,
  FiChevronRight, FiDollarSign, FiDownload, FiEdit2, FiFolder, FiHash, FiMail,
  FiPhone, FiPlus, FiRefreshCw, FiSlash, FiTrash2, FiUser, FiUsers, FiX,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Badge, Button, Card, CardsSkeleton, ConfirmDialog, EmptyState, Field,
  Modal, SearchInput, StatCard, useToast,
} from "../../components/admin";
import {
  deleteClient, fetchClientsPage, fetchProjects, saveClient,
} from "../../services/admin";
import {
  CLIENT_STATUSES, CLIENT_TYPES, COUNTRIES, clientKey, clientStatusMeta,
  clientTypeLabel, clientsFromProjects, countryMeta, countrySelectValue,
  isValidEmail, linkProjects, readClientFields,
} from "../../utils/clients";
import { apiErrorMessage, fieldErrors } from "../../utils/apiErrors";
import {
  cx, downloadCsv, formatCurrency, formatDate, initials, projectStatusMeta,
} from "../../utils/format";

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

/** Campos que acepta POST/PUT /clients (ver FormRequest del backend). */
const EMPTY_FORM = {
  business_name: "",
  tax_id: "",
  contact_name: "",
  email: "",
  phone: "",
  status: "prospect",
  client_type: "company",
  country: "MX",
};

const EMPTY_FILTERS = { search: "", status: "", client_type: "", country: "" };

/** Columnas por las que el backend permite ordenar (sort_by). */
const SORT_OPTIONS = [
  { value: "business_name", label: "Razón social" },
  { value: "contact_name", label: "Contacto" },
  { value: "status", label: "Estado" },
  { value: "created_at", label: "Fecha de alta" },
];

const PER_PAGE_OPTIONS = [12, 24, 48];
const SEARCH_DEBOUNCE = 350;
const MAX_EXPORT_PAGES = 20;

/** Traduce las claves de error de Laravel a los campos del formulario. */
const FIELD_ALIASES = {
  business_name: "business_name",
  name: "business_name",
  company_name: "business_name",
  tax_id: "tax_id",
  tax_identifier: "tax_id",
  rfc: "tax_id",
  contact_name: "contact_name",
  contact: "contact_name",
  email: "email",
  phone: "phone",
  status: "status",
  client_type: "client_type",
  type: "client_type",
  country: "country",
};

const mapFieldErrors = (error) => {
  const mapped = {};
  Object.entries(fieldErrors(error)).forEach(([key, message]) => {
    const target = FIELD_ALIASES[key] || FIELD_ALIASES[String(key).split(".").pop()] || key;
    if (!mapped[target]) mapped[target] = message;
  });
  return mapped;
};

/** Formulario → payload del backend (solo los campos documentados). */
const buildPayload = (form) => ({
  business_name: form.business_name.trim(),
  tax_id: form.tax_id.trim().toUpperCase() || null,
  contact_name: form.contact_name.trim() || null,
  email: form.email.trim().toLowerCase() || null,
  phone: form.phone.trim() || null,
  status: form.status || "prospect",
  client_type: form.client_type || "company",
  country: form.country || "MX",
});

/** Validación local previa (el backend sigue siendo la fuente de verdad). */
const validatePayload = (payload) => {
  const errors = {};
  if (!payload.business_name) {
    errors.business_name = "Escribe la razón social o el nombre del cliente.";
  }
  if (payload.email && !isValidEmail(payload.email)) {
    errors.email = "Escribe un correo válido (ej. contacto@empresa.com).";
  }
  if (payload.phone && payload.phone.replace(/\D/g, "").length < 7) {
    errors.phone = "El teléfono debe tener al menos 7 dígitos.";
  }
  if (payload.tax_id && payload.tax_id.length < 5) {
    errors.tax_id = "El identificador fiscal parece incompleto.";
  }
  return errors;
};

/** Cliente de la API → valores del formulario. */
const formFromClient = (client = {}) => ({
  business_name: client.business_name || "",
  tax_id: client.tax_id || "",
  contact_name: client.contact_name || "",
  email: client.email || "",
  phone: client.phone || "",
  status: clientStatusMeta(client.status).value || "prospect",
  client_type: CLIENT_TYPES.some((type) => type.value === client.client_type)
    ? client.client_type
    : "company",
  country: countrySelectValue(client.country) || "MX",
});

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const Clients = () => {
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  /* Listado */
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 12, total: 0 });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [listError, setListError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState(false);
  const firstLoad = useRef(true);

  /* Filtros, orden y paginación */
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [sort, setSort] = useState({ by: "business_name", dir: "asc" });

  /* Formulario */
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(null);

  /* ---------------- consultas ---------------- */

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      status: filters.status,
      client_type: filters.client_type,
      country: filters.country,
      sort_by: sort.by,
      sort_dir: sort.dir,
      per_page: perPage,
    }),
    [debouncedSearch, filters.status, filters.client_type, filters.country, sort.by, sort.dir, perPage]
  );

  const load = useCallback(
    async ({ hard = false } = {}) => {
      if (hard) setLoading(true);
      else setFetching(true);

      try {
        const { items, meta: nextMeta } = await fetchClientsPage({ ...query, page });
        setClients(items);
        setMeta(nextMeta);
        setApiAvailable(true);
        setListError("");
        // Si borramos el último registro de la página, retrocede una.
        if (page > nextMeta.last_page) setPage(nextMeta.last_page);
      } catch (error) {
        setClients([]);
        setApiAvailable(false);
        setListError(apiErrorMessage(error, "No se pudo cargar la lista de clientes."));
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    [query, page]
  );

  useEffect(() => {
    load({ hard: firstLoad.current });
    firstLoad.current = false;
  }, [load]);

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await fetchProjects());
      setProjectsError(false);
    } catch {
      setProjects([]);
      setProjectsError(true);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  /* Espera a que el usuario deje de escribir antes de consultar. */
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE);
    return () => clearTimeout(handle);
  }, [filters.search]);

  /* ---------------- filas visibles ---------------- */

  const rows = useMemo(
    () =>
      clients.map((record) => {
        const fields = readClientFields(record);
        const linked = linkProjects(projects, fields);
        return {
          ...fields,
          key: clientKey(fields),
          source: "api",
          projects: linked.projects,
          active_projects: linked.active_projects,
          budget: linked.budget,
          projects_total: Math.max(fields.projects_count, linked.projects.length),
        };
      }),
    [clients, projects]
  );

  /* Respaldo de solo lectura: contactos embebidos en los proyectos. */
  const fallback = useMemo(() => clientsFromProjects(projects), [projects]);

  const list = useMemo(() => {
    if (apiAvailable) return rows;
    const q = filters.search.trim().toLowerCase();
    return fallback.clients
      .map((item) => ({
        ...readClientFields(item),
        key: item.key,
        source: "project",
        projects: item.projects,
        active_projects: item.active_projects,
        budget: item.budget,
        projects_total: item.projects.length,
      }))
      .filter((item) =>
        !q || `${item.business_name} ${item.contact_name} ${item.email} ${item.phone}`.toLowerCase().includes(q)
      );
  }, [apiAvailable, rows, fallback, filters.search]);

  const hasFilters = Boolean(
    filters.search || filters.status || filters.client_type || filters.country
  );
  const total = apiAvailable ? meta.total : list.length;
  const pageProjects = list.reduce((sum, item) => sum + Number(item.projects_total || 0), 0);
  const pageBudget = list.reduce((sum, item) => sum + Number(item.budget || 0), 0);
  // El backend manda `from`/`to`; si no, se calculan con la página actual.
  const from =
    meta.from ?? (meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1);
  const to = meta.to ?? (from === 0 ? 0 : from + list.length - 1);

  /* ---------------- acciones ---------------- */

  const setFilter = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setDebouncedSearch("");
    setPage(1);
  };

  const set = (key) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: "" } : current));
  };

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  }, []);

  const openEdit = (client) => {
    if (client.id == null) {
      notify("Este contacto proviene de un proyecto y no se puede editar aquí.", "info");
      return;
    }
    setEditing(client);
    setForm(formFromClient(client));
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  /* Permite abrir el formulario con /admin/clients?action=new (paleta Ctrl+K). */
  useEffect(() => {
    if (searchParams.get("action") !== "new") return;
    openCreate();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, openCreate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildPayload(form);
    const localErrors = validatePayload(payload);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setSaving(true);
    try {
      await saveClient(payload, editing?.id ?? null);
      notify(editing ? "Cliente actualizado" : "Cliente creado");
      setShowModal(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setErrors({});
      await load({ hard: !apiAvailable });
    } catch (error) {
      const mapped = mapFieldErrors(error);
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) {
        setErrors({
          __general: apiErrorMessage(
            error,
            editing ? "No se pudo actualizar el cliente." : "No se pudo crear el cliente."
          ),
        });
      }
      notify(
        apiErrorMessage(error, editing ? "No se pudo actualizar el cliente" : "No se pudo crear el cliente"),
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
      setExpanded(null);
      notify("Cliente eliminado");
      setConfirmDelete(null);
      await load({ hard: !apiAvailable });
    } catch (error) {
      notify(apiErrorMessage(error, "No se pudo eliminar el cliente"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      // Exporta todo lo que coincide con los filtros, no solo la página actual.
      let records = clients;
      if (apiAvailable) {
        const first = await fetchClientsPage({ ...query, page: 1, per_page: 100 });
        const pages = Math.min(first.meta.last_page || 1, MAX_EXPORT_PAGES);
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
            fetchClientsPage({ ...query, page: index + 2, per_page: 100 })
          )
        );
        records = [first, ...rest].flatMap((response) => response.items);
      }

      downloadCsv(
        `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          [
            "Razón social", "Identificador fiscal", "Contacto", "Correo", "Teléfono",
            "Estado", "Tipo", "País", "Proyectos", "Presupuesto (MXN)", "Alta",
          ],
          ...records.map((record) => {
            const fields = readClientFields(record);
            return [
              fields.business_name,
              fields.tax_id,
              fields.contact_name,
              fields.email,
              fields.phone,
              clientStatusMeta(fields.status).label,
              clientTypeLabel(fields.client_type),
              fields.country ? countryMeta(fields.country).label : "",
              fields.projects_count,
              record.budget ?? "",
              fields.created_at ? String(fields.created_at).slice(0, 10) : "",
            ];
          }),
        ]
      );
      notify("Archivo CSV descargado");
    } catch (error) {
      notify(apiErrorMessage(error, "No se pudo exportar la cartera de clientes"), "error");
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- render ---------------- */

  return (
    <LayoutAdmin
      title="Clientes"
      subtitle="Administra la cartera: datos fiscales, contacto, estado y proyectos vinculados."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={total === 0}>
            <FiDownload /> Exportar CSV
          </Button>
          <Button onClick={openCreate}>
            <FiPlus /> Nuevo cliente
          </Button>
        </>
      }
    >
      {/* ---------- Resumen ---------- */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clientes"
          value={total}
          icon={FiBriefcase}
          tone="brand"
          hint={hasFilters ? "Coinciden con los filtros" : "Registros en la cartera"}
        />
        <StatCard
          label="Mostrando"
          value={list.length}
          icon={FiUsers}
          tone="sky"
          hint={apiAvailable ? `Página ${meta.current_page} de ${meta.last_page}` : "Modo solo lectura"}
        />
        <StatCard
          label="Proyectos vinculados"
          value={pageProjects}
          icon={FiFolder}
          tone="violet"
          hint="De los clientes mostrados"
        />
        <StatCard
          label="Presupuesto"
          value={formatCurrency(pageBudget)}
          icon={FiDollarSign}
          tone="green"
          hint="De los clientes mostrados"
        />
      </div>

      {/* ---------- Filtros ---------- */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={filters.search}
              onChange={setFilter("search")}
              placeholder="Buscar por razón social, contacto, correo o RFC..."
              className="w-full sm:max-w-sm"
            />
            <select
              aria-label="Filtrar por estado"
              className="admin-input w-full sm:w-auto"
              value={filters.status}
              onChange={(event) => setFilter("status")(event.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">Todos los estados</option>
              {CLIENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <select
              aria-label="Filtrar por tipo de cliente"
              className="admin-input w-full sm:w-auto"
              value={filters.client_type}
              onChange={(event) => setFilter("client_type")(event.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">Todos los tipos</option>
              {CLIENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <select
              aria-label="Filtrar por país"
              className="admin-input w-full sm:w-auto"
              value={filters.country}
              onChange={(event) => setFilter("country")(event.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">Todos los países</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>{country.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Ordenar por"
              className="admin-input w-full sm:w-auto"
              value={sort.by}
              onChange={(event) => {
                setSort((current) => ({ ...current, by: event.target.value }));
                setPage(1);
              }}
              disabled={!apiAvailable}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button
              variant="secondary"
              title={sort.dir === "asc" ? "Orden ascendente" : "Orden descendente"}
              aria-label={sort.dir === "asc" ? "Orden ascendente" : "Orden descendente"}
              disabled={!apiAvailable}
              onClick={() => {
                setSort((current) => ({ ...current, dir: current.dir === "asc" ? "desc" : "asc" }));
                setPage(1);
              }}
            >
              {sort.dir === "asc" ? <FiArrowUp /> : <FiArrowDown />}
              <span className="hidden lg:inline">{sort.dir === "asc" ? "Ascendente" : "Descendente"}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => load({ hard: false })}
              loading={fetching}
              title="Actualizar resultados"
            >
              <FiRefreshCw /> <span className="hidden lg:inline">Actualizar</span>
            </Button>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <FiX /> Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-slate-500">
          <span>
            {apiAvailable ? (
              <>
                Mostrando <strong className="font-semibold text-slate-700">{list.length}</strong> de{" "}
                <strong className="font-semibold text-slate-700">{meta.total}</strong> cliente
                {meta.total === 1 ? "" : "s"}
                {hasFilters && " que coinciden con los filtros"}
              </>
            ) : (
              <>Cartera en modo solo lectura ({list.length} contacto{list.length === 1 ? "" : "s"} desde proyectos)</>
            )}
          </span>
          {!apiAvailable && fallback.orphanCount > 0 && (
            <span className="text-amber-700">
              {fallback.orphanCount} proyecto{fallback.orphanCount === 1 ? "" : "s"} sin cliente identificable
            </span>
          )}
        </div>

        {(listError || projectsError) && (
          <div className="space-y-2 border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {listError && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2">
                  <FiAlertCircle className="mt-0.5 shrink-0 text-base" />
                  <span>
                    {listError} Se muestran los contactos encontrados en los proyectos en modo de solo
                    lectura; crear, editar y eliminar requieren que la API{" "}
                    <code className="rounded bg-amber-100 px-1">/clients</code> responda correctamente.
                  </span>
                </p>
                <Button variant="secondary" onClick={() => load({ hard: true })} loading={loading} className="shrink-0">
                  <FiRefreshCw /> Reintentar
                </Button>
              </div>
            )}
            {projectsError && (
              <p>No se pudieron cargar los proyectos, así que el detalle de cada cliente está incompleto.</p>
            )}
          </div>
        )}

        {/* ---------- Resultados ---------- */}
        <div className={cx("p-4 sm:p-5", fetching && "opacity-60 transition-opacity")}>
          {loading ? (
            <CardsSkeleton count={6} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={FiBriefcase}
              title={
                hasFilters
                  ? "Sin coincidencias"
                  : listError
                    ? "No se pudo cargar la cartera"
                    : "No hay clientes registrados"
              }
              description={
                hasFilters
                  ? "Ajusta o limpia los filtros para ver más resultados."
                  : listError
                    ? "Revisa la conexión con la API y vuelve a intentarlo."
                    : "Agrega tu primer cliente para empezar a organizar su cartera de proyectos."
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={clearFilters}><FiX /> Limpiar filtros</Button>
                ) : listError ? (
                  <Button variant="secondary" onClick={() => load({ hard: true })}>
                    <FiRefreshCw /> Reintentar
                  </Button>
                ) : (
                  <Button onClick={openCreate}><FiPlus /> Agregar cliente</Button>
                )
              }
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {list.map((client) => (
                <ClientCard
                  key={client.key}
                  client={client}
                  canManage={apiAvailable && client.source === "api" && client.id != null}
                  expanded={expanded === client.key}
                  onToggle={() => setExpanded(expanded === client.key ? null : client.key)}
                  onEdit={() => openEdit(client)}
                  onDelete={() => setConfirmDelete(client)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ---------- Paginación ---------- */}
        {apiAvailable && meta.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">
                {from}–{to} de {meta.total}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <span className="hidden sm:inline">Por página</span>
                <select
                  aria-label="Registros por página"
                  className="admin-input w-auto py-1.5"
                  value={perPage}
                  onChange={(event) => {
                    setPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {PER_PAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={meta.current_page <= 1}
                onClick={() => setPage(Math.max(1, meta.current_page - 1))}
              >
                <FiChevronLeft /> Anterior
              </Button>
              <span className="text-sm font-medium text-slate-600 tabular-nums">
                Página {meta.current_page} de {meta.last_page}
              </span>
              <Button
                variant="secondary"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => setPage(Math.min(meta.last_page, meta.current_page + 1))}
              >
                Siguiente <FiChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ---------- Modal crear/editar ---------- */}
      <Modal
        open={showModal}
        onClose={closeModal}
        size="xl"
        title={editing ? "Editar cliente" : "Nuevo cliente"}
        subtitle={
          editing
            ? `Actualiza los datos de ${editing.business_name || "este cliente"}.`
            : "Registra los datos fiscales y de contacto del cliente."
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="client-form" loading={saving}>
              {editing ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
          {errors.__general && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:col-span-2">
              <FiAlertCircle className="mt-0.5 shrink-0" /> {errors.__general}
            </p>
          )}

          <Field
            label="Razón social o nombre"
            required
            error={errors.business_name}
            hint="Tal como debe aparecer en cotizaciones y facturas."
            className="sm:col-span-2"
          >
            <input
              className="admin-input"
              value={form.business_name}
              onChange={set("business_name")}
              placeholder="Ej. Acme S.A. de C.V."
              maxLength={150}
              required
              autoFocus
            />
          </Field>

          <Field
            label="Identificador fiscal"
            error={errors.tax_id}
            hint="RFC en México. Debe ser único entre clientes."
          >
            <input
              className="admin-input uppercase placeholder:normal-case"
              value={form.tax_id}
              onChange={set("tax_id")}
              placeholder="ACM123456XYZ"
              maxLength={30}
            />
          </Field>

          <Field label="Tipo de cliente" error={errors.client_type}>
            <select className="admin-input" value={form.client_type} onChange={set("client_type")}>
              {CLIENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Persona de contacto" error={errors.contact_name}>
            <input
              className="admin-input"
              value={form.contact_name}
              onChange={set("contact_name")}
              placeholder="Ej. Juan Pérez"
              maxLength={150}
            />
          </Field>

          <Field label="Estado" error={errors.status}>
            <select className="admin-input" value={form.status} onChange={set("status")}>
              {CLIENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Correo electrónico" error={errors.email} hint="Debe ser único entre clientes.">
            <input
              type="email"
              className="admin-input"
              value={form.email}
              onChange={set("email")}
              placeholder="contacto@empresa.com"
              maxLength={255}
            />
          </Field>

          <Field label="Teléfono" error={errors.phone} hint="Incluye lada internacional (ej. +52).">
            <input
              type="tel"
              className="admin-input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+52 55 1234 5678"
              maxLength={40}
            />
          </Field>

          <Field label="País" error={errors.country} className="sm:col-span-2">
            <select className="admin-input" value={form.country} onChange={set("country")}>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>{country.label} ({country.code})</option>
              ))}
            </select>
          </Field>

          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500 sm:col-span-2">
            Los proyectos se vinculan al cliente por su identificador, correo o razón social.
          </p>
        </form>
      </Modal>

      {/* ---------- Confirmar eliminación ---------- */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`¿Eliminar a ${confirmDelete?.business_name || "este cliente"}?`}
        message="Se eliminará el registro del cliente y sus datos de contacto. Los proyectos asociados no se eliminan. Esta acción no se puede deshacer."
      />
    </LayoutAdmin>
  );
};

/* ------------------------------------------------------------------ */

const ClientCard = ({ client, canManage, expanded, onToggle, onEdit, onDelete }) => {
  const status = clientStatusMeta(client.status);
  const country = client.country ? countryMeta(client.country) : null;
  const projectsTotal = Number(client.projects_total || 0);

  return (
    <article className="admin-card admin-card-hover flex min-w-0 flex-col p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-500 text-sm font-extrabold text-white">
          {initials(client.business_name, "C")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[15px] font-semibold text-slate-900">
            {client.business_name || "Cliente sin nombre"}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {client.status ? (
              <Badge tone={status.tone} dot>{status.label}</Badge>
            ) : (
              <Badge tone="slate">{client.source === "project" ? "Desde proyecto" : status.label}</Badge>
            )}
            {client.client_type && <Badge tone="sky">{clientTypeLabel(client.client_type)}</Badge>}
            {country && <Badge tone="slate">{country.label}</Badge>}
          </div>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="subtle"
              title={`Editar ${client.business_name}`}
              aria-label={`Editar ${client.business_name}`}
              onClick={onEdit}
            >
              <FiEdit2 />
            </Button>
            <Button
              variant="subtle"
              tone="red"
              title={`Eliminar ${client.business_name}`}
              aria-label={`Eliminar ${client.business_name}`}
              onClick={onDelete}
            >
              <FiTrash2 />
            </Button>
          </div>
        ) : (
          <Badge tone="amber">Solo lectura</Badge>
        )}
      </div>

      {client.tax_id && (
        <p className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <FiHash className="shrink-0 text-slate-400" />
          <span className="truncate font-semibold tracking-wide text-slate-600">{client.tax_id}</span>
          <span className="ml-auto shrink-0 text-slate-400">ID fiscal</span>
        </p>
      )}

      <div className="mt-3 space-y-1.5 text-[13px]">
        {client.contact_name && (
          <p className="flex min-w-0 items-center gap-1.5 text-slate-600">
            <FiUser className="shrink-0 text-slate-300" />
            <span className="truncate">{client.contact_name}</span>
          </p>
        )}
        {client.email ? (
          <a href={`mailto:${client.email}`} className="flex min-w-0 items-center gap-1.5 text-slate-500 hover:text-brand-600">
            <FiMail className="shrink-0 text-slate-300" />
            <span className="truncate">{client.email}</span>
          </a>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><FiSlash className="shrink-0" /> Sin correo</p>
        )}
        {client.phone ? (
          <a href={`tel:${client.phone}`} className="flex min-w-0 items-center gap-1.5 text-slate-500 hover:text-brand-600">
            <FiPhone className="shrink-0 text-slate-300" />
            <span className="truncate">{client.phone}</span>
          </a>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><FiSlash className="shrink-0" /> Sin teléfono</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Proyectos</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">{projectsTotal}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Activos</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">{client.active_projects || 0}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Valor</dt>
          <dd className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-800" title={formatCurrency(client.budget)}>
            {formatCurrency(client.budget)}
          </dd>
        </div>
      </dl>

      {client.projects.length > 0 ? (
        <>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {expanded ? "Ocultar proyectos" : `Ver ${client.projects.length} proyecto${client.projects.length === 1 ? "" : "s"}`}
            <FiChevronDown className={cx("transition", expanded && "rotate-180")} />
          </button>
          {projectsTotal > client.projects.length && (
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              El API reporta {projectsTotal} proyectos; se listan {client.projects.length} vinculados.
            </p>
          )}
        </>
      ) : projectsTotal > 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-2 text-center text-[13px] text-slate-400">
          {projectsTotal} proyecto{projectsTotal === 1 ? "" : "s"} registrado{projectsTotal === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-2 text-center text-[13px] text-slate-400">
          Sin proyectos vinculados
        </p>
      )}

      {expanded && client.projects.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {client.projects.map((project) => (
            <li key={project.id ?? project.name}>
              <Link
                to={`/admin/projects/${project.id}`}
                className="block rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {project.name || "Proyecto sin nombre"}
                  </p>
                  <Badge tone={projectStatusMeta(project.status).tone}>
                    {projectStatusMeta(project.status).label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Entrega: {project.end_date ? formatDate(project.end_date) : "Sin fecha"}
                  {Number(project.budget) > 0 && ` · ${formatCurrency(project.budget)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

export default Clients;
