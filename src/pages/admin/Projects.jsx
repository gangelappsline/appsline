/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowUpRight, FiBriefcase, FiCalendar, FiCheckCircle, FiClock,
  FiGrid, FiList, FiEdit2, FiPlus, FiTrash2, FiUsers,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState,
  Field, Modal, SearchInput, StatCard, CardsSkeleton, useToast,
} from "../../components/admin";
import {
  deleteProject, fetchProjects, saveProject, uploadProjectLogo,
} from "../../services/admin";
import {
  cx, formatCurrency, formatDate, projectProgress, projectStatusMeta,
} from "../../utils/format";

/** Gradientes rotativos para las iniciales del proyecto. */
const LETTER_GRADIENTS = [
  "from-brand-600 to-violet-500",
  "from-cyan-600 to-sky-400",
  "from-violet-600 to-fuchsia-500",
  "from-orange-500 to-amber-400",
];

const EMPTY_FORM = {
  name: "", description: "", budget: "", end_date: "",
  client_name: "", client_email: "", client_phone: "",
};

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await fetchProjects());
    } catch {
      setProjects([]);
      notify("No se pudieron cargar los proyectos", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  // Permite abrir el modal con /admin/projects?action=new (paleta Ctrl+K).
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setForm(EMPTY_FORM);
      setLogoFile(null);
      setLogoPreview("");
      setIsEditing(false);
      setCurrent(null);
      setShowModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      `${p.name || ""} ${p.client_name || ""} ${p.description || ""}`.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const stats = useMemo(() => {
    const done = ["completed", "finished", "finalizado"];
    const completed = projects.filter((p) => done.includes(p.status)).length;
    const active = projects.filter((p) => ![...done, "rejected"].includes(p.status)).length;
    const budget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    return { total: projects.length, active, completed, budget };
  }, [projects]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview("");
    setIsEditing(false);
    setCurrent(null);
    setShowModal(true);
  };

  const openEdit = (project) => {
    setForm({
      name: project.name || "",
      description: project.description || "",
      budget: project.budget ?? "",
      end_date: project.end_date ? String(project.end_date).slice(0, 10) : "",
      client_name: project.client_name || "",
      client_email: project.client_email || "",
      client_phone: project.client_phone || "",
    });
    setLogoFile(null);
    setLogoPreview(project.logo || "");
    setCurrent(project);
    setIsEditing(true);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrent(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const saved = await saveProject(
        {
          name: form.name.trim(),
          description: form.description,
          budget: form.budget === "" ? null : Number(form.budget),
          end_date: form.end_date || null,
          client_name: form.client_name,
          client_email: form.client_email,
          client_phone: form.client_phone,
        },
        isEditing ? current.id : null
      );
      const projectId = isEditing ? current.id : saved?.id;
      if (logoFile && projectId) {
        try {
          await uploadProjectLogo(projectId, logoFile);
        } catch {
          notify("Proyecto guardado, pero el logo no se pudo subir", "error");
        }
      }
      notify(isEditing ? "Proyecto actualizado" : "Proyecto creado");
      closeModal();
      await load();
    } catch {
      notify("No se pudo guardar el proyecto", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      await deleteProject(confirmDelete.id);
      setProjects((old) => old.filter((p) => p.id !== confirmDelete.id));
      notify("Proyecto eliminado");
    } catch {
      notify("No se pudo eliminar el proyecto", "error");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  return (
    <LayoutAdmin
      title="Proyectos"
      subtitle="Organiza el trabajo, supervisa avances y mantén a tu equipo alineado."
      actions={
        <Button onClick={openCreate}>
          <FiPlus /> Nuevo proyecto
        </Button>
      }
    >
      {/* ---------- Resumen ---------- */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Proyectos totales" value={stats.total} icon={FiBriefcase} tone="brand" hint={`${stats.active} actualmente activos`} />
        <StatCard label="En progreso" value={stats.active} icon={FiClock} tone="violet" hint="Proyectos en ejecución" />
        <StatCard label="Completados" value={stats.completed} icon={FiCheckCircle} tone="green" hint="Entregados exitosamente" />
        <StatCard label="Presupuesto total" value={formatCurrency(stats.budget)} icon={FiArrowUpRight} tone="amber" hint="Valor del portafolio" />
      </div>

      {/* ---------- Panel principal ---------- */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar proyecto o cliente..."
            className="w-full sm:max-w-xs"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {filtered.length} de {projects.length}
            </span>
            <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Vista">
              <button
                type="button" role="tab" aria-selected={view === "grid"} title="Cuadrícula"
                onClick={() => setView("grid")}
                className={cx("rounded-md p-2 transition", view === "grid" ? "bg-white text-brand-600 shadow-card" : "text-slate-400 hover:text-slate-600")}
              >
                <FiGrid />
              </button>
              <button
                type="button" role="tab" aria-selected={view === "list"} title="Lista"
                onClick={() => setView("list")}
                className={cx("rounded-md p-2 transition", view === "list" ? "bg-white text-brand-600 shadow-card" : "text-slate-400 hover:text-slate-600")}
              >
                <FiList />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <CardsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FiBriefcase}
              title={search ? "Sin coincidencias" : "No hay proyectos todavía"}
              description={search ? "Ajusta tu búsqueda o crea un proyecto para comenzar." : "Crea tu primer proyecto y empieza a organizar el trabajo."}
              action={<Button onClick={openCreate}><FiPlus /> Crear proyecto</Button>}
            />
          ) : view === "grid" ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item, i) => (
                <ProjectCard
                  key={item.id}
                  project={item}
                  gradient={LETTER_GRADIENTS[i % LETTER_GRADIENTS.length]}
                  onOpen={() => navigate(`/admin/projects/${item.id}`)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setConfirmDelete(item)}
                />
              ))}
            </div>
          ) : (
            <ProjectList
              projects={filtered}
              onOpen={(id) => navigate(`/admin/projects/${id}`)}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
            />
          )}
        </div>
      </Card>

      {/* ---------- Modal crear/editar ---------- */}
      <Modal
        open={showModal}
        onClose={closeModal}
        size="xl"
        title={isEditing ? "Editar proyecto" : "Nuevo proyecto"}
        subtitle={isEditing ? "Actualiza la información del proyecto." : "Completa los datos para crear el proyecto."}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button loading={saving} onClick={handleSubmit}>
              {isEditing ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre del proyecto" required className="sm:col-span-2">
            <input className="admin-input" value={form.name} onChange={set("name")} placeholder="Ej. Sitio corporativo" required autoFocus />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <textarea className="admin-input min-h-20 resize-y" rows={3} value={form.description} onChange={set("description")} placeholder="Objetivo, alcance, notas..." />
          </Field>
          <Field label="Presupuesto (MXN)">
            <input type="number" min="0" step="0.01" className="admin-input" value={form.budget} onChange={set("budget")} placeholder="0.00" />
          </Field>
          <Field label="Fecha de entrega">
            <input type="date" className="admin-input" value={form.end_date} onChange={set("end_date")} />
          </Field>
          <Field label="Logo" hint="PNG o JPG. Se sube después de guardar." className="sm:col-span-2">
            <div className="flex items-center gap-4">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-xl border border-slate-200 object-cover" />
              )}
              <input
                type="file" accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                }}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <CardHeader title="Datos del cliente" subtitle="Opcional, pero recomendado para reportes." className="mb-3" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre del cliente" className="sm:col-span-2">
                <input className="admin-input" value={form.client_name} onChange={set("client_name")} placeholder="Ej. Acme S.A. de C.V." />
              </Field>
              <Field label="Correo del cliente">
                <input type="email" className="admin-input" value={form.client_email} onChange={set("client_email")} placeholder="contacto@cliente.com" />
              </Field>
              <Field label="Teléfono del cliente">
                <input type="tel" className="admin-input" value={form.client_phone} onChange={set("client_phone")} placeholder="+52 ..." />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      {/* ---------- Confirmar eliminación ---------- */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={!!deleting}
        title={`Eliminar “${confirmDelete?.name}”`}
        message="Se eliminará el proyecto y dejará de aparecer en el portafolio. Esta acción no se puede deshacer."
      />
    </LayoutAdmin>
  );
};

