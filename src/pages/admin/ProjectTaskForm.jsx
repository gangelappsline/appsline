import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import MultiUserSelect from "../../components/MultiUserSelect";

const ProjectTaskForm = () => {
  const { taskId } = useParams(); // opcional, si editas
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Estado del formulario
  const [form, setForm] = useState({
    title: "",
    description: "",
    // Reemplaza userId por un arreglo de IDs de usuarios:
    assignees: [], // <- aquí guardamos múltiples usuarios
  });

  // Cargar datos si estás editando
  useEffect(() => {
    const load = async () => {
      if (!taskId) return;
      try {
        const token = localStorage.getItem("user_token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // Ajusta al shape real de la tarea:
        setForm({
          title: data.title || "",
          description: data.description || "",
          assignees: Array.isArray(data.assignees)
            ? data.assignees.map(u => (typeof u === "object" ? u.id : u))
            : [],
        });
      } catch {
        // manejar error si quieres
      }
    };
    load();
  }, [taskId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("user_token");
      const url = taskId
        ? `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`
        : `${import.meta.env.VITE_API_URL}/api/tasks`;
      const method = taskId ? "PUT" : "POST";
      // Envía el arreglo de IDs en assignees:
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error al guardar");
      navigate(-1); // volver
    } catch (e) {
      // mostrar notificación si quieres
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayoutAdmin title={taskId ? "Editar Tarea" : "Nueva Tarea"}>
      <form className="max-w-3xl bg-white rounded-lg shadow p-6 grid gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-app-two"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Reemplazo del ID de usuario por listado multi-select */}
        <MultiUserSelect
          label="Asignar usuarios"
          value={form.assignees}
          onChange={(ids) => setForm((f) => ({ ...f, assignees: ids }))}
        />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="bg-app-two text-white px-5 py-2 rounded-lg font-semibold hover:bg-app-three transition disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            className="px-5 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </form>
    </LayoutAdmin>
  );
};

export default ProjectTaskForm;