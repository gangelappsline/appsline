/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch, FiUserPlus, FiX } from "react-icons/fi";
import Avatar, { AvatarStack } from "./Avatar";
import { cx } from "../../utils/format";
import { uniqueIds } from "../../utils/assignees";

/**
 * Selector de varias personas (responsables de una tarea).
 *
 * - `value` es un arreglo de ids; `onChange` recibe el arreglo nuevo.
 * - Muestra chips con avatar y permite buscar en la lista desplegable.
 * - `compact` lo pinta como una pila de avatares (para el detalle de tarea).
 *
 * @example
 * <UserMultiSelect users={users} value={draft.assignees} onChange={(ids) => ...} />
 */
const UserMultiSelect = ({
  users = [],
  value = [],
  onChange,
  placeholder = "Sin asignar",
  compact = false,
  disabled = false,
  max = null,
  className = "",
  ariaLabel = "Personas asignadas",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const ids = useMemo(() => uniqueIds(value), [value]);
  const selected = useMemo(
    () =>
      ids.map(
        (id) =>
          users.find((u) => String(u.id) === String(id)) || {
            id,
            name: `Usuario ${id}`,
          },
      ),
    [ids, users],
  );

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((u) => {
      if (!term) return true;
      return `${u.name || ""} ${u.email || ""} ${u.role || ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [users, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
    }
  }, [open]);

  const isSelected = (id) => ids.some((known) => String(known) === String(id));

  const toggle = (id) => {
    if (disabled) return;
    if (isSelected(id)) {
      onChange?.(ids.filter((known) => String(known) !== String(id)));
    } else {
      if (max && ids.length >= max) return;
      onChange?.([...ids, id]);
    }
  };

  const remove = (id, event) => {
    event?.stopPropagation();
    if (disabled) return;
    onChange?.(ids.filter((known) => String(known) !== String(id)));
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(options.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[cursor];
      if (option) toggle(option.id);
    } else if (e.key === "Backspace" && !query && ids.length) {
      remove(ids[ids.length - 1]);
    }
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          compact
            ? "flex items-center gap-2 rounded-lg border border-transparent bg-slate-50 px-2 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-white"
            : "admin-input flex min-h-[42px] w-full flex-wrap items-center gap-1.5 !py-1.5 text-left",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {compact ? (
          <>
            {selected.length ? (
              <>
                <AvatarStack users={selected} max={4} size="xs" />
                <span className="max-w-[160px] truncate">
                  {selected.length === 1
                    ? selected[0].name
                    : `${selected.length} personas`}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400">
                <FiUserPlus /> {placeholder}
              </span>
            )}
            <FiChevronDown className="text-slate-400" />
          </>
        ) : (
          <>
            {selected.length === 0 && (
              <span className="text-slate-400">{placeholder}</span>
            )}
            {selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 py-0.5 pl-0.5 pr-1.5 text-xs font-semibold text-brand-700"
              >
                <Avatar user={u} size="xs" />
                <span className="truncate">{u.name}</span>
                {!disabled && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Quitar a ${u.name}`}
                    onClick={(e) => remove(u.id, e)}
                    className="rounded-full p-0.5 text-brand-500 transition hover:bg-brand-100 hover:text-brand-800"
                  >
                    <FiX className="text-[11px]" />
                  </span>
                )}
              </span>
            ))}
            <FiChevronDown
              className={cx(
                "ml-auto shrink-0 text-slate-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 z-40 mt-1.5 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-lg"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <FiSearch className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar persona..."
              aria-label="Buscar persona"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {ids.length > 0 && (
              <button
                type="button"
                onClick={() => onChange?.([])}
                className="shrink-0 text-[11px] font-semibold text-slate-400 hover:text-red-600"
              >
                Limpiar
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {options.map((u, index) => {
              const active = isSelected(u.id);
              const blocked = !active && max && ids.length >= max;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={blocked}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => toggle(u.id)}
                    className={cx(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
                      cursor === index ? "bg-slate-50" : "",
                      active ? "text-brand-700" : "text-slate-700",
                      blocked && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Avatar user={u} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name}</span>
                      {(u.email || u.role) && (
                        <span className="block truncate text-[11px] text-slate-400">
                          {u.role ? `${u.role} · ` : ""}
                          {u.email || ""}
                        </span>
                      )}
                    </span>
                    <span
                      className={cx(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px]",
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-300 text-transparent",
                      )}
                    >
                      <FiCheck />
                    </span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-400">
                Sin resultados
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-400">
            <span>
              {ids.length} seleccionada{ids.length === 1 ? "" : "s"}
              {max ? ` · máx. ${max}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-semibold text-brand-600 hover:text-brand-800"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMultiSelect;
