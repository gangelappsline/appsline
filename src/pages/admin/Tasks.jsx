import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiAlertTriangle, FiCalendar, FiCheckCircle, FiCheckSquare,
  FiChevronLeft, FiChevronRight, FiClock, FiRepeat, FiUser,
} from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import {
  Avatar, Badge, Button, Card, EmptyState, SearchInput,
  StatCard, TableSkeleton, Tabs,
} from "../../components/admin";
import { fetchAllTasks, fetchUsers } from "../../services/admin";
import { useAuth } from "../../routes/AuthContext";
import { getPageSize } from "../../utils/prefs";
import {
  cx, formatDate, isDueWithin, isOverdue, priorityMeta, taskStatusMeta,
} from "../../utils/format";
import {
  isOngoingTask,
  ongoingLabel,
  taskDescriptionText,
  taskSchedule,
} from "../../utils/tasks";

const TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "En progreso" },
  { key: "completed", label: "Finalizadas" },
  // Las tareas continuas (sin fecha de entrega) no son un estado: son un tipo.
  { key: "ongoing", label: "Continuas" },
];

const assigneeIdOf = (t) => {
  const raw = t?.assigned_to ?? t?.assignees?.[0] ?? t?.user_id ?? "";
  return typeof raw === "object" && raw ? raw.id ?? "" : raw ?? "";
};
const assigneeOf = (t) => {
  const raw = t?.assigned_to ?? t?.assignees?.[0] ?? t?.user;
  return typeof raw === "object" && raw ? raw : null;
};

