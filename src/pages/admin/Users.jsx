import { useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import LayoutAdmin from "../../layouts/LayoutAdmin";

const roles = [
  { key: "administrator", label: "Administrador" },
  { key: "dev", label: "Desarrollador" },
  { key: "client", label: "Cliente" },
];

const API_BASE = import.meta.env.VITE_API_URL;
const USERS_URL = `${API_BASE}/users`; // usar /api/users
const IMAGE_FIELD = "avatar"; // cambia a "image" si tu API lo espera

// Utilidad: obtiene la imagen del usuario o genera fallback con ui-avatars
const getUserAvatar = (user) => {
  const src = user?.avatar || user?.image || user?.photo || "";
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user?.name || user?.email || "Usuario"
  )}`;
  return src && src !== "null" ? src : fallback;
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [adding, setAdding] = useState(false);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "client",
    password: "", // agregado para evitar undefined
  });

  // Nuevo estado para imagen (crear)
  const [addAvatarFile, setAddAvatarFile] = useState(null);
  const [addAvatarPreview, setAddAvatarPreview] = useState("");

  // Nuevo estado para imagen (editar)
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("user_token");
        const res = await fetch(USERS_URL, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Fetch users failed");
        const data = await res.json();
        setUsers(Array.isArray(data.data) ? data.data : data.data?.users || data.users || []);
      } catch (err) {
        setError("Error loading users");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Manejadores de archivo
  const handleAddImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddAvatarFile(file);
    setAddAvatarPreview(URL.createObjectURL(file));
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  // Filtrar usuarios por nombre o email
  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Agregar nuevo usuario
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("user_token");

      const form = new FormData();
      form.append("name", newUser.name);
      form.append("email", newUser.email);
      form.append("role", newUser.role);
      if (newUser.password) form.append("password", newUser.password);
      if (addAvatarFile) {
        form.append(IMAGE_FIELD, addAvatarFile); // campo de imagen
      }

      if (import.meta.env.DEV) {
        // Verifica en consola que el archivo viaje
        for (const [k, v] of form.entries()) {
          console.log(k, v instanceof File ? `File(${v.name}, ${v.type}, ${v.size}b)` : v);
        }
      }

      const res = await fetch(USERS_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error creating user");
      }
      const data = await res.json().catch(() => ({}));
      const created = data.data || data;
      setUsers((prev) => [created, ...prev]);

      // Reset
      setNewUser({ name: "", email: "", role: "client", password: "" });
      if (addAvatarPreview) URL.revokeObjectURL(addAvatarPreview);
      setAddAvatarFile(null);
      setAddAvatarPreview("");
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      setError("Error adding user");
    } finally {
      setAdding(false);
    }
  };

  // Editar usuario (cargar datos y preview)
  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUser({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
    // Fallback si no hay imagen
    setEditAvatarPreview(getUserAvatar(user));
    setEditAvatarFile(null);
    setShowEdit(true);
  };

  // Actualizar usuario (con imagen)
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("user_token");

      const form = new FormData();
      form.append("name", newUser.name);
      form.append("email", newUser.email);
      form.append("role", newUser.role);
      if (newUser.password) form.append("password", newUser.password);
      if (editAvatarFile) {
        form.append(IMAGE_FIELD, editAvatarFile); // campo de imagen
      }

      // Muchas APIs requieren override para multipart update
      //form.append("_method", "PUT");

      if (import.meta.env.DEV) {
        for (const [k, v] of form.entries()) {
          console.log(k, v instanceof File ? `File(${v.name}, ${v.type}, ${v.size}b)` : v);
        }
      }

      const res = await fetch(`${USERS_URL}/${editingUser.id}`, {
        method: "PUT", // override con _method=PUT
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error updating user");
      }

      const data = await res.json().catch(() => ({}));
      const updated = data.data || data;

      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));

      setShowEdit(false);
      setEditingUser(null);
      if (editAvatarPreview && editAvatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(editAvatarPreview);
      }
      setEditAvatarFile(null);
      setEditAvatarPreview("");
      setNewUser({ name: "", email: "", role: "client", password: "" });
    } catch (err) {
      console.error(err);
      setError("Error updating user");
    } finally {
      setAdding(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;
    try {
      const token = localStorage.getItem("user_token");
      await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError("Error deleting user");
    }
  };

  return (
    <LayoutAdmin
      title="Usuarios"
      subtitle="Gestiona las cuentas y roles del equipo"
      actions={
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          + Agregar usuario
        </button>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="admin-card overflow-hidden"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            placeholder="Buscar por nombre o email..."
            className="admin-input sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-slate-500">
            {filteredUsers.length} usuario{filteredUsers.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-600">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center">
            <p className="font-medium text-slate-700">
              {search ? "Sin resultados" : "No hay usuarios registrados"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search
                ? "Prueba con otro nombre o correo."
                : "Agrega el primer usuario para comenzar."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-6 py-3.5">ID</th>
                  {/* Nueva columna Foto */}
                  <th className="px-6 py-3.5">Foto</th>
                  <th className="px-6 py-3.5">Nombre</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filteredUsers.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-slate-400 tabular-nums">{user.id}</td>
                      {/* Celda de foto con fallback */}
                      <td className="px-6 py-4">
                        <img
                          src={getUserAvatar(user)}
                          alt={`Avatar de ${user.name || user.email || user.id}`}
                          className="h-10 w-10 rounded-full border border-slate-200 bg-white object-cover"
                          onError={(e) => {
                            const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              user?.name || user?.email || "Usuario"
                            )}`;
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallback;
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{user.name}</td>
                      <td className="px-6 py-4 text-slate-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="badge-slate">
                          {roles.find((role) => role.key === user.role)?.label || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Modal para agregar usuario */}
      <Transition appear show={showAdd} as={motion.div}>
        <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setShowAdd(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            />
            <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="my-8 inline-block w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left align-middle shadow-card-lg transition-all"
            >
              <Dialog.Title as="h2" className="mb-5 text-lg font-semibold text-slate-900">
                Agregar Nuevo Usuario
              </Dialog.Title>
              <form onSubmit={handleAddUser} className="flex flex-col gap-4">
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Nombre"
                  className="admin-input"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  disabled={adding}
                  autoFocus
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="email"
                  placeholder="Email"
                  className="admin-input"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                  disabled={adding}
                >
                  {roles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </motion.select>

                {/* Imagen (crear) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAddImageChange}
                    disabled={adding}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800"
                  />
                  {addAvatarPreview && (
                    <img src={addAvatarPreview} alt="Preview" className="mt-3 h-20 w-20 rounded-full object-cover border" />
                  )}
                </div>

                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Password"
                  className="admin-input"
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  disabled={adding}
                />

                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="btn-primary"
                    disabled={adding}
                  >
                    {adding ? "Agregando..." : "Agregar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAdd(false)}
                    disabled={adding}
                  >
                    Cancelar
                  </motion.button>
                </div>
              </form>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Modal para editar usuario */}
      <Transition appear show={showEdit} as={motion.div}>
        <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setShowEdit(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            />
            <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
            <Transition.Child
              as={motion.div}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="my-8 inline-block w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left align-middle shadow-card-lg transition-all"
            >
              <Dialog.Title as="h2" className="mb-5 text-lg font-semibold text-slate-900">
                Editar Usuario
              </Dialog.Title>
              <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Nombre"
                  className="admin-input"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  disabled={adding}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="email"
                  placeholder="Email"
                  className="admin-input"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="admin-input"
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                  disabled={adding}
                >
                  {roles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </motion.select>

                {/* Imagen (editar) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageChange}
                    disabled={adding}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800"
                  />
                  {editAvatarPreview && (
                    <img
                      src={editAvatarPreview}
                      alt="Preview"
                      className="mt-3 h-20 w-20 rounded-full object-cover border"
                    />
                  )}
                </div>

                {/* Password opcional en edición */}
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Password (opcional)"
                  className="admin-input"
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  disabled={adding}
                />

                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="btn-primary"
                    disabled={adding}
                  >
                    {adding ? "Actualizando..." : "Actualizar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowEdit(false)}
                    disabled={adding}
                  >
                    Cancelar
                  </motion.button>
                </div>
              </form>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </LayoutAdmin>
  );
};

export default Users;