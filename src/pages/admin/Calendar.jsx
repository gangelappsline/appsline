import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiFlag } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Badge, Card, CardHeader, MonthGrid, useToast } from "../../components/admin";
import { fetchAllTasks } from "../../services/admin";
import { formatDate, taskStatusMeta } from "../../utils/format";
import { addMonths, dayKey, firstOfMonth } from "../../utils/calendar";

const Calendar = () => {
  const { notify } = useToast();
  const today = new Date();
  const [cursor, setCursor] = useState(() => firstOfMonth(today));
  const [selected, setSelected] = useState(dayKey(today));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { tasks, projects } = await fetchAllTasks();
        const list = [];
        tasks.forEach((t) => {
          if (!t.due_date) return;
          list.push({
            key: `task-${t._project?.id}-${t.id}`,
            date: String(t.due_date).slice(0, 10),
            title: t.title,
            kind: "task",
            status: taskStatusMeta(t.status),
            project: t._project,
            taskId: t.id,
            priority: t.priority,
          });
        });
        projects.forEach((p) => {
          if (!p.end_date) return;
          list.push({
            key: `project-${p.id}`,
            date: String(p.end_date).slice(0, 10),
            title: `Entrega: ${p.name}`,
            kind: "milestone",
            project: { id: p.id, name: p.name },
          });
        });
        setEvents(list);
      } catch {
        setEvents([]);
        notify("No se pudieron cargar los eventos", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvents = useMemo(
    () => events.filter((e) => e.date === selected),
    [events, selected]
  );

  const goToday = () => {
    setCursor(firstOfMonth(today));
    setSelected(dayKey(today));
  };

  return (
    <LayoutAdmin
      title="Calendario"
      subtitle="Vencimientos de tareas y entregas de proyectos"
      actions={
        <button type="button" onClick={goToday} className="btn-secondary">
          Hoy
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Mes ---------- */}
        <MonthGrid
          className="lg:col-span-2"
          cursor={cursor}
          onMove={(delta) => setCursor((c) => addMonths(c, delta))}
          events={events}
          loading={loading}
          selected={selected}
          onSelect={setSelected}
          toneOf={(event) => (event.kind === "milestone" ? "violet" : "sky")}
          footer={
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Vencimiento de tarea
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Entrega de proyecto
              </span>
            </div>
          }
        />

        {/* ---------- Detalle del día ---------- */}
        <Card className="h-fit p-5 sm:p-6">
          <CardHeader
            title={formatDate(selected)}
            subtitle={`${selectedEvents.length} evento${selectedEvents.length === 1 ? "" : "s"}`}
          />
          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="rounded-2xl bg-slate-100 p-3.5 text-xl text-slate-400">
                <FiCalendar />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-600">Nada programado</p>
              <p className="mt-1 text-xs text-slate-400">
                Selecciona otro día para ver sus eventos.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {selectedEvents.map((e) => (
                <li key={e.key}>
                  <Link
                    to={
                      e.kind === "milestone" || !e.taskId
                        ? `/admin/projects/${e.project?.id}`
                        : `/admin/projects/${e.project?.id}?task=${e.taskId}`
                    }
                    className="block rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <p className="text-sm font-semibold leading-5 text-slate-800">{e.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.kind === "milestone" ? (
                        <Badge tone="violet" dot>
                          Entrega
                        </Badge>
                      ) : (
                        <Badge tone={e.status.tone} dot>
                          {e.status.label}
                        </Badge>
                      )}
                      {e.priority === "high" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                          <FiFlag /> Alta prioridad
                        </span>
                      )}
                    </div>
                    {e.project?.name && (
                      <p className="mt-1.5 truncate text-xs text-slate-400">
                        {e.project.name}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </LayoutAdmin>
  );
};

export default Calendar;