/* ------------------------------------------------------------------ */

const ProjectCard = ({ project, gradient, onOpen, onEdit, onDelete }) => {
  const pct = projectProgress(project);
  const status = projectStatusMeta(project.status);
  return (
    <article
      onClick={onOpen}
      className="admin-card admin-card-hover group flex cursor-pointer flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cx("flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-sm font-extrabold text-white", gradient, project.logo ? "bg-white" : "bg-gradient-to-br")}>
          {project.logo ? (
            <img src={project.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            (project.name || "P").slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button" title="Editar" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiEdit2 />
          </button>
          <button
            type="button" title="Eliminar" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <Badge tone={status.tone} dot>{status.label}</Badge>
        <h3 className="mt-2.5 truncate text-[15px] font-semibold text-slate-900">{project.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-slate-500">
          {project.description || "Sin descripción del proyecto."}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700">
          {(project.client_name || "AP").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cliente</p>
          <p className="truncate text-[13px] font-semibold text-slate-700">{project.client_name || "Appsline"}</p>
        </div>
        {project.budget > 0 && (
          <p className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-slate-700">
            {formatCurrency(project.budget)}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">Progreso</span>
          <span className="font-bold tabular-nums text-slate-700">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><FiCalendar /> {project.end_date ? formatDate(project.end_date) : "Sin fecha"}</span>
        <span className="flex items-center gap-1.5"><FiUsers /> {project.members_count || project.users_count || 0}</span>
        <span className="ml-auto flex items-center gap-1 font-semibold text-brand-600">
          Ver tablero <FiArrowUpRight />
        </span>
      </div>
    </article>
  );
};

const ProjectList = ({ projects, onOpen, onEdit, onDelete }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead>
        <tr className="admin-table-head">
          <th className="px-5 py-3.5">Proyecto</th>
          <th className="px-5 py-3.5">Cliente</th>
          <th className="px-5 py-3.5">Progreso</th>
          <th className="px-5 py-3.5">Entrega</th>
          <th className="px-5 py-3.5">Estado</th>
          <th className="px-5 py-3.5 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {projects.map((item) => {
          const pct = projectProgress(item);
          const status = projectStatusMeta(item.status);
          return (
            <tr key={item.id} onClick={() => onOpen(item.id)} className="cursor-pointer transition hover:bg-slate-50">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-600 to-violet-500 text-xs font-extrabold text-white">
                    {item.logo ? <img src={item.logo} alt="" className="h-full w-full object-cover" /> : (item.name || "P").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{item.name}</p>
                    <p className="truncate text-xs text-slate-400">{item.description || "—"}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-600">{item.client_name || "—"}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-600">{pct}%</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{item.end_date ? formatDate(item.end_date) : "—"}</td>
              <td className="px-5 py-3.5"><Badge tone={status.tone} dot>{status.label}</Badge></td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="subtle" onClick={(e) => { e.stopPropagation(); onEdit(item); }}><FiEdit2 /> Editar</Button>
                  <Button variant="subtle" tone="red" onClick={(e) => { e.stopPropagation(); onDelete(item); }}><FiTrash2 /></Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default Projects;