const Tasks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [project, setProject] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = getPageSize();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ tasks: all }, userList] = await Promise.all([
          fetchAllTasks(),
          fetchUsers().catch(() => []),
        ]);
        setTasks(all);
        setUsers(userList);
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setPage(0); }, [tab, search, priority, project, onlyMine]);

  const isMine = (t) => {
    if (!user) return false;
    const aid = assigneeIdOf(t);
    if (aid && (String(aid) === String(user.id) || String(aid) === String(user.email))) return true;
    const a = assigneeOf(t);
    return a && (a.id === user.id || (a.email && a.email === user.email));
  };

  const stats = useMemo(() => {
    const mine = tasks.filter(isMine);
    return {
      mine: mine.length,
      overdue: tasks.filter((t) => t.status !== "completed" && isOverdue(t.due_date)).length,
      week: tasks.filter(
        (t) => !isOngoingTask(t) && t.status !== "completed" && isDueWithin(t.due_date, 7),
      ).length,
      done: tasks.filter((t) => t.status === "completed").length,
      ongoing: tasks.filter(isOngoingTask).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, user]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t._project?.id && !map.has(t._project.id)) map.set(t._project.id, t._project.name);
    });
    return [...map.entries()];
  }, [tasks]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        const q = search.trim().toLowerCase();
        if (tab === "ongoing") {
          if (!isOngoingTask(t)) return false;
        } else if (tab !== "all" && (t.status || "pending") !== tab) {
          return false;
        }
        if (priority && t.priority !== priority) return false;
        if (project && String(t._project?.id) !== String(project)) return false;
        if (onlyMine && !isMine(t)) return false;
        if (
          q &&
          !`${t.title || ""} ${taskDescriptionText(t)} ${t._project?.name || ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, tab, search, priority, project, onlyMine, user]
  );

  const tabsWithCounts = TABS.map((t) => ({
    ...t,
    count:
      t.key === "all"
        ? tasks.length
        : t.key === "ongoing"
          ? tasks.filter(isOngoingTask).length
          : tasks.filter((x) => (x.status || "pending") === t.key).length,
  }));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const openTask = (t) => {
    if (t._project?.id) navigate(`/admin/projects/${t._project.id}?task=${t.id}`);
  };

  return (
    <LayoutAdmin
      title="Mi trabajo"
      subtitle="Todas las tareas de tus proyectos en un solo lugar"
      actions={
        <Button variant={onlyMine ? "primary" : "secondary"} onClick={() => setOnlyMine((v) => !v)}>
          <FiUser /> {onlyMine ? "Viendo: mis tareas" : "Solo mis tareas"}
        </Button>
      }
    >
      {/* ---------- Resumen ---------- */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Mis tareas" value={stats.mine} icon={FiCheckSquare} tone="brand" hint="Asignadas a ti" />
        <StatCard label="Vencidas" value={stats.overdue} icon={FiAlertTriangle} tone="red" hint="Requieren atención" />
        <StatCard label="Vencen esta semana" value={stats.week} icon={FiCalendar} tone="amber" hint="Próximos 7 días" />
        <StatCard
          label="Continuas"
          value={stats.ongoing}
          icon={FiRepeat}
          tone="violet"
          hint="Sin fecha de entrega"
        />
        <StatCard label="Finalizadas" value={stats.done} icon={FiCheckCircle} tone="green" hint="Trabajo completado" />
      </div>

      <Card className="mt-6 overflow-hidden">
        {/* Filtros */}
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar tarea o proyecto..."
              className="w-full lg:ml-auto lg:max-w-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="admin-input !w-auto !py-2 text-[13px]" aria-label="Filtrar por prioridad">
              <option value="">Prioridad: todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <select value={project} onChange={(e) => setProject(e.target.value)} className="admin-input !w-auto max-w-64 !py-2 text-[13px]" aria-label="Filtrar por proyecto">
              <option value="">Proyecto: todos</option>
              {projectOptions.map(([pid, name]) => (
                <option key={pid} value={pid}>{name}</option>
              ))}
            </select>
            {(priority || project || search || tab !== "all" || onlyMine) && (
              <button
                type="button"
                onClick={() => { setPriority(""); setProject(""); setSearch(""); setTab("all"); setOnlyMine(false); }}
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                Limpiar filtros
              </button>
            )}
            <span className="ml-auto text-sm text-slate-500">
              {filtered.length} tarea{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FiCheckSquare}
            title={onlyMine ? "No tienes tareas asignadas" : "No se encontraron tareas"}
            description="Ajusta los filtros o crea tareas desde el tablero de un proyecto."
            action={<Button variant="secondary" onClick={() => navigate("/admin/projects")}>Ir a proyectos</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="admin-table-head">
                    <th className="px-6 py-3.5">Tarea</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5">Prioridad</th>
                    <th className="px-6 py-3.5">Responsable</th>
                    <th className="px-6 py-3.5">Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((t) => {
                    const status = taskStatusMeta(t.status);
                    const prio = priorityMeta(t.priority);
                    const schedule = taskSchedule(t);
                    const ongoing = schedule.kind === "ongoing";
                    const late = schedule.kind === "overdue";
                    const who = assigneeOf(t) || users.find((u) => String(u.id) === String(assigneeIdOf(t)));
                    return (
                      <tr key={`${t._project?.id}-${t.id}`} onClick={() => openTask(t)} className="cursor-pointer transition hover:bg-slate-50">
                        <td className="max-w-80 px-6 py-3.5">
                          <p className="truncate font-medium text-slate-800">{t.title}</p>
                          <p className="truncate text-xs text-slate-400">
                            {t._project ? (
                              <Link
                                to={`/admin/projects/${t._project.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-brand-600 hover:underline"
                              >
                                {t._project.name}
                              </Link>
                            ) : "—"}
                          </p>
                        </td>
                        <td className="px-6 py-3.5"><Badge tone={status.tone} dot>{status.label}</Badge></td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <i className={cx("h-2 w-2 rounded-full", prio.dot)} /> {prio.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-2 text-slate-600">
                            <Avatar user={who} size="xs" /> {who?.name || "Sin asignar"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {ongoing ? (
                            <span
                              className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-brand-600"
                              title={schedule.detail}
                            >
                              <FiRepeat />
                              {ongoingLabel(t)}
                            </span>
                          ) : (
                            <span className={cx("flex items-center gap-1.5 whitespace-nowrap", late ? "font-semibold text-red-600" : "text-slate-600")}>
                              <FiClock className="text-slate-300" />
                              {t.due_date ? formatDate(t.due_date) : "—"}
                              {late && <Badge tone="red">Vencida</Badge>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-6 py-3.5 sm:flex-row">
              <p className="text-sm text-slate-500">
                Página {page + 1} de {totalPages} · {filtered.length} tareas
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <FiChevronLeft /> Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente <FiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </LayoutAdmin>
  );
};

export default Tasks;
