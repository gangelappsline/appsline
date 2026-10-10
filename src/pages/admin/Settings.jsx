import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiBell, FiCamera, FiCheck, FiGlobe, FiList, FiLock, FiLogOut, FiShield, FiUser,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Avatar, Button, Card, CardHeader, Field, Tabs, useToast, TOASTS_PREF_KEY, toastsEnabled,
} from "../../components/admin";
import { AVATAR_FIELD, saveUser } from "../../services/admin";
import api from "../../services/api";
import { useAuth } from "../../routes/AuthContext";
import { getPageSize, setPageSize } from "../../utils/prefs";
import { roleLabel } from "../../utils/format";

const TABS = [
  { key: "profile", label: "Perfil", icon: FiUser },
  { key: "security", label: "Seguridad", icon: FiShield },
  { key: "preferences", label: "Preferencias", icon: FiBell },
];

const Settings = () => {
  const [tab, setTab] = useState("profile");

  return (
    <LayoutAdmin
      title="Configuración"
      subtitle="Administra tu cuenta, seguridad y preferencias del panel"
    >
      <div className="mx-auto w-full max-w-3xl">
        <Tabs tabs={TABS} active={tab} onChange={setTab} variant="underline" className="mb-6" />
        {tab === "profile" && <ProfileTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "preferences" && <PreferencesTab />}
      </div>
    </LayoutAdmin>
  );
};

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */

const ProfileTab = () => {
  const { user, updateProfile } = useAuth();
  const { notify } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(user?.avatar || user?.image || user?.photo || "");
  const [saving, setSaving] = useState(false);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("name", name.trim());
      payload.append("email", email.trim());
      if (user?.role) payload.append("role", user.role);
      if (file) payload.append(AVATAR_FIELD, file);
      const saved = await saveUser(payload, user?.id || null);
      updateProfile({ name: saved?.name || name.trim(), email: saved?.email || email.trim(), avatar: saved?.avatar || saved?.image || preview || undefined });
      notify("Perfil actualizado");
    } catch {
      notify("No se pudo actualizar el perfil", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader title="Información personal" subtitle="Estos datos se muestran en el panel y en tus tareas." />
      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          {preview ? (
            <img src={preview} alt="Foto de perfil" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
          ) : (
            <Avatar user={{ name }} size="xl" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-700">Foto de perfil</p>
            <p className="text-xs text-slate-400">PNG o JPG de hasta 2 MB.</p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-700 ring-1 ring-slate-200 transition hover:ring-brand-300">
              <FiCamera /> Cambiar foto
              <input type="file" accept="image/*" hidden onChange={pickFile} />
            </label>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre completo" required>
            <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Correo electrónico" required>
            <input type="email" className="admin-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        </div>

        <Field label="Rol" hint="Solo un administrador puede cambiar los roles.">
          <input className="admin-input" value={roleLabel(user?.role)} disabled />
        </Field>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <Button type="submit" loading={saving}>
            <FiCheck /> Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Seguridad                                                           */
/* ------------------------------------------------------------------ */

const SecurityTab = () => {
  const { logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handlePassword = async (e) => {
    e.preventDefault();
    setFormError("");
    if (next.length < 8) {
      setFormError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setFormError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/change-password", {
        current_password: current,
        password: next,
        password_confirmation: confirm,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      notify("Contraseña actualizada");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        setFormError("Tu API no expone el cambio de contraseña (POST /change-password). Contacta al administrador.");
      } else {
        setFormError(err?.response?.data?.message || "No se pudo cambiar la contraseña. Verifica tu contraseña actual.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader title="Cambiar contraseña" subtitle="Usa una contraseña segura que no uses en otros sitios." />
        <form onSubmit={handlePassword} className="space-y-5">
          {formError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <Field label="Contraseña actual" required>
            <input type="password" className="admin-input" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nueva contraseña" required hint="Mínimo 8 caracteres.">
              <input type="password" className="admin-input" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
            </Field>
            <Field label="Confirmar contraseña" required>
              <input type="password" className="admin-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button type="submit" loading={saving}>
              <FiLock /> Actualizar contraseña
            </Button>
          </div>
        </form>
      </Card>

      <Card className="border-red-100 p-6">
        <CardHeader title="Sesión" subtitle="Cierra tu sesión en este dispositivo." />
        <Button variant="danger" onClick={handleLogout}>
          <FiLogOut /> Cerrar sesión
        </Button>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Preferencias                                                        */
/* ------------------------------------------------------------------ */

const PreferencesTab = () => {
  const { i18n } = useTranslation();
  const { notify } = useToast();
  const [lang, setLang] = useState(i18n.language?.startsWith("en") ? "en" : "es");
  const [toasts, setToasts] = useState(toastsEnabled());
  const [pageSize, setPageSizeState] = useState(getPageSize());

  const changeLang = (lng) => {
    setLang(lng);
    i18n.changeLanguage(lng);
    notify(lng === "es" ? "Idioma cambiado a español" : "Language switched to English");
  };

  const toggleToasts = () => {
    const next = !toasts;
    setToasts(next);
    localStorage.setItem(TOASTS_PREF_KEY, next ? "on" : "off");
    window.dispatchEvent(new Event("appsline:toasts"));
    if (next) notify("Notificaciones activadas");
  };

  const changePageSize = (n) => {
    setPageSizeState(n);
    setPageSize(n);
    notify(`Se mostrarán ${n} filas por página en Mi trabajo`);
  };

  return (
    <Card className="divide-y divide-slate-100 p-6">
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FiGlobe /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Idioma</p>
            <p className="mt-0.5 text-sm text-slate-500">Idioma de la interfaz pública y del panel.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[{ k: "es", label: "Español" }, { k: "en", label: "English" }].map((l) => (
            <button
              key={l.k}
              type="button"
              onClick={() => changeLang(l.k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${lang === l.k ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FiBell /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Notificaciones flotantes</p>
            <p className="mt-0.5 text-sm text-slate-500">Muestra confirmaciones y avisos en la esquina.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={toasts}
          onClick={toggleToasts}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${toasts ? "bg-brand-600" : "bg-slate-200"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${toasts ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FiList /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Filas por página</p>
            <p className="mt-0.5 text-sm text-slate-500">Cantidad de tareas visibles en “Mi trabajo”.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[10, 20, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changePageSize(n)}
              className={`rounded-lg px-4 py-2 text-sm font-medium tabular-nums transition ${pageSize === n ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default Settings;
