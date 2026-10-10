import LayoutAdmin from "../../layouts/LayoutAdmin";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TiPencil, TiTimes } from "react-icons/ti";
import { FiArrowUpRight, FiBriefcase, FiCalendar, FiCheckCircle, FiClock, FiGrid, FiList, FiMoreHorizontal, FiPlus, FiSearch, FiUsers } from "react-icons/fi";
import "./Projects.css";

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("grid");
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
    } catch {
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
    `${p.name || ""} ${p.client_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const completedCount = projects.filter((item) => ["completed", "finished", "finalizado"].includes(item.status)).length;
  const activeCount = projects.filter((item) => !["completed", "finished", "finalizado", "rejected"].includes(item.status)).length;
  const totalBudget = projects.reduce((sum, item) => sum + Number(item.budget || 0), 0);
  const projectProgress = (item) => item.progress ?? (item.tasks_count ? Math.round((Number(item.completed_tasks || 0) / Number(item.tasks_count)) * 100) : 0);

  return (
    <LayoutAdmin>
      <div className="projects-page">
        <section className="projects-heading">
          <div>
            <span className="projects-eyebrow"><FiBriefcase /> PORTAFOLIO DE TRABAJO</span>
            <h1>Proyectos</h1>
            <p>Organiza el trabajo, supervisa avances y mantén a tu equipo alineado.</p>
          </div>
          <button className="new-project-btn" onClick={handleOpenCreate}><FiPlus /> Nuevo proyecto</button>
        </section>

        <section className="project-summary-grid">
          <article><span className="summary-icon blue"><FiBriefcase /></span><div><small>PROYECTOS TOTALES</small><strong>{projects.length}</strong><p><b>{activeCount}</b> actualmente activos</p></div></article>
          <article><span className="summary-icon violet"><FiClock /></span><div><small>EN PROGRESO</small><strong>{activeCount}</strong><p>Proyectos en ejecución</p></div></article>
          <article><span className="summary-icon green"><FiCheckCircle /></span><div><small>COMPLETADOS</small><strong>{completedCount}</strong><p>Entregados exitosamente</p></div></article>
          <article><span className="summary-icon amber"><FiArrowUpRight /></span><div><small>PRESUPUESTO TOTAL</small><strong>${totalBudget.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</strong><p>Valor del portafolio</p></div></article>
        </section>

        <section className="projects-panel">
          <div className="projects-tools">
            <label><FiSearch /><input type="search" placeholder="Buscar proyecto o cliente..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="projects-view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} title="Cuadrícula"><FiGrid /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title="Lista"><FiList /></button></div>
          </div>

          {loading ? (
            <div className="project-cards-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="project-card project-loading"><i /><i /><i /></div>)}</div>
          ) : filteredProjects.length === 0 ? (
            <div className="projects-empty"><span><FiBriefcase /></span><h3>No encontramos proyectos</h3><p>Ajusta tu búsqueda o crea un proyecto para comenzar.</p><button className="new-project-btn" onClick={handleOpenCreate}><FiPlus /> Crear proyecto</button></div>
          ) : view === "grid" ? (
            <div className="project-cards-grid">
              {filteredProjects.map((item, index) => {
                const pct = projectProgress(item);
                const palettes = ["indigo", "cyan", "violet", "orange"];
                return <article className="portfolio-card" key={item.id} onClick={() => navigate(`/admin/projects/${item.id}`)}>
                  <div className="portfolio-card-top"><span className={`project-letter ${palettes[index % palettes.length]}`}>{item.logo ? <img src={item.logo} alt="" /> : (item.name || "P").slice(0, 2).toUpperCase()}</span><div className="portfolio-card-actions"><button onClick={(event) => { event.stopPropagation(); handleOpenEdit(item); }} title="Editar"><TiPencil /></button><button onClick={(event) => event.stopPropagation()}><FiMoreHorizontal /></button></div></div>
                  <div className="portfolio-title"><span className={`portfolio-status ${item.status || "active"}`}><i /> {item.status === "completed" ? "Finalizado" : item.status === "rejected" ? "Rechazado" : "En curso"}</span><h3>{item.name}</h3><p>{item.description || "Sin descripción del proyecto."}</p></div>
                  <div className="portfolio-client"><span>{(item.client_name || "AP").split(/\s+/).slice(0,2).map((x) => x[0]).join("").toUpperCase()}</span><div><small>CLIENTE</small><strong>{item.client_name || "Appsline"}</strong></div></div>
                  <div className="portfolio-progress"><div><span>Progreso</span><b>{pct}%</b></div><i><em style={{ width: `${pct}%` }} /></i></div>
                  <div className="portfolio-footer"><span><FiCalendar /> {item.end_date ? new Date(item.end_date).toLocaleDateString("es-MX", { day:"numeric", month:"short", year:"numeric" }) : "Sin fecha"}</span><span><FiUsers /> {item.members_count || item.users_count || 0}</span><button>Ver tablero <FiArrowUpRight /></button></div>
                </article>;
              })}
            </div>
          ) : (
            <div className="projects-list"><div className="projects-list-head"><span>Proyecto</span><span>Cliente</span><span>Progreso</span><span>Entrega</span><span>Estado</span></div>{filteredProjects.map((item, index) => <button key={item.id} onClick={() => navigate(`/admin/projects/${item.id}`)}><span className={`project-letter ${["indigo","cyan","violet","orange"][index%4]}`}>{(item.name || "P").slice(0,2).toUpperCase()}</span><span className="list-project-name"><strong>{item.name}</strong><small>{item.description}</small></span><span>{item.client_name || "—"}</span><span className="list-progress"><i><em style={{ width: `${projectProgress(item)}%` }} /></i><b>{projectProgress(item)}%</b></span><span>{item.end_date ? new Date(item.end_date).toLocaleDateString("es-MX") : "—"}</span><span className={`portfolio-status ${item.status || "active"}`}><i />{item.status === "completed" ? "Finalizado" : "En curso"}</span></button>)}</div>
          )}
        </section>
      </div>

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
