import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiFlag } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Badge, Card, CardHeader, useToast } from "../../components/admin";
import { fetchAllTasks } from "../../services/admin";
import { cx, formatDate, taskStatusMeta } from "../../utils/format";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Calendar = () => {
  const { notify } = useToast();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
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

  const byDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      (map[e.date] = map[e.date] || []).push(e);
    });
    return map;
  }, [events]);

  // Celdas del mes (semana inicia en lunes).
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const selectedEvents = byDay[selected] || [];
  const monthCount = events.filter((e) => e.date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)).length;

  const move = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <LayoutAdmin
      title="Calendario"
      subtitle="Vencimientos de tareas y entregas de proyectos"
      actions={
        <button
          type="button"
          onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(dayKey(today)); }}
          className="btn-secondary"
        >
          Hoy
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Mes ---------- */}
        <Card className="overflow-hidden p-5 sm:p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {MONTHS[cursor.getMonth()]} <span className="font-medium text-slate-400">{cursor.getFullYear()}</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="mr-2 hidden text-sm text-slate-400 sm:block">{monthCount} eventos</span>
              <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                <FiChevronLeft />
              </button>
              <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                <FiChevronRight />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1.5" aria-label="Cargando calendario">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 sm:h-24" />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => (
                  <p key={d} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((date, i) => {
                  if (!date) return <div key={`blank-${i}`} className="h-20 sm:h-24" />;
                  const key = dayKey(date);
                  const dayEvents = byDay[key] || [];
                  const isToday = key === dayKey(today);
                  const isSelected = key === selected;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      className={cx(
                        "flex h-20 flex-col rounded-xl border p-1.5 text-left transition sm:h-24 sm:p-2",
                        isSelected
                          ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-200"
                          : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className={cx(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                        isToday ? "bg-brand-600 text-white" : "text-slate-700"
                      )}>
                        {date.getDate()}
                      </span>
                      <span className="mt-1 hidden flex-col gap-1 sm:flex">
                        {dayEvents.slice(0, 2).map((e) => (
                          <span
                            key={e.key}
                            className={cx(
                              "truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              e.kind === "milestone" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                            )}
                          >
                            {e.title}
                          </span>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="px-1 text-[11px] font-semibold text-slate-400">+{dayEvents.length - 2} más</span>
                        )}
                      </span>
                      {/* En móvil: puntos */}
                      <span className="mt-auto flex gap-1 px-0.5 pb-0.5 sm:hidden">
                        {dayEvents.slice(0, 3).map((e) => (
                          <i key={e.key} className={cx("h-1.5 w-1.5 rounded-full", e.kind === "milestone" ? "bg-violet-500" : "bg-sky-500")} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Vencimiento de tarea</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Entrega de proyecto</span>
              </div>
            </>
          )}
        </Card>

        {/* ---------- Detalle del día ---------- */}
        <Card className="h-fit p-5 sm:p-6">
          <CardHeader
            title={formatDate(selected)}
            subtitle={`${selectedEvents.length} evento${selectedEvents.length === 1 ? "" : "s"}`}
          />
          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="rounded-2xl bg-slate-100 p-3.5 text-xl text-slate-400"><FiCalendar /></span>
              <p className="mt-3 text-sm font-medium text-slate-600">Nada programado</p>
              <p className="mt-1 text-xs text-slate-400">Selecciona otro día para ver sus eventos.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {selectedEvents.map((e) => (
                <li key={e.key}>
                  <Link
                    to={e.kind === "milestone" || !e.taskId
                      ? `/admin/projects/${e.project?.id}`
                      : `/admin/projects/${e.project?.id}?task=${e.taskId}`}
                    className="block rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <p className="text-sm font-semibold leading-5 text-slate-800">{e.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.kind === "milestone" ? (
                        <Badge tone="violet" dot>Entrega</Badge>
                      ) : (
                        <Badge tone={e.status.tone} dot>{e.status.label}</Badge>
                      )}
                      {e.priority === "high" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                          <FiFlag /> Alta prioridad
                        </span>
                      )}
                    </div>
                    {e.project?.name && (
                      <p className="mt-1.5 truncate text-xs text-slate-400">{e.project.name}</p>
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
