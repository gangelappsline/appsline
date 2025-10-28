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
    <LayoutAdmin title="Users">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-app-one">Usuarios</h1>
          <div className="flex gap-4 items-center">
            <motion.input
              whileFocus={{ scale: 1.05 }}
              type="text"
              placeholder="Buscar por nombre o email..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAdd(true)}
              className="bg-app-two text-white px-4 py-2 rounded-lg hover:bg-app-three transition font-semibold"
            >
              + Agregar Usuario
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-app-one font-semibold">Cargando usuarios...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {search ? "No se encontraron usuarios con ese filtro." : "No hay usuarios registrados."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  {/* Nueva columna Foto */}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                <AnimatePresence>
                  {filteredUsers.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-sm text-gray-700">{user.id}</td>
                      {/* Celda de foto con fallback */}
                      <td className="px-4 py-2">
                        <img
                          src={getUserAvatar(user)}
                          alt={`Avatar de ${user.name || user.email || user.id}`}
                          className="h-10 w-10 rounded-full object-cover border bg-white"
                          onError={(e) => {
                            const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              user?.name || user?.email || "Usuario"
                            )}`;
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallback;
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{user.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{user.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {roles.find((role) => role.key === user.role)?.label || "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => handleEditUser(user)}
                          className="text-blue-500 hover:text-blue-700 text-xs font-semibold"
                        >
                          ✏️ Editar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold"
                        >
                          🗑️ Eliminar
                        </motion.button>
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
              className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white border border-gray-300 rounded-xl shadow-2xl"
            >
              <Dialog.Title as="h2" className="text-xl font-bold text-app-one mb-4">
                Agregar Nuevo Usuario
              </Dialog.Title>
              <form onSubmit={handleAddUser} className="flex flex-col gap-4">
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Nombre"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  disabled={adding}
                  autoFocus
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="email"
                  placeholder="Email"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
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
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-app-two file:text-white hover:file:bg-app-three"
                  />
                  {addAvatarPreview && (
                    <img src={addAvatarPreview} alt="Preview" className="mt-3 h-20 w-20 rounded-full object-cover border" />
                  )}
                </div>

                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Password"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  disabled={adding}
                />

                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="bg-app-two text-white px-4 py-2 rounded-lg hover:bg-app-three transition font-semibold"
                    disabled={adding}
                  >
                    {adding ? "Agregando..." : "Agregar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
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
              className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white border border-gray-300 rounded-xl shadow-2xl"
            >
              <Dialog.Title as="h2" className="text-xl font-bold text-app-one mb-4">
                Editar Usuario
              </Dialog.Title>
              <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Nombre"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  disabled={adding}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="email"
                  placeholder="Email"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  disabled={adding}
                />
                <motion.select
                  whileFocus={{ scale: 1.02 }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
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
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-app-two file:text-white hover:file:bg-app-three"
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
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  disabled={adding}
                />

                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="bg-app-two text-white px-4 py-2 rounded-lg hover:bg-app-three transition font-semibold"
                    disabled={adding}
                  >
                    {adding ? "Actualizando..." : "Actualizar"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
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