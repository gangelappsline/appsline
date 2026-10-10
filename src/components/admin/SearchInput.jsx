/* eslint-disable react/prop-types */
import { FiSearch, FiX } from "react-icons/fi";
import { cx } from "../../utils/format";

/** Campo de búsqueda con icono y botón para limpiar. */
const SearchInput = ({
  value,
  onChange,
  placeholder = "Buscar...",
  className = "",
  inputClassName = "",
}) => (
  <div className={cx("relative", className)}>
    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={cx("admin-input pl-10", value && "pr-9", inputClassName)}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange?.("")}
        aria-label="Limpiar búsqueda"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <FiX />
      </button>
    )}
  </div>
);

export default SearchInput;
