/* eslint-disable react/prop-types */
import { useId } from "react";
import { FiChevronDown } from "react-icons/fi";
import { cx } from "../../utils/format";

/** Resumen accesible: el contenido oculto sale también de la navegación por teclado. */
export default function CollapsibleSection({ title, summary, open, onToggle, children, className = "" }) {
  const id = useId();
  return (
    <section className={cx("min-w-0", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-sm transition hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <FiChevronDown aria-hidden="true" className={cx("shrink-0 text-slate-400 transition-transform", !open && "-rotate-90")} />
        <span className="font-semibold text-slate-700">{title}</span>
        {summary && <span className="ml-auto min-w-0 truncate text-xs text-slate-500">{summary}</span>}
        <span className="hidden text-xs font-medium text-brand-600 sm:inline">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      <div id={id} hidden={!open}>
        <div className="pt-2">{children}</div>
      </div>
    </section>
  );
}
