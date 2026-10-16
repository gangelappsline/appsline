import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiCopy, FiExternalLink, FiGitBranch, FiHardDrive, FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Button, ConfirmDialog, EmptyState, Field, Modal, SearchInput, StatCard, useToast } from "../../components/admin";
import TemplatePicker from "../../components/admin/flowchart/TemplatePicker";
import { DiagramCard, diagramUrl, newDiagramUrl } from "./project/DiagramsTab";
import { fetchProjects } from "../../services/admin";
import { deleteDiagram, diagramsStorageMode, duplicateDiagram, fetchAllDiagrams } from "../../services/diagrams";
import { diagramStats } from "../../utils/diagrams";

/**
 * Vista global de diagramas de flujo: todos los proyectos en un solo lugar.
 * Para crear uno primero se elige el proyecto (y, opcionalmente, la tarea
 * desde el propio editor).
 */
const Diagrams = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [projects, setProjects] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [chooser, setChooser] = useState(false);
  const [chosenProject, setChosenProject] = useState("");
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(diagramsStorageMode());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchProjects().catch(() => []);
      setProjects(list);
      const all = await fetchAllDiagrams(list);
      setDiagrams(all);
    } catch {
      setDiagrams([]);
    } finally {
      setMode(diagramsStorageMode());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const projectOf = useCallback(
    (projectId) => projects.find((p) => String(p.id) === String(projectId)) || null,
    [projects],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return diagrams
      .filter((d) => !projectFilter || String(d.project_id) === String(projectFilter))
      .filter((d) => !term || `${d.name} ${d.description} ${projectOf(d.project_id)?.name || ""}`.toLowerCase().includes(term))
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }, [diagrams, search, projectFilter, projectOf]);

  const totals = useMemo(() => {
    const nodes = diagrams.reduce((sum, d) => sum + diagramStats(d).nodes, 0);
    return {
      diagrams: diagrams.length,
      projects: new Set(diagrams.map((d) => String(d.project_id))).size,
      linked: diagrams.filter((d) => d.task_id).length,
      nodes,
    };
  }, [diagrams]);

  const startCreate = () => {
    if (projects.length === 1) {
      setChosenProject(String(projects[0].id));
      setPicker(true);
      return;
    }
    setChosenProject(projectFilter || "");
    setChooser(true);
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteDiagram(confirm.project_id, confirm.id);
      notify("Diagrama eliminado");
      setConfirm(null);
      await load();
    } catch {
      notify("No se pudo eliminar el diagrama", "error");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (d) => {
    try {
      await duplicateDiagram(d.project_id, d);
      notify("Diagrama duplicado");
      await load();
    } catch {
      notify("No se pudo duplicar", "error");
    }
  };

  return (
    <LayoutAdmin
      title="Diagramas"
      subtitle="Diagramas de flujo de todos los proyectos y tareas."
      actions={
        <Button onClick={startCreate} disabled={!projects.length}>
          <FiPlus /> Nuevo diagrama
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FiGitBranch} label="Diagramas" value={totals.diagrams} />
        <StatCard icon={FiGitBranch} label="Proyectos con diagramas" value={totals.projects} />
        <StatCard icon={FiGitBranch} label="Vinculados a tareas" value={totals.linked} />
        <StatCard icon={FiGitBranch} label="Nodos en total" value={totals.nodes} />
      </div>

      {mode === "local" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <FiHardDrive className="mt-0.5 shrink-0" />
          <span>
            Los diagramas se están guardando <b>en este navegador</b> porque la API aún no expone sus endpoints.
            Consulta <code>docs/API-DIAGRAMS.md</code> para habilitarlos en el backend.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar diagrama o proyecto..." className="min-w-[200px] flex-1 sm:max-w-sm" />
        <div className="relative">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filtrar por proyecto" className="admin-input appearance-none pr-8 text-[13px]">
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
        </div>
        <Button variant="ghost" onClick={load} disabled={loading} title="Actualizar">
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} de {diagrams.length}</span>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card">
            <EmptyState
              icon={FiGitBranch}
              title={diagrams.length ? "Sin coincidencias" : "Todavía no hay diagramas"}
              description={diagrams.length ? "Prueba con otro filtro." : "Crea el primero desde aquí o desde la pestaña Diagramas de cualquier proyecto."}
              action={!diagrams.length && projects.length ? <Button onClick={startCreate}><FiPlus /> Nuevo diagrama</Button> : null}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((d) => (
              <DiagramCard
                key={`${d.project_id}-${d.id}`}
                diagram={d}
                project={projectOf(d.project_id)}
                task={d.task || null}
                onOpen={() => navigate(diagramUrl(d.project_id, d.id))}
                onOpenTask={(task) => navigate(`/admin/projects/${d.project_id}?task=${task.id}`)}
                menu={[
                  { label: "Abrir en el editor", icon: FiExternalLink, onClick: () => navigate(diagramUrl(d.project_id, d.id)) },
                  { label: "Ver proyecto", icon: FiGitBranch, onClick: () => navigate(`/admin/projects/${d.project_id}?view=diagrams`) },
                  { label: "Duplicar", icon: FiCopy, onClick: () => duplicate(d) },
                  { label: "Eliminar", icon: FiTrash2, danger: true, onClick: () => setConfirm(d) },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={chooser}
        onClose={() => setChooser(false)}
        size="sm"
        title="¿En qué proyecto?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChooser(false)}>Cancelar</Button>
            <Button disabled={!chosenProject} onClick={() => { setChooser(false); setPicker(true); }}>Continuar</Button>
          </>
        }
      >
        <Field label="Proyecto" required>
          <select autoFocus value={chosenProject} onChange={(e) => setChosenProject(e.target.value)} className="admin-input">
            <option value="">Selecciona un proyecto…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </Modal>

      <TemplatePicker
        open={picker}
        onClose={() => setPicker(false)}
        tasks={[]}
        onCreate={({ name, template }) => {
          setPicker(false);
          navigate(newDiagramUrl(chosenProject, { template, name }));
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        loading={busy}
        title="Eliminar diagrama"
        message={`“${confirm?.name}” se eliminará definitivamente.`}
      />
    </LayoutAdmin>
  );
};

export default Diagrams;
