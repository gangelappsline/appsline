import LayoutAdmin from "../../layouts/LayoutAdmin";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TiEye, TiPencil, TiTimes } from "react-icons/ti";

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    budget: "",
    end_date: "",
    logo: null,
    client_name: "",
    client_email: "",
    client_phone: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      budget: "",
      end_date: "",
      logo: null,
      client_name: "",
      client_email: "",
      client_phone: "",
    });
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("user_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setProjects(
        Array.isArray(data.data) ? data.data : data.data?.projects || []
      );
    } catch (err) {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenCreate = () => {
    resetForm();
    setIsEditing(false);
    setCurrentProject(null);
    setShowModal(true);
  };

  const handleOpenEdit = (project) => {
    setFormData({
      name: project.name || "",
      description: project.description || "",
      budget: project.budget || "",
      end_date: project.end_date ? project.end_date.split('T')[0] : "",
      logo: null, // file input reset
      client_name: project.client_name || "",
      client_email: project.client_email || "",
      client_phone: project.client_phone || "",
    });
    setCurrentProject(project);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentProject(null);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "logo" && files) {
      setFormData(prev => ({ ...prev, logo: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem("user_token");
      
      // Preparar datos para JSON (sin el logo)
      const jsonData = {
        name: formData.name,
        description: formData.description,
        budget: formData.budget,
        end_date: formData.end_date,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
      };

      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL}/projects/${currentProject.id}`
        : `${import.meta.env.VITE_API_URL}/projects`;
      
      const method = isEditing ? "PUT" : "POST";

      // 1. Enviar datos del proyecto en JSON
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jsonData),
      });

      if (!res.ok) {
        throw new Error("Error saving project data");
      }

      const projectData = await res.json();
      const projectId = isEditing ? currentProject.id : projectData?.data?.id || projectData?.id;

      // 2. Si hay logo, enviarlo por separado
      if (formData.logo && projectId) {
        const logoFormData = new FormData();
        logoFormData.append("logo", formData.logo);

        const logoRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/logo`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: logoFormData,
        });

        if (!logoRes.ok) {
          console.warn("Error uploading logo, but project was saved");
        }
      }

      // 3. Refrescar lista y cerrar modal
      await fetchProjects();
      handleCloseModal();
      
    } catch (err) {
      console.error("Error:", err);
      // Opcional: mostrar mensaje de error al usuario
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <LayoutAdmin
      title="Proyectos"
      subtitle="Administra los proyectos activos y su información"
      actions={
        <button className="btn-primary" onClick={handleOpenCreate}>
          + Nuevo proyecto
        </button>
      }
    >
      <div className="mb-6">
        <input
          type="search"
          placeholder="Buscar proyecto..."
          className="admin-input md:max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="admin-card p-5">
              <div className="h-32 w-full animate-pulse rounded-lg bg-slate-100" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="admin-card p-16 text-center">
          <p className="font-medium text-slate-700">No se encontraron proyectos</p>
          <p className="mt-1 text-sm text-slate-500">
            Ajusta la búsqueda o crea un nuevo proyecto para comenzar.
          </p>
          <button className="btn-primary mt-6" onClick={handleOpenCreate}>
            + Nuevo proyecto
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="admin-card admin-card-hover flex flex-col justify-between p-5"
              >
                <div>
                  {project.logo && (
                    <img 
                      src={project.logo} 
                      alt={project.name}
                      className="mb-4 h-32 w-full rounded-lg border border-slate-100 object-cover"
                    />
                  )}
                  <h3 className="mb-2 truncate text-lg font-semibold text-slate-900">
                    {project.name}
                  </h3>
                  <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-500">
                    {project.description}
                  </p>
                  {project.budget && (
                    <p className="mb-1.5 text-sm font-semibold text-emerald-600">
                      ${Number(project.budget).toLocaleString()}
                    </p>
                  )}
                  {project.client_name && (
                    <p className="mb-1 truncate text-sm text-slate-500">
                      Cliente: {project.client_name}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => navigate(`/admin/projects/${project.id}`)}
                      title="Ver proyecto"
                    >
                      <TiEye className="h-5 w-5" />
                    </button>
                    <button
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => handleOpenEdit(project)}
                      title="Editar proyecto"
                    >
                      <TiPencil className="h-5 w-5" />
                    </button>
                  </div>
                  {project.status && (
                    <span className="badge-brand capitalize">
                      {project.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-card-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditing ? "Editar Proyecto" : "Nuevo Proyecto"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <TiTimes className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="admin-label">
                    Nombre del Proyecto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="admin-input"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label">
                    Presupuesto
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    step="0.01"
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label">
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">
                    Logo
                  </label>
                  <input
                    type="file"
                    name="logo"
                    onChange={handleInputChange}
                    accept="image/*"
                    className="admin-input"
                  />
                  {isEditing && currentProject?.logo && (
                    <div className="mt-2">
                      <img 
                        src={currentProject.logo} 
                        alt="Logo actual"
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <span className="text-sm text-gray-500 block mt-1">Logo actual</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="admin-label">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    name="client_name"
                    value={formData.client_name}
                    onChange={handleInputChange}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label">
                    Correo del Cliente
                  </label>
                  <input
                    type="email"
                    name="client_email"
                    value={formData.client_email}
                    onChange={handleInputChange}
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">
                    Teléfono del Cliente
                  </label>
                  <input
                    type="tel"
                    name="client_phone"
                    value={formData.client_phone}
                    onChange={handleInputChange}
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LayoutAdmin>
  );
};

export default Projects;
