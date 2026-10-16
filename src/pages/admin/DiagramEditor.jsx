import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Button, EmptyState, useToast } from "../../components/admin";
import FlowchartEditor from "../../components/admin/flowchart/FlowchartEditor";
import { fetchProject, fetchProjectTasks, uploadProjectFiles } from "../../services/admin";
import { diagramsStorageMode, fetchDiagram, saveDiagram } from "../../services/diagrams";
import { createDiagram } from "../../utils/diagrams";

/**
 * Editor a pantalla completa de un diagrama de flujo.
 *
 * Rutas:
 *   /admin/projects/:id/diagrams/new?task=:taskId&template=:key&name=:nombre
 *   /admin/projects/:id/diagrams/:diagramId
 */
const DiagramEditor = () => {
  const { id: projectId, diagramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [diagram, setDiagram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageMode, setStorageMode] = useState(diagramsStorageMode());

  const isNew = diagramId === "new";

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setMissing(false);
      const [p, t, d] = await Promise.allSettled([
        fetchProject(projectId),
        fetchProjectTasks(projectId),
        isNew ? Promise.resolve(null) : fetchDiagram(projectId, diagramId),
      ]);
      if (!active) return;
      setProject(p.status === "fulfilled" ? p.value : null);
      setTasks(t.status === "fulfilled" ? t.value : []);
      if (isNew) {
        setDiagram(
          createDiagram({
            name: searchParams.get("name") || "Nuevo diagrama",
            projectId,
            taskId: searchParams.get("task") || null,
            template: searchParams.get("template") || "blank",
          }),
        );
      } else if (d.status === "fulfilled" && d.value) {
        setDiagram(d.value);
      } else {
        setMissing(true);
      }
      setStorageMode(diagramsStorageMode());
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, diagramId]);

  const taskOf = useCallback(
    (taskId) => tasks.find((t) => String(t.id) === String(taskId)) || null,
    [tasks],
  );

  const contextLabel = useMemo(() => {
    const parts = [project?.name || `Proyecto #${projectId}`];
    const task = taskOf(diagram?.task_id);
    if (task) parts.push(`Tarea #${task.id} · ${task.title}`);
    return parts.join(" › ");
  }, [project, projectId, diagram?.task_id, taskOf]);

  const handleSave = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const saved = await saveDiagram(projectId, { ...payload, id: diagram?.id ?? null });
        setStorageMode(diagramsStorageMode());
        setDiagram((old) => (old ? { ...old, id: saved.id, updated_at: saved.updated_at } : saved));
        if (isNew && saved.id) {
          navigate(`/admin/projects/${projectId}/diagrams/${saved.id}`, { replace: true });
        }
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [projectId, diagram?.id, isNew, navigate],
  );

  const handleAttach = useCallback(
    async (files) => {
      await uploadProjectFiles(projectId, files, { taskId: diagram?.task_id || null });
    },
    [projectId, diagram?.task_id],
  );

  const goBack = () => {
    const task = diagram?.task_id;
    navigate(
      task
        ? `/admin/projects/${projectId}?task=${task}`
        : `/admin/projects/${projectId}?view=diagrams`,
    );
  };

  return (
    <LayoutAdmin
      fluid
      compact
      focusMode
      breadcrumbs={[
        { label: "Proyectos", to: "/admin/projects" },
        { label: project?.name || "Proyecto", to: `/admin/projects/${projectId}?view=diagrams` },
        { label: diagram?.name || "Diagrama" },
      ]}
    >
      <div className="h-[calc(100vh-7.5rem)] min-h-[560px]">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
              <p className="mt-3 text-sm text-slate-500">Cargando el diagrama…</p>
            </div>
          </div>
        ) : missing || !diagram ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              icon={FiAlertTriangle}
              title="No se encontró el diagrama"
              description="Puede que se haya eliminado o que esté guardado en otro navegador."
              action={
                <Button variant="secondary" onClick={() => navigate(`/admin/projects/${projectId}?view=diagrams`)}>
                  <FiArrowLeft /> Volver a los diagramas
                </Button>
              }
            />
          </div>
        ) : (
          <FlowchartEditor
            key={diagram.id || "new"}
            diagram={diagram}
            tasks={tasks}
            onSave={handleSave}
            saving={saving}
            storageMode={storageMode}
            onBack={goBack}
            onAttach={handleAttach}
            contextLabel={contextLabel}
          />
        )}
      </div>
      {storageMode === "local" && !loading && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          La API todavía no expone <code>/projects/{"{id}"}/diagrams</code>; mientras tanto el diagrama se guarda en este navegador.
          Instrucciones en <code>docs/API-DIAGRAMS.md</code>.
          {" "}
          <button type="button" className="underline hover:text-brand-600" onClick={() => notify("Exporta el JSON desde “Exportar” para respaldarlo o moverlo a otro equipo.", "info")}>
            ¿Cómo lo respaldo?
          </button>
        </p>
      )}
    </LayoutAdmin>
  );
};

export default DiagramEditor;
