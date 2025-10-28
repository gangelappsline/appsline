import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Obtiene token desde localStorage (acepta user_token o token)
function getAuthToken() {
  return (
    localStorage.getItem("user_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

export default function UserSelect({
  value = "",
  onChange,
  label = "Asignar usuario",
  disabled = false,
  placeholder = "Seleccionar usuario",
  idField = "id",
  nameField = "name",
  emailField = "email",
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/users`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`GET /users ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.users)
          ? data.users
          : Array.isArray(data?.data?.users)
          ? data.data.users
          : [];
        if (!aborted) setUsers(list);
      } catch (e) {
        if (!aborted) {
          setUsers([]);
          setErr("No se pudieron cargar los usuarios");
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, []);

  const handleChange = (e) => onChange?.(e.target.value);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two bg-white text-gray-800 disabled:opacity-60"
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled || loading}
      >
        <option value="">{loading ? "Cargando..." : placeholder}</option>
        {users.map((u) => {
          const id = u?.[idField];
          const name = u?.[nameField] || u?.[emailField] || `Usuario #${id}`;
          return (
            <option key={id} value={id}>
              {name}
            </option>
          );
        })}
      </select>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}