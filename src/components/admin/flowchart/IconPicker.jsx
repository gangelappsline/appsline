/* eslint-disable react/prop-types */
import { useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { NODE_ICONS } from "./icons";
import { cx } from "../../../utils/format";

const searchable = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** El catálogo es el mismo para iconos independientes e iconos dentro de formas. */
const IconPicker = ({ value = "", onChange, allowNone = false, inserting = false }) => {
  const [query, setQuery] = useState("");
  const icons = NODE_ICONS.filter((icon) => searchable(`${icon.label} ${icon.key}`).includes(searchable(query.trim())));
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-400">
        <FiSearch className="shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar icono…"
          aria-label="Buscar icono"
          className="min-w-0 w-full bg-transparent text-xs text-slate-700 outline-none"
        />
      </label>
      {allowNone && (
        <button type="button" onClick={() => onChange("")} aria-pressed={!value} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <FiX /> Sin icono
        </button>
      )}
      <div className={cx("thin-scroll grid grid-cols-4 gap-1.5 overflow-y-auto pr-1", inserting ? "max-h-[420px]" : "max-h-48")}>
        {icons.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={`${inserting ? "Insertar" : "Elegir"} icono ${label}`}
            aria-pressed={inserting ? undefined : value === key}
            onClick={() => onChange(key)}
            className={cx(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-slate-600 transition focus-visible:outline-brand-500",
              value === key ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/50",
            )}
          >
            <Icon className="text-xl" aria-hidden="true" />
            <span className="w-full truncate text-[9px]">{label}</span>
          </button>
        ))}
      </div>
      {!icons.length && <p className="py-3 text-center text-xs text-slate-400">No se encontraron iconos.</p>}
    </div>
  );
};

export default IconPicker;
