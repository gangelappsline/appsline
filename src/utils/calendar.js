/**
 * Utilidades de calendario compartidas por la vista mensual
 * (`components/admin/MonthGrid.jsx`) y las páginas que la usan
 * (Calendario global y pestaña Calendario del proyecto).
 */

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Convierte fechas del API (ISO, "YYYY-MM-DD", timestamps) o un `Date`
 * en la clave de día que usa el calendario: "2026-10-14".
 */
export const dayKey = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`;
  }
  const raw = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return dayKey(new Date(raw));
};

/** Date a medianoche local a partir de una clave de día ("2026-10-14"). */
export const dateFromKey = (key) => {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

/** Primer día del mes al que pertenece la fecha (o el mes actual). */
export const firstOfMonth = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/** Mes desplazado `delta` meses (siempre día 1). */
export const addMonths = (value, delta) =>
  new Date(value.getFullYear(), value.getMonth() + delta, 1);

/** ¿La fecha cae en el mismo mes/año que `reference`? */
export const isSameMonth = (value, reference) => {
  const key = dayKey(value);
  return Boolean(key) && key.slice(0, 7) === dayKey(reference).slice(0, 7);
};

/** "Octubre 2026". */
export const monthLabel = (value) => {
  const date = firstOfMonth(value);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Celdas del mes (semanas de lunes a domingo) con `null` en los huecos.
 * @returns {Array<Date|null>}
 */
export const calendarCells = (cursor) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

/**
 * Tonos de los eventos del calendario (chips por día y puntos en móvil).
 * Las claves coinciden con las de `Badge`/`taskStatusMeta` para poder pasar
 * el tono del estado de una tarea tal cual.
 */
export const EVENT_TONES = {
  brand: {
    chip: "bg-brand-50 text-brand-700 ring-brand-100",
    dot: "bg-brand-500",
    accent: "border-brand-500 bg-brand-50/60 ring-2 ring-brand-200",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 ring-violet-100",
    dot: "bg-violet-500",
    accent: "border-violet-500 bg-violet-50/60 ring-2 ring-violet-200",
  },
  sky: {
    chip: "bg-sky-50 text-sky-700 ring-sky-100",
    dot: "bg-sky-500",
    accent: "border-sky-500 bg-sky-50/60 ring-2 ring-sky-200",
  },
  green: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
    accent: "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700 ring-amber-100",
    dot: "bg-amber-500",
    accent: "border-amber-500 bg-amber-50/60 ring-2 ring-amber-200",
  },
  red: {
    chip: "bg-red-50 text-red-700 ring-red-100",
    dot: "bg-red-500",
    accent: "border-red-500 bg-red-50/60 ring-2 ring-red-200",
  },
  slate: {
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    accent: "border-slate-400 bg-slate-50 ring-2 ring-slate-200",
  },
};

export const eventTone = (tone) => EVENT_TONES[tone] || EVENT_TONES.brand;
