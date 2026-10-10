/**
 * Utilidades de formato compartidas por todo el panel administrativo.
 * Centralizar esto evita duplicar lógica en cada página y facilita
 * cambiar formatos (moneda, fechas, etiquetas) en un solo lugar.
 */

/** Une clases CSS ignorando valores falsy. */
export const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Iniciales de un nombre ("Ana María" -> "AM"). */
export const initials = (name = "", fallback = "?") => {
  const clean = String(name || "").trim();
  if (!clean) return fallback;
  return (
    clean
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || fallback
  );
};

/** Moneda (por defecto MXN, formato es-MX). */
export const formatCurrency = (value, currency = "MXN") => {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
  } catch {
    return `$${num.toLocaleString("es-MX")}`;
  }
};

/** Número con separadores de miles. */
export const formatNumber = (value) =>
  Number(value || 0).toLocaleString("es-MX");

/** Fecha corta: "12 ene 2026". Acepta ISO, timestamps y objetos Date. */
export const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date =
    value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "");
};

/** Fecha + hora: "12 ene 2026, 14:30". */
export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Tiempo relativo: "hace 3 días", "en 2 semanas". */
export const timeAgo = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffDays = Math.round((Date.now() - date.getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(diffDays) < 1) return "hoy";
  if (Math.abs(diffDays) < 7) return rtf.format(-diffDays, "day");
  if (Math.abs(diffDays) < 30) return rtf.format(-Math.round(diffDays / 7), "week");
  if (Math.abs(diffDays) < 365) return rtf.format(-Math.round(diffDays / 30), "month");
  return rtf.format(-Math.round(diffDays / 365), "year");
};

/** ¿La fecha ya pasó? (compara solo día, no hora). */
export const isOverdue = (value) => {
  if (!value) return false;
  const due = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};

/** ¿La fecha es dentro de los próximos `days` días (incluye hoy)? */
export const isDueWithin = (value, days = 7) => {
  if (!value) return false;
  const due = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return due >= today && due <= limit;
};

/* ------------------------------------------------------------------ */
/* Metadatos de estados, prioridades y roles                            */
/* ------------------------------------------------------------------ */

export const TASK_STATUS = {
  pending: { label: "Pendiente", tone: "violet" },
  in_progress: { label: "En progreso", tone: "sky" },
  completed: { label: "Finalizada", tone: "green" },
  rejected: { label: "Rechazada", tone: "red" },
};

export const taskStatusMeta = (status) =>
  TASK_STATUS[status] || { label: status || "Sin estado", tone: "slate" };

export const PROJECT_STATUS = {
  active: { label: "En curso", tone: "green" },
  pending: { label: "Pendiente", tone: "violet" },
  in_progress: { label: "En progreso", tone: "sky" },
  completed: { label: "Finalizado", tone: "slate" },
  finished: { label: "Finalizado", tone: "slate" },
  finalizado: { label: "Finalizado", tone: "slate" },
  rejected: { label: "Rechazado", tone: "red" },
};

export const projectStatusMeta = (status) =>
  PROJECT_STATUS[status] || PROJECT_STATUS.active;

export const PRIORITY_META = {
  high: { label: "Alta", dot: "bg-red-500", text: "text-red-600" },
  medium: { label: "Media", dot: "bg-amber-400", text: "text-amber-600" },
  low: { label: "Baja", dot: "bg-sky-500", text: "text-sky-600" },
};

export const priorityMeta = (priority) =>
  PRIORITY_META[priority] || { label: "Normal", dot: "bg-slate-300", text: "text-slate-500" };

export const ROLE_LABELS = {
  administrator: "Administrador",
  dev: "Desarrollador",
  client: "Cliente",
};

export const roleLabel = (role) => ROLE_LABELS[role] || role || "—";

export const ROLE_TONES = {
  administrator: "violet",
  dev: "brand",
  client: "slate",
};

export const roleTone = (role) => ROLE_TONES[role] || "slate";

/** Progreso de un proyecto (0-100) a partir de sus contadores. */
export const projectProgress = (project = {}) => {
  if (typeof project.progress === "number") return Math.max(0, Math.min(100, project.progress));
  const total = Number(project.tasks_count || 0);
  if (!total) return 0;
  const done = Number(project.completed_tasks || 0);
  return Math.round((done / total) * 100);
};

/** Descarga un CSV generado en el cliente (para exportaciones). */
export const downloadCsv = (filename, rows) => {
  if (!rows?.length) return;
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
