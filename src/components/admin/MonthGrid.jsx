/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { cx } from "../../utils/format";
import {
  MONTHS,
  WEEKDAYS,
  calendarCells,
  dayKey,
  eventTone,
  isSameMonth,
} from "../../utils/calendar";

/**
 * Vista mensual reutilizable (Calendario global y pestaña Calendario del
 * proyecto).
 *
 * Los eventos son objetos con `{ key, date, title, tone }`; `date` acepta
 * cualquier formato de fecha del API. Opcionalmente:
 *  - `onEventClick` abre el detalle del evento que recibe el clic.
 *  - `onDropOnDay(dayKey, event)` habilita arrastrar los chips a otro día
 *    (reprogramar) y resalta el día destino.
 *
 * @example
 * <MonthGrid cursor={cursor} onMove={(d) => setCursor((c) => addMonths(c, d))}
 *   events={events} selected={selected} onSelect={setSelected}
 *   onEventClick={openTask} onDropOnDay={reschedule}
 *   footer={<Legend />} />
 */
const MonthGrid = ({
  cursor,
  onMove,
  events = [],
  loading = false,
  selected,
  onSelect,
  toneOf,
  renderEvent,
  onEventClick,
  onDropOnDay,
  chips = 2,
  headerExtra,
  footer,
  className = "",
}) => {
  const [dragging, setDragging] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const cells = useMemo(() => calendarCells(cursor), [cursor]);

  const byDay = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const key = dayKey(event.date);
      if (!key) return;
      (map[key] = map[key] || []).push(event);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => String(a.title).localeCompare(String(b.title), "es"))
    );
    return map;
  }, [events]);

  const monthCount = useMemo(
    () => events.filter((event) => isSameMonth(event.date, cursor)).length,
    [events, cursor]
  );

  const todayKey = dayKey(new Date());
  const droppable = typeof onDropOnDay === "function";

  const handleDragStart = (event) => (e) => {
    setDragging(event);
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(event.key ?? event.title ?? ""));
    } catch {
      /* Algunos navegadores no permiten escribir en dataTransfer. */
    }
  };

  const handleDrop = (key) => (e) => {
    if (!dragging) return;
    e.preventDefault();
    setOverDay(null);
    const dropped = dragging;
    setDragging(null);
    if (dayKey(dropped.date) !== key) onDropOnDay(key, dropped);
  };

  return (
    <section className={cx("admin-card overflow-hidden p-5 sm:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {MONTHS[cursor.getMonth()]}{" "}
          <span className="font-medium text-slate-400">{cursor.getFullYear()}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          {headerExtra}
          {!loading && (
            <span className="mr-1 hidden text-sm text-slate-400 sm:block">
              {monthCount} evento{monthCount === 1 ? "" : "s"}
            </span>
          )}
          {onMove && (
            <>
              <button
                type="button"
                onClick={() => onMove(-1)}
                aria-label="Mes anterior"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                aria-label="Mes siguiente"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <FiChevronRight />
              </button>
            </>
          )}
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
            {WEEKDAYS.map((day) => (
              <p
                key={day}
                className="pb-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400"
              >
                {day}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} className="min-h-20 sm:min-h-24" />;
              const key = dayKey(date);
              const dayEvents = byDay[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selected;
              const isTarget = droppable && overDay === key;

              return (
                <div
                  key={key}
                  onClick={() => onSelect?.(key)}
                  onDragOver={
                    droppable
                      ? (e) => {
                          if (!dragging) return;
                          e.preventDefault();
                          if (overDay !== key) setOverDay(key);
                        }
                      : undefined
                  }
                  onDragLeave={
                    droppable ? () => setOverDay((old) => (old === key ? null : old)) : undefined
                  }
                  onDrop={droppable ? handleDrop(key) : undefined}
                  className={cx(
                    "flex min-h-20 flex-col rounded-xl border p-1.5 transition sm:min-h-24 sm:p-2",
                    isSelected
                      ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-200"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50",
                    isTarget && "border-brand-400 bg-brand-50/80 ring-2 ring-brand-300"
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(key);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Seleccionar ${date.getDate()} de ${MONTHS[date.getMonth()]}`}
                    className={cx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition",
                      isToday
                        ? "bg-brand-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {date.getDate()}
                  </button>

                  <span className="mt-1 hidden min-w-0 flex-col gap-1 sm:flex">
                    {dayEvents.slice(0, chips).map((event) => {
                      const tone = eventTone(toneOf ? toneOf(event) : event.tone);
                      const Draggable = droppable && event.draggable !== false;
                      return (
                        <button
                          key={event.key}
                          type="button"
                          draggable={Draggable}
                          onDragStart={Draggable ? handleDragStart(event) : undefined}
                          onDragEnd={Draggable ? () => setDragging(null) : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                          title={event.title}
                          className={cx(
                            "truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ring-inset transition",
                            tone.chip,
                            Draggable && "cursor-grab active:cursor-grabbing hover:ring-brand-200",
                            dragging?.key === event.key && "opacity-60"
                          )}
                        >
                          {renderEvent ? renderEvent(event) : event.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > chips && (
                      <span className="px-1 text-[11px] font-semibold text-slate-400">
                        +{dayEvents.length - chips} más
                      </span>
                    )}
                  </span>

                  {/* En móvil: solo puntos de color */}
                  <span className="mt-auto flex gap-1 px-0.5 pb-0.5 sm:hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <i
                        key={event.key}
                        className={cx(
                          "h-1.5 w-1.5 rounded-full",
                          eventTone(toneOf ? toneOf(event) : event.tone).dot
                        )}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          {footer && <div className="mt-4 border-t border-slate-100 pt-4">{footer}</div>}
        </>
      )}
    </section>
  );
};

export default MonthGrid;
