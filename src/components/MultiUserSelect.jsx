import { useEffect, useMemo, useState } from "react";

const MultiUserSelect = ({ value = [], onChange, label = "Asignar a", disabled = false }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("user_token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error fetching users");
        const data = await res.json();
        // Ajusta al shape real de tu API:
        const list = Array.isArray(data.data) ? data.data : data.data?.users || data.users || [];
        setUsers(list);
      } catch (e) {
        setError("No se pudieron cargar los usuarios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      u =>
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    );
  }, [q, users]);

  const toggle = (id) => {
    if (!onChange) return;
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const clearAll = () => onChange?.([]);

  const removeOne = (id) => onChange?.(value.filter(v => v !== id));

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {/* Chips seleccionados */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((id) => {
            const u = users.find(x => x.id === id);
            const text = u ? `${u.name || u.email || id}` : id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
              >
                {text}
                <button
                  type="button"
                  className="text-brand-400 transition hover:text-brand-700"
                  onClick={() => removeOne(id)}
                  disabled={disabled}
                  aria-label={`Quitar ${text}`}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
            onClick={clearAll}
            disabled={disabled}
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Buscador */}
      <input
        type="text"
        className="admin-input mb-2"
        placeholder="Buscar por nombre o email..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled || loading}
      />

      {/* Lista con checkboxes */}
      <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-gray-500">Cargando usuarios...</div>
        ) : error ? (
          <div className="p-3 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">Sin resultados</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((u) => {
              const id = u.id; // ajusta si tu API usa otra clave
              const checked = value.includes(id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                      checked={checked}
                      onChange={() => toggle(id)}
                      disabled={disabled}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">
                        {u.name || u.email || `Usuario ${id}`}
                      </div>
                      {u.email && (
                        <div className="text-xs text-gray-500">{u.email}</div>
                      )}
                    </div>
                    {u.role && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {u.role}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MultiUserSelect;