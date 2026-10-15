/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiChevronDown,
  FiEye,
  FiFlag,
  FiInfo,
  FiRepeat,
  FiX,
} from "react-icons/fi";
import { Badge, MonthGrid } from "../../../components/admin";
import {
  cx,
  formatDate,
  isOverdue,
  priorityMeta,
  taskStatusMeta,
} from "../../../utils/format";
import { isOngoingTask, ongoingLabel } from "../../../utils/tasks";
import {
  addMonths,
  dateFromKey,
  dayKey,
  firstOfMonth,
  isSameMonth,
} from "../../../utils/calendar";

const MONTH_LABEL_BY_MONTH = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Tipos de evento que pinta el calendario del proyecto. */
const MILESTONE_TONES = {
  start: "slate",
  end: "violet",
};

/**
 * Pestaña **Calendario** del proyecto: vencimientos de sus tareas y
 * entregas del proyecto en una vista mensual.
 *
 * - Recibe las tareas ya filtradas por la barra de filtros de la página,
 *   así que buscar/prioridad/responsable también acotan el calendario.
 * - Arrastrar una tarea a otro día la reprograma (`onReschedule`).
 * - Las tareas sin fecha se pueden agendar desde el panel "Sin fecha".
 */
const CalendarTab = ({ project, tasks = [], onOpenTask, onReschedule }) => {
  const todayKey = dayKey(new Date());
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [selected, setSelected] = useState(todayKey);

  const [cursor, setCursor] = useState(() => {
    // Mes con actividad: el actual si tiene eventos, si no el del próximo
    // vencimiento (o el de la entrega del proyecto).
    const today = firstOfMonth(new Date());
    const dated = tasks
      .map((task) => dayKey(task.due_date))
      .filter(Boolean)
      .sort();
    if (dated.some((key) => key.slice(0, 7) === dayKey(today).slice(0, 7))) return today;
    const next = dated.find((key) => key >= todayKey);
    if (next) return firstOfMonth(dateFromKey(next));
    if (project?.end_date) return firstOfMonth(new Date(`${String(project.end_date).slice(0, 10)}T12:00:00`));
    return today;
  });

  /* ---------------- Eventos ---------------- */
  const visibleTasks = useMemo(
    () => (hideCompleted ? tasks.filter((t) => t.status !== "completed") : tasks),
    [tasks, hideCompleted]
  );

  const events = useMemo(() => {
    const list = visibleTasks
      .filter((task) => Boolean(task.due_date))
      .map((task) => {
        const late = isOverdue(task.due_date) && task.status !== "completed";
        const status = taskStatusMeta(task.status);
        return {
          key: `task-${task.id}`,
          kind: "task",
          task,
          date: dayKey(task.due_date),
          title: task.title || `Tarea #${task.id}`,
          tone: late ? "red" : status.tone,
          late,
          status,
          priority: task.priority,
        };
      });

    if (project?.start_date) {
      list.push({
        key: "milestone-start",
        kind: "milestone",
        date: dayKey(project.start_date),
        title: "Inicio del proyecto",
        tone: MILESTONE_TONES.start,
        draggable: false,
      });
    }
    if (project?.end_date) {
      list.push({
        key: "milestone-end",
        kind: "milestone",
        date: dayKey(project.end_date),
        title: "Entrega del proyecto",
        tone: MILESTONE_TONES.end,
        draggable: false,
      });
    }
    return list.filter((event) => Boolean(event.date));
  }, [visibleTasks, project?.start_date, project?.end_date]);

  const selectedEvents = useMemo(
    () => events.filter((event) => event.date === selected),
    [events, selected]
  );

  const ongoingTasks = useMemo(
    () => visibleTasks.filter(isOngoingTask),
    [visibleTasks]
  );

  // Las tareas continuas (ongoing) no se agendan: no aparecen en "Sin fecha".
  const unscheduled = useMemo(
    () => visibleTasks.filter((task) => !task.due_date && !isOngoingTask(task)),
    [visibleTasks]
  );

  const stats = useMemo(() => {
    const dated = visibleTasks.filter((task) => Boolean(task.due_date));
    return {
      dated: dated.length,
      late: dated.filter((task) => isOverdue(task.due_date) && task.status !== "completed").length,
      month: dated.filter((task) => isSameMonth(task.due_date, cursor)).length,
      unscheduled: unscheduled.length,
    };
  }, [visibleTasks, unscheduled, cursor]);

  const reschedule = (task, value) => {
    if (!task || !onReschedule) return;
    const next = value ? dayKey(value) : null;
    if (next === dayKey(task.due_date)) return;
    onReschedule(task, next);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-5">
        {/* ---------- Resumen ---------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat icon={FiCalendar} label="Con fecha" value={stats.dated} tone="brand" />
          <MiniStat
            icon={FiCalendar}
            label={`En ${MONTH_LABEL_BY_MONTH[cursor.getMonth()]}`}
            value={stats.month}
            tone="sky"
          />
          <MiniStat
            icon={FiAlertTriangle}
            label="Vencidas"
            value={stats.late}
            tone={stats.late ? "red" : "slate"}
          />
          <MiniStat
            icon={FiInfo}
            label="Sin fecha"
            value={stats.unscheduled}
            tone={stats.unscheduled ? "amber" : "slate"}
          />
        </div>

        {/* ---------- Mes ---------- */}
        <MonthGrid
          cursor={cursor}
          onMove={(delta) => setCursor((current) => addMonths(current, delta))}
          events={events}
          selected={selected}
          onSelect={setSelected}
          toneOf={(event) => event.tone}
          onEventClick={(event) => event.task && onOpenTask?.(event.task)}
          onDropOnDay={(key, event) => event.task && reschedule(event.task, key)}
          chips={3}
          headerExtra={
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                />
                Ocultar finalizadas
              </label>
              <button
                type="button"
                onClick={() => {
                  setCursor(firstOfMonth(new Date()));
                  setSelected(todayKey);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Hoy
              </button>
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Pendiente
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-sky-500" /> En progreso
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Finalizada
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-red-500" /> Vencida / rechazada
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />{" "}
                  Entrega del proyecto
                </span>
              </div>
              {onReschedule && (
                <p className="text-xs text-slate-400">
                  Arrastra una tarea a otro día para reprogramarla.
                </p>
              )}
            </div>
          }
        />

        {/* ---------- Tareas sin fecha ---------- */}
        <section className="admin-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowUnscheduled((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
            aria-expanded={showUnscheduled}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <FiInfo className="text-amber-500" /> Tareas sin fecha
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-500">
                {unscheduled.length}
              </span>
            </span>
            <FiChevronDown
              className={cx("text-slate-400 transition", showUnscheduled && "rotate-180")}
            />
          </button>

          {showUnscheduled && (
            <div className="border-t border-slate-100">
              {unscheduled.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-slate-400">
                  {ongoingTasks.length > 0
                    ? "Todas las tareas puntuales ya tienen fecha de entrega."
                    : "Todas las tareas del filtro actual tienen fecha de entrega."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {unscheduled.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap"
                    >
                      <span
                        className={cx(
                          "h-2 w-2 shrink-0 rounded-full",
                          taskStatusMeta(task.status).tone === "green"
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => onOpenTask?.(task)}
                        className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-700 transition hover:text-brand-700"
                      >
                        {task.title}
                      </button>
                      <Badge tone={taskStatusMeta(task.status).tone}>
                        {taskStatusMeta(task.status).label}
                      </Badge>
                      <input
                        type="date"
                        value=""
                        onChange={(e) => reschedule(task, e.target.value)}
                        aria-label={`Asignar fecha a ${task.title}`}
                        className="admin-input !w-auto !py-1.5 text-[13px]"
                      />
                    </li>
                  ))}
                </ul>
              )}

              {ongoingTasks.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                  <FiRepeat className="text-brand-500" />
                  <span>
                    {ongoingTasks.length} tarea
                    {ongoingTasks.length === 1 ? "" : "s"} continua
                    {ongoingTasks.length === 1 ? "" : "s"} sin fecha de entrega
                    (no se agenda{ongoingTasks.length === 1 ? "" : "n"}):
                  </span>
                  {ongoingTasks.slice(0, 4).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask?.(task)}
                      title={ongoingLabel(task)}
                      className="max-w-40 truncate font-semibold text-slate-500 transition hover:text-brand-600"
                    >
                      {task.title}
                    </button>
                  ))}
                  {ongoingTasks.length > 4 && <span>y {ongoingTasks.length - 4} más</span>}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ---------- Detalle del día ---------- */}
      <aside className="admin-card h-fit overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{formatDate(selected)}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {selectedEvents.length} evento{selectedEvents.length === 1 ? "" : "s"}
            </p>
          </div>
          {selected !== todayKey && (
            <button
              type="button"
              onClick={() => setSelected(todayKey)}
              className="text-xs font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Ir a hoy
            </button>
          )}
        </header>

        {selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <span className="rounded-2xl bg-slate-100 p-3.5 text-xl text-slate-400">
              <FiCalendar />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-600">Nada programado</p>
            <p className="mt-1 text-xs text-slate-400">
              {onReschedule
                ? "Selecciona otro día o arrastra una tarea hasta aquí."
                : "Selecciona otro día para ver sus eventos."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {selectedEvents.map((event) =>
              event.kind === "milestone" ? (
                <MilestoneRow key={event.key} event={event} />
              ) : (
                <TaskRow
                  key={event.key}
                  event={event}
                  onOpen={() => onOpenTask?.(event.task)}
                  onReschedule={(value) => reschedule(event.task, value)}
                />
              )
            )}
          </ul>
        )}
      </aside>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const TONES = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-500 ring-red-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

const MiniStat = ({ icon: Icon, label, value, tone = "brand" }) => (
  <div className="admin-card flex items-center gap-3 px-4 py-3.5">
    <span
      className={cx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
        TONES[tone] || TONES.brand
      )}
    >
      <Icon />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  </div>
);

const MilestoneRow = ({ event }) => (
  <li className="flex items-start gap-3 px-5 py-4">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
      <FiFlag />
    </span>
    <div className="min-w-0">
      <p className="text-[13px] font-semibold leading-5 text-slate-800">{event.title}</p>
      <p className="mt-0.5 text-xs text-slate-400">Hito del proyecto</p>
    </div>
  </li>
);

const TaskRow = ({ event, onOpen, onReschedule }) => {
  const prio = priorityMeta(event.priority);
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            event.late ? "bg-red-500" : "bg-slate-300"
          )}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full truncate text-left text-[13px] font-semibold text-slate-800 transition hover:text-brand-700"
          >
            {event.title}
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={event.status.tone} dot>
              {event.status.label}
            </Badge>
            {event.late && <Badge tone="red">Vencida</Badge>}
            {event.priority === "high" && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                <FiFlag /> Alta
              </span>
            )}
            <span className={cx("flex items-center gap-1 text-[11px] font-medium", prio.text)}>
              <i className={cx("h-1.5 w-1.5 rounded-full", prio.dot)} /> {prio.label}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              Reprogramar
              <input
                type="date"
                value={event.date}
                onChange={(e) => onReschedule?.(e.target.value)}
                className="admin-input !w-auto !px-2 !py-1 text-[12px]"
              />
            </label>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-50"
            >
              <FiEye /> Ver tarea
            </button>
            <button
              type="button"
              onClick={() => onReschedule?.("")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              <FiX /> Quitar fecha
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

export default CalendarTab;
