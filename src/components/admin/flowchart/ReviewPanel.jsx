/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiChevronRight,
  FiCornerDownRight,
  FiMessageSquare,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { cx } from "../../../utils/format";
import { widgetMeta } from "../../../utils/mockups";

/**
 * Revisión del diagrama: comentarios del equipo anclados a una pantalla o a un
 * elemento concreto.
 *
 * Los comentarios viajan dentro del diagrama (`data.comments`) y se guardan con
 * el mismo endpoint que el resto del mockup, así que todo el equipo los ve al
 * abrir el diagrama. Contrato y opción de tabla propia: `docs/API-MOCKUPS.md`.
 */

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

const relative = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

const ReviewPanel = ({
  comments = [],
  screens = [],
  selection = null,
  currentUser = null,
  onAdd,
  onResolve,
  onDelete,
  onFocus,
  onClearResolved,
  onClose,
}) => {
  const [filter, setFilter] = useState("open");
  const [text, setText] = useState("");
  const [anchor, setAnchor] = useState("selection");
  const [targetNode, setTargetNode] = useState(screens[0]?.id || "");

  const activeScreenId =
    selection?.nodeId && screens.some((screen) => screen.id === selection.nodeId)
      ? selection.nodeId
      : targetNode || screens[0]?.id || "";

  const activeWidget = selection?.widget
    ? screens.find((screen) => screen.id === selection.nodeId)?.data?.widgets?.find((w) => w.id === selection.widget)
    : null;

  const resolvedCount = comments.filter((comment) => comment.resolved).length;
  const openCount = comments.length - resolvedCount;

  const visible = useMemo(() => {
    const list = filter === "all" ? comments : comments.filter((comment) => (filter === "open" ? !comment.resolved : comment.resolved));
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [comments, filter]);

  const screenName = (id) => screens.find((screen) => screen.id === id)?.data?.label || "";

  const submit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const nodeId = anchor === "none" ? null : activeScreenId || null;
    const widgetId = anchor === "widget" && activeWidget ? activeWidget.id : null;
    onAdd?.({ text: value, nodeId, widgetId });
    setText("");
  };

  return (
    <aside
      aria-label="Comentarios del diagrama"
      className="absolute inset-y-0 right-0 z-30 flex w-80 max-w-[92vw] shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <FiMessageSquare className="text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800">Revisión del equipo</p>
          <p className="text-[11px] text-slate-400">
            {openCount} abierto{openCount === 1 ? "" : "s"} · {resolvedCount} resuelto{resolvedCount === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar comentarios" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <FiX />
        </button>
      </header>

      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        {[
          { key: "open", label: `Abiertos (${openCount})` },
          { key: "resolved", label: `Resueltos (${resolvedCount})` },
          { key: "all", label: "Todos" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={cx(
              "rounded-lg px-2 py-1 text-[11px] font-semibold transition",
              filter === item.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {item.label}
          </button>
        ))}
        {resolvedCount > 0 && (
          <button type="button" onClick={onClearResolved} title="Quitar los comentarios resueltos" className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600">
            <FiRefreshCw />
          </button>
        )}
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {!visible.length && (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center">
            <FiMessageSquare className="mx-auto mb-1.5 text-xl text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Sin comentarios {filter === "open" ? "abiertos" : ""}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              Selecciona una pantalla o un elemento del mockup y deja tu opinión para que el equipo la revise.
            </p>
          </div>
        )}
        {visible.map((comment) => {
          const widget = comment.widget_id
            ? screens.find((screen) => screen.id === comment.node_id)?.data?.widgets?.find((item) => item.id === comment.widget_id)
            : null;
          return (
            <article
              key={comment.id}
              className={cx(
                "rounded-xl border p-2.5 transition",
                comment.resolved ? "border-emerald-100 bg-emerald-50/40" : "border-slate-200 bg-white",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                  {initials(comment.author?.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-700">{comment.author?.name || "Equipo"}</p>
                  <p className="text-[10px] text-slate-400">{relative(comment.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onResolve?.(comment.id)}
                  title={comment.resolved ? "Reabrir" : "Marcar como resuelto"}
                  className={cx(
                    "rounded-md p-1 transition",
                    comment.resolved ? "text-emerald-600 hover:bg-emerald-100" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600",
                  )}
                >
                  <FiCheckCircle />
                </button>
                <button type="button" onClick={() => onDelete?.(comment.id)} title="Eliminar comentario" className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <FiTrash2 />
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-4 text-slate-700">{comment.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {comment.node_id && (
                  <button
                    type="button"
                    onClick={() => onFocus?.(comment)}
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                    title="Ver en el lienzo"
                  >
                    {screenName(comment.node_id) || "Pantalla"} <FiChevronRight />
                  </button>
                )}
                {widget && (
                  <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                    {widgetMeta(widget.type).label}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={submit} className="border-t border-slate-100 p-2.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor("selection")}
            aria-pressed={anchor === "selection"}
            className={cx(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              anchor === "selection" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            )}
          >
            {screenName(activeScreenId) || "Pantalla"}
          </button>
          {activeWidget && (
            <button
              type="button"
              onClick={() => setAnchor("widget")}
              aria-pressed={anchor === "widget"}
              className={cx(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                anchor === "widget" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              {widgetMeta(activeWidget.type).label}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAnchor("none")}
            aria-pressed={anchor === "none"}
            className={cx(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              anchor === "none" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            )}
          >
            Diagrama
          </button>
        </div>
        {anchor !== "none" && screens.length > 0 && (
          <label className="mb-1.5 flex items-center gap-1 text-[10px] text-slate-400">
            <FiCornerDownRight />
            <select
              value={activeScreenId}
              onChange={(event) => setTargetNode(event.target.value)}
              aria-label="Pantalla del comentario"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600"
            >
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.data?.label || "Pantalla"}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(event);
          }}
          rows={2}
          placeholder="Escribe una opinión o una duda para el equipo…"
          aria-label="Nuevo comentario"
          className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-slate-400">{currentUser?.name ? `Como ${currentUser.name}` : "Ctrl + Enter para enviar"}</span>
          <button type="submit" disabled={!text.trim()} className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40">
            <FiPlus /> Comentar
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
          Los comentarios se guardan con el diagrama; todo el equipo los ve al abrirlo.
        </p>
      </form>
    </aside>
  );
};

export default ReviewPanel;
