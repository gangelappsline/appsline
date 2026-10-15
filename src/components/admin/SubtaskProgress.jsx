/* eslint-disable react/prop-types, react-refresh/only-export-components */
/**
 * Resumen de subtareas compartido por la tarjeta del tablero, el detalle y la
 * tabla de listas. Las subtareas pueden venir **dentro** de la tarea
 * (`task.subtasks`) o **en otra petición** (`GET /tasks/{id}/subtasks`), así que
 * el rollup se calcula dentro del componente y se resume en la tarjeta.
 *
 * Los ayudantes (`subtaskRollup`, `isSubtaskDone`) se exportan aquí a propósito:
 * son la única definición de "subtarea hecha" y viven junto al componente que
 * los pinta (el aviso de fast-refresh no aplica a este archivo de una sola
 * componente + funciones puras).
 */
/**
 * Resumen de subtareas compartido por la tarjeta del tablero, el detalle y la
 * tabla de listas. Las subtareas pueden venir **dentro** de la tarea
 * (`task.subtasks`) o **en otra petición** (`GET /tasks/{id}/subtasks`), así que
 * el rollup se calcula dentro del componente y se resume en la tarjeta.
 */
import { useMemo } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { cx } from "../../utils/format";

/** ¿La subtarea está hecha? (la API usa `completed` o `status`). */
export const isSubtaskDone = (subtask) =>
  Boolean(subtask?.completed) || subtask?.status === "completed";

/** Cuenta hechas/total de una tarea a partir de sus subtareas. */
export const subtaskRollup = (subtasks = [], fallback = null) => {
  const list = Array.isArray(subtasks) ? subtasks : [];
  const total = list.length || Number(fallback?.total) || 0;
  const done = list.length
    ? list.filter(isSubtaskDone).length
    : Number(fallback?.done) || 0;
  return {
    done: Math.min(done, total || done),
    total,
    percent: total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0,
  };
};

/**
 * Barra de progreso de subtareas.
 * `total = 0` no pinta nada salvo que se pida explícitamente (`showEmpty`).
 */
const SubtaskProgress = ({
  subtasks = [],
  done = null,
  total = null,
  showEmpty = false,
  showLabel = false,
  className = "",
  barClassName = "bg-emerald-500",
  compact = false,
}) => {
  const rollup = useMemo(
    () => subtaskRollup(subtasks, { done, total }),
    [subtasks, done, total]
  );

  if (!rollup.total && !showEmpty) return null;

  return (
    <div className={cx("min-w-0", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-medium text-slate-500">
            <FiCheckCircle /> {rollup.done}/{rollup.total} subtareas
          </span>
          <span className="font-bold tabular-nums text-slate-600">
            {rollup.percent}%
          </span>
        </div>
      )}
      <div
        className={cx(
          "overflow-hidden rounded-full bg-slate-100",
          showLabel ? "mt-1.5" : "",
          compact ? "h-1" : "h-1.5"
        )}
        role="progressbar"
        aria-valuenow={rollup.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Subtareas completadas: ${rollup.done} de ${rollup.total}`}
      >
        <div
          className={cx("h-full rounded-full transition-all", barClassName)}
          style={{ width: `${rollup.percent}%` }}
        />
      </div>
    </div>
  );
};

export default SubtaskProgress;
