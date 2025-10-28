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
    <LayoutAdmin title="Proyectos">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="bg-app-one text-white font-semibold px-6 py-2 rounded-lg shadow hover:bg-app-three hover:text-white transition"
          onClick={handleOpenCreate}
        >
          + Nuevo Proyecto
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-app-one font-semibold">
          Cargando proyectos...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          No se encontraron proyectos.
        </div>
      ) : (
        <div className="w-full bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl shadow p-6 flex flex-col justify-between border border-gray-100 hover:shadow-lg transition"
              >
                <div>
                  {project.logo && (
                    <img 
                      src={project.logo} 
                      alt={project.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="text-xl font-bold text-app-one mb-2 truncate">
                    {project.name}
                  </h3>
                  <p className="text-gray-500 mb-4 line-clamp-3">
                    {project.description}
                  </p>
                  {project.budget && (
                    <p className="text-sm text-green-600 font-semibold mb-2">
                      Presupuesto: ${Number(project.budget).toLocaleString()}
                    </p>
                  )}
                  {project.client_name && (
                    <p className="text-sm text-gray-600 mb-1">
                      Cliente: {project.client_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center mt-4">
                  <div className="flex justify-center items-center gap-2">
                    <button
                      className="p-2 rounded-lg shadow-lg transition-colors group"
                      onClick={() => navigate(`/admin/projects/${project.id}`)}
                      title="Ver proyecto"
                    >
                      <TiEye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      className="p-2 rounded-lg shadow-lg transition-colors group"
                      onClick={() => handleOpenEdit(project)}
                      title="Editar proyecto"
                    >
                      <TiPencil className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                  {project.status && (
                    <span className="text-xs px-3 py-1 rounded-full bg-app-two/10 text-app-two font-medium">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? "Editar Proyecto" : "Nuevo Proyecto"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <TiTimes className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Proyecto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Presupuesto
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo
                  </label>
                  <input
                    type="file"
                    name="logo"
                    onChange={handleInputChange}
                    accept="image/*"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    name="client_name"
                    value={formData.client_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo del Cliente
                  </label>
                  <input
                    type="email"
                    name="client_email"
                    value={formData.client_email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono del Cliente
                  </label>
                  <input
                    type="tel"
                    name="client_phone"
                    value={formData.client_phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-app-one text-white rounded-lg hover:bg-app-three disabled:opacity-50 transition-colors"
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
