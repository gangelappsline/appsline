import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCamera, FiPlus, FiUsers, FiRefreshCw } from "react-icons/fi";
import { SiLetsencrypt } from "react-icons/si";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field,
  Modal, SearchInput, TableSkeleton, useToast,
} from "../../components/admin";
import { deleteUser, fetchUsers, saveUser, uploadUserAvatar } from "../../services/admin";
import { roleLabel, roleTone } from "../../utils/format";

const ROLES = [
  { key: "administrator", label: "Administrador" },
  { key: "dev", label: "Desarrollador" },
  { key: "client", label: "Cliente" },
];

const EMPTY_FORM = { name: "", email: "", role: "client", password: "" };

/**
 * Genera una contraseña de alta seguridad.
 * Incluye mayúsculas, minúsculas, números y símbolos, garantizando
 * al menos un carácter de cada tipo mediante un shuffle final.
 */
const generateSecurePassword = (length = 16) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + numbers + symbols;

  const randomChar = (chars) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return chars[array[0] % chars.length];
  };

  // Garantiza al menos un carácter de cada categoría.
  const required = [
    randomChar(upper),
    randomChar(lower),
    randomChar(numbers),
    randomChar(symbols),
  ];

  const remaining = Array.from({ length: length - required.length }, () => randomChar(all));

  // Mezcla (Fisher-Yates con crypto) para no dejar predecible la posición.
  const password = [...required, ...remaining];
  for (let i = password.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
};

const Users = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setUsers(await fetchUsers());
    } catch {
      setLoadError("No se pudieron cargar los usuarios.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Permite abrir el modal con /admin/users?action=new (paleta Ctrl+K).
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q);
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetAvatar = () => {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview("");
  };

  const openCreate = () => {
    resetAvatar();
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (user) => {
    resetAvatar();
    setEditing(user);
    setForm({ name: user.name || "", email: user.email || "", role: user.role || "client", password: "" });
    setAvatarPreview(user.avatar || user.image || user.photo || "");
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    resetAvatar();
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword(16);
    setForm((f) => ({ ...f, password: newPassword }));
    setShowPassword(true);
    notify("Contraseña segura generada");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      // 1) Primero los datos del usuario (JSON, sin imagen).
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.password) payload.password = form.password;

      const saved = await saveUser(payload, editing?.id || null);
      const userId = editing?.id || saved?.id || null;
      const verb = editing ? "actualizado" : "creado";
      const applyRecord = (next) =>
        setUsers((old) =>
          editing
            ? old.map((u) => (u.id === editing.id ? { ...u, ...next } : u))
            : [next, ...old]
        );

      // 2) Después la foto, si se eligió una, al endpoint de avatar.
      let record = saved;
      if (avatarFile && userId) {
        try {
          const updated = await uploadUserAvatar(userId, avatarFile);
          const avatar = updated?.avatar || updated?.image || updated?.photo;
          if (avatar) record = { ...saved, avatar };
        } catch {
          applyRecord(record);
          notify(`Usuario ${verb}, pero no se pudo subir la foto`, "error");
          closeModal();
          return;
        }
      }

      applyRecord(record);
      notify(`Usuario ${verb}`);
      closeModal();
    } catch {
      notify(editing ? "No se pudo actualizar el usuario" : "No se pudo crear el usuario", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteUser(confirmDelete.id);
      setUsers((old) => old.filter((u) => u.id !== confirmDelete.id));
      notify("Usuario eliminado");
    } catch {
      notify("No se pudo eliminar el usuario", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <LayoutAdmin
      title="Usuarios"
      subtitle="Gestiona las cuentas y roles del equipo"
      actions={
        <Button onClick={openCreate}>
          <FiPlus /> Agregar usuario
        </Button>
      }
    >
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o correo..."
            className="w-full sm:max-w-xs"
          />
          <span className="text-sm text-slate-500">
            {filtered.length} usuario{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : loadError ? (
          <EmptyState
            icon={FiUsers}
            title="No se pudieron cargar los usuarios"
            description={loadError}
            action={<Button variant="secondary" onClick={load}>Reintentar</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FiUsers}
            title={search ? "Sin resultados" : "No hay usuarios registrados"}
            description={search ? "Prueba con otro nombre o correo." : "Agrega el primer usuario para comenzar."}
            action={!search && <Button onClick={openCreate}><FiPlus /> Agregar usuario</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-6 py-3.5">Usuario</th>
                  <th className="px-6 py-3.5">Correo</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{user.name || "—"}</p>
                          <p className="text-xs tabular-nums text-slate-400">ID {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{user.email}</td>
                    <td className="px-6 py-3.5">
                      <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="subtle" onClick={() => openEdit(user)}>Editar</Button>
                        <Button variant="subtle" tone="red" onClick={() => setConfirmDelete(user)}>Eliminar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------- Modal crear/editar ---------- */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? "Editar usuario" : "Agregar usuario"}
        subtitle={editing ? "Actualiza los datos de la cuenta." : "Crea una cuenta nueva para el equipo."}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button loading={saving} onClick={handleSubmit}>{editing ? "Guardar cambios" : "Agregar"}</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Foto de perfil" className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
            ) : (
              <Avatar user={{ name: form.name || "?" }} size="lg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700">Foto de perfil</p>
              <p className="text-xs text-slate-400">PNG o JPG. Opcional.</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-700 ring-1 ring-slate-200 transition hover:ring-brand-300">
                <FiCamera /> Elegir imagen
                <input type="file" accept="image/*" hidden onChange={handleAvatar} />
              </label>
            </div>
          </div>

          <Field label="Nombre" required>
            <input className="admin-input" value={form.name} onChange={set("name")} placeholder="Nombre completo" required autoFocus />
          </Field>
          <Field label="Correo electrónico" required>
            <input type="email" className="admin-input" value={form.email} onChange={set("email")} placeholder="usuario@empresa.com" required />
          </Field>
          <Field label="Rol">
            <select className="admin-input" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
          <Field
            label={editing ? "Contraseña (opcional)" : "Contraseña"}
            hint={editing ? "Déjala vacía para conservar la actual." : "Usa el botón para generar una contraseña segura."}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? "text" : "password"}
                  className="admin-input pr-10"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center px-2 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleGeneratePassword}
                title="Generar contraseña segura"
                aria-label="Generar contraseña segura"
              >
                <SiLetsencrypt />
              </Button>
            </div>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`Eliminar a ${confirmDelete?.name || "este usuario"}`}
        message="Se eliminará la cuenta y perderá el acceso al panel. Esta acción no se puede deshacer."
      />
    </LayoutAdmin>
  );
};

export default Users;