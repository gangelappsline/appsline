/**
 * Metadatos y normalizadores de clientes.
 *
 * El backend puede responder un cliente "plano" (`contact_name`, `email`…)
 * o anidado (`contact: { name, email, phone }`), y aceptar además el país
 * como string ("MX") o como objeto ({ code, name }). Este módulo concentra
 * esa lectura para que las páginas solo consuman la forma normalizada:
 *
 *   { id, business_name, tax_id, contact_name, email, phone,
 *     status, client_type, country, country_label, projects_count, created_at }
 */

/* ------------------------------------------------------------------ */
/* Catálogos (valores que acepta la API de clientes)                    */
/* ------------------------------------------------------------------ */

export const CLIENT_STATUSES = [
  { value: "prospect", label: "Prospecto", tone: "violet" },
  { value: "active", label: "Activo", tone: "green" },
  { value: "inactive", label: "Inactivo", tone: "slate" },
  { value: "archived", label: "Archivado", tone: "amber" },
];

/** Etiqueta + tono de un estado; tolera estados nuevos del backend. */
export const clientStatusMeta = (status) => {
  const value = String(status || "").trim().toLowerCase();
  const found = CLIENT_STATUSES.find((item) => item.value === value);
  if (found) return found;
  if (!value) return { value: "", label: "Sin estado", tone: "slate" };
  return { value, label: value.charAt(0).toUpperCase() + value.slice(1), tone: "slate" };
};

export const CLIENT_TYPES = [
  { value: "company", label: "Empresa" },
  { value: "individual", label: "Persona física" },
];

/** Etiqueta legible de un tipo de cliente. */
export const clientTypeLabel = (type) => {
  const value = String(type || "").trim().toLowerCase();
  const found = CLIENT_TYPES.find((item) => item.value === value);
  if (found) return found.label;
  if (!value) return "Sin tipo";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

/** Catálogo corto de países frecuentes (ISO-3166 alfa-2). */
export const COUNTRIES = [
  { code: "MX", label: "México" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "ES", label: "España" },
  { code: "AR", label: "Argentina" },
  { code: "BO", label: "Bolivia" },
  { code: "BR", label: "Brasil" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colombia" },
  { code: "CR", label: "Costa Rica" },
  { code: "CU", label: "Cuba" },
  { code: "DO", label: "República Dominicana" },
  { code: "EC", label: "Ecuador" },
  { code: "SV", label: "El Salvador" },
  { code: "GT", label: "Guatemala" },
  { code: "HN", label: "Honduras" },
  { code: "NI", label: "Nicaragua" },
  { code: "PA", label: "Panamá" },
  { code: "PY", label: "Paraguay" },
  { code: "PE", label: "Perú" },
  { code: "PR", label: "Puerto Rico" },
  { code: "UY", label: "Uruguay" },
  { code: "VE", label: "Venezuela" },
];

/**
 * Código ISO (lo que enviamos a la API) y etiqueta (lo que mostramos) de un país.
 * Acepta "MX", "mx", "México" o { code, name }.
 */
export const countryMeta = (country) => {
  const raw = country && typeof country === "object"
    ? country.code ?? country.iso ?? country.iso_code ?? country.value ?? country.name ?? ""
    : country;
  const value = String(raw || "").trim();
  if (!value) return { code: "", label: "Sin país" };

  const upper = value.toUpperCase();
  const byCode = COUNTRIES.find((item) => item.code === upper);
  if (byCode) return byCode;

  const byLabel = COUNTRIES.find(
    (item) => item.label.toLowerCase() === value.toLowerCase()
  );
  if (byLabel) return byLabel;

  return { code: value, label: value.length <= 3 ? upper : value };
};

/** ¿El país recibido está en el catálogo? (para elegir la opción del <select>). */
export const countrySelectValue = (country) => {
  const { code } = countryMeta(country);
  return COUNTRIES.some((item) => item.code === code) ? code : "";
};

/* ------------------------------------------------------------------ */
/* Normalizadores                                                      */
/* ------------------------------------------------------------------ */

/** Primer valor con contenido (ignora null, undefined, "" y "null"). */
const firstFilled = (...values) =>
  values.find((value) => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text !== "" && text.toLowerCase() !== "null";
  });

const text = (...values) => String(firstFilled(...values) ?? "").trim();

/** Convierte a número entero seguro (para contadores). */
const int = (...values) => {
  const value = Number(firstFilled(...values) ?? 0);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Normaliza un cliente (lista, detalle o creado) a una forma única.
 * @returns {{id, business_name, tax_id, contact_name, email, phone, status, client_type, country, country_code, projects_count, created_at, raw}}
 */
export const readClientFields = (client = {}) => {
  const source = client && typeof client === "object" ? client : {};
  const contact =
    source.contact && typeof source.contact === "object" && !Array.isArray(source.contact)
      ? source.contact
      : {};
  // El conteo puede venir como projects_count (with_projects_count=1)
  // o como el arreglo de proyectos anidado.
  const nestedProjects = Array.isArray(source.projects)
    ? source.projects.length
    : undefined;

  const country = countryMeta(source.country?.code ?? source.country);

  return {
    id: source.id ?? source.client_id ?? source.uuid ?? null,
    business_name: text(
      source.business_name,
      source.company_name,
      source.business,
      source.name,
      source.full_name
    ),
    tax_id: text(
      source.tax_id,
      source.tax_identifier,
      source.tax_number,
      source.rfc,
      source.vat_number,
      source.nit
    ),
    contact_name: text(
      source.contact_name,
      contact.name,
      contact.full_name,
      source.contact_person,
      source.contact_full_name
    ),
    email: text(
      source.email,
      contact.email,
      source.contact_email,
      source.email_address
    ),
    phone: text(
      source.phone,
      contact.phone,
      contact.phone_number,
      source.phone_number,
      source.contact_phone
    ),
    status: text(source.status, source.state).toLowerCase(),
    client_type: text(source.client_type, source.type, source.kind).toLowerCase(),
    country: country.code,
    country_label: country.label,
    projects_count: int(
      source.projects_count,
      source.projectsCount,
      source.projects_total,
      nestedProjects
    ),
    created_at: firstFilled(source.created_at, source.created, source.inserted_at) ?? null,
    raw: source,
  };
};

/** Nombre visible de un cliente (razón social → contacto → correo). */
export const clientDisplayName = (client = {}) => {
  const fields = client.business_name !== undefined ? client : readClientFields(client);
  return (
    fields.business_name ||
    fields.contact_name ||
    fields.email ||
    "Cliente sin nombre"
  );
};

/** ¿El correo tiene forma válida? (validación suave previa al envío) */
export const isValidEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value).trim());

/**
 * Clave única para listas: id del backend o, en su defecto, correo/nombre.
 */
export const clientKey = (fields) =>
  fields.id !== null && fields.id !== undefined
    ? `client-${fields.id}`
    : `client-${(fields.email || fields.business_name || "sin-identificador").toLowerCase()}`;

/* ------------------------------------------------------------------ */
/* Vínculo con proyectos                                               */
/* ------------------------------------------------------------------ */

const FINISHED_STATUSES = ["completed", "finished", "finalizado", "rejected", "cancelado", "cancelled"];

/** ¿El proyecto sigue activo? (no está finalizado ni rechazado) */
export const isActiveProject = (project = {}) =>
  !FINISHED_STATUSES.includes(String(project.status || "").toLowerCase());

/** Datos del cliente tal como vienen embebidos en un proyecto. */
export const readProjectClientFields = (project = {}) => {
  const related =
    project.client && typeof project.client === "object" && !Array.isArray(project.client)
      ? project.client
      : {};
  return {
    id: project.client_id ?? project.clientId ?? related.id ?? null,
    business_name: text(project.client_name, related.business_name, related.name),
    email: text(project.client_email, related.email),
    phone: text(project.client_phone, related.phone),
  };
};

/**
 * ¿El proyecto pertenece al cliente? Compara por id, correo y, en última
 * instancia, por nombre (los proyectos viejos solo guardan el nombre).
 */
export const projectBelongsToClient = (project, client) => {
  const projectClient = readProjectClientFields(project);
  if (projectClient.id != null && client.id != null) {
    return String(projectClient.id) === String(client.id);
  }

  const projectEmail = projectClient.email.toLowerCase();
  const clientEmail = String(client.email || "").toLowerCase();
  if (projectEmail && clientEmail) return projectEmail === clientEmail;

  const projectName = projectClient.business_name.toLowerCase();
  const clientName = String(client.business_name || "").toLowerCase();
  return Boolean(projectName && clientName && projectName === clientName);
};

/** Proyectos del cliente + métricas derivadas (activos y presupuesto). */
export const linkProjects = (projects = [], client = {}) => {
  const linked = projects.filter((project) => projectBelongsToClient(project, client));
  return {
    projects: linked,
    active_projects: linked.filter(isActiveProject).length,
    budget: linked.reduce((sum, project) => sum + Number(project.budget || 0), 0),
  };
};

/** Ordena una lista de clientes normalizados por razón social. */
export const byBusinessName = (a, b) =>
  (a.business_name || a.contact_name || "").localeCompare(
    b.business_name || b.contact_name || "",
    "es",
    { sensitivity: "base" }
  );

/* ------------------------------------------------------------------ */
/* Respaldo: clientes derivados de los proyectos                        */
/* ------------------------------------------------------------------ */

/**
 * Modo de solo lectura cuando la API `/clients` no está disponible:
 * agrupa los contactos embebidos en los proyectos para no dejar la
 * pantalla vacía.
 */
export const clientsFromProjects = (projects = []) => {
  const groups = new Map();
  let orphanCount = 0;

  projects.forEach((project) => {
    const fields = readProjectClientFields(project);
    const identity = (fields.email || fields.business_name).toLowerCase();
    if (!identity) {
      orphanCount += 1;
      return;
    }

    if (!groups.has(identity)) {
      groups.set(identity, {
        id: fields.id,
        business_name: fields.business_name || fields.email || "Cliente",
        contact_name: "",
        email: fields.email,
        phone: fields.phone,
        status: "",
        client_type: "",
        country: "",
        projects: [],
      });
    }

    const group = groups.get(identity);
    group.projects.push(project);
    if (!group.id && fields.id != null) group.id = fields.id;
    if (!group.email && fields.email) group.email = fields.email;
    if (!group.phone && fields.phone) group.phone = fields.phone;
    if ((!group.business_name || group.business_name === group.email) && fields.business_name) {
      group.business_name = fields.business_name;
    }
  });

  const clients = [...groups.entries()].map(([identity, client]) => ({
    ...client,
    key: `project-${identity}`,
    source: "project",
    projects_count: client.projects.length,
    active_projects: client.projects.filter(isActiveProject).length,
    budget: client.projects.reduce((sum, project) => sum + Number(project.budget || 0), 0),
  }));

  clients.sort((a, b) => b.budget - a.budget || byBusinessName(a, b));
  return { clients, orphanCount };
};
