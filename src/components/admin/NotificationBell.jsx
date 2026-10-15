/**
 * Centro de notificaciones del encabezado del panel (campana 🔔).
 *
 * Antes la campana solo activaba/indicaba el estado del push y el aviso se
 * perdía con el *toast*. Ahora:
 *  - muestra una insignia con las notificaciones **sin leer**;
 *  - al pulsarla abre la lista completa (guardada en `localStorage`, ver
 *    `src/utils/notificationInbox.js`), así se puede revisar después lo que
 *    llegó aunque el toast ya haya desaparecido;
 *  - al abrirla **marca todo como leído**, por lo que el contador de la pestaña
 *    ("(3) Appsline · Tareas" + punto en el favicon) desaparece;
 *  - los avisos que llegaron sin leer se siguen resaltando durante esa visita
 *    (`pendingIds`), para distinguir lo nuevo de lo ya visto;
 *  - si el push todavía no está activo, la lista ofrece activarlo sin salir del
 *    panel de notificaciones.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBell,
  FiBellOff,
  FiCheck,
  FiCheckSquare,
  FiFolder,
  FiInfo,
  FiMessageSquare,
  FiRefreshCw,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { cx } from "../../utils/format";
import { formatInboxTime } from "../../utils/notificationInbox";
import { usePushNotifications } from "../../routes/PushContext";

/** Estados en los que la campana no puede activar nada desde aquí. */
const HIDDEN_STATUSES = [
  "loading",
  "unsupported",
  "insecure-context",
  "not-configured",
  "missing-vapid-key",
  "permission-denied",
];

/** Icono y color de cada categoría de aviso. */
const KIND_META = {
  task: { icon: FiCheckSquare, className: "bg-brand-50 text-brand-600" },
  project: { icon: FiFolder, className: "bg-violet-50 text-violet-600" },
  client: { icon: FiUsers, className: "bg-sky-50 text-sky-600" },
  report: { icon: FiBarChart2, className: "bg-amber-50 text-amber-600" },
  message: { icon: FiMessageSquare, className: "bg-emerald-50 text-emerald-600" },
  system: { icon: FiInfo, className: "bg-slate-100 text-slate-500" },
};

const kindMeta = (kind) => KIND_META[kind] || KIND_META.system;

const NotificationBell = () => {
  const navigate = useNavigate();
  const {
    status,
    busy,
    notifications,
    unreadCount,
    enable,
    retry,
    markAllRead,
    markRead,
    removeNotification,
    clearNotifications,
  } = usePushNotifications();

  const [open, setOpen] = useState(false);
  /** Avisos que estaban sin leer al abrir la lista: se resaltan como nuevos. */
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const rootRef = useRef(null);
  const confirmTimerRef = useRef(null);

  const unread = unreadCount || 0;
  const disabled = HIDDEN_STATUSES.includes(status);
  // Sin notificaciones guardadas no hay nada que listar: la campana solo
  // aparece cuando puede activar el push o cuando ya hay avisos que revisar.
  const hidden = disabled && notifications.length === 0;

  /** Abre/cierra la lista. Al abrir, todo queda como leído (alerta fuera). */
  const toggle = () => {
    setConfirmClear(false);
    setOpen((prev) => {
      const next = !prev;
      if (!next) setPendingIds(new Set());
      return next;
    });
  };

  const close = useCallback(() => {
    setOpen(false);
    setConfirmClear(false);
    setPendingIds(new Set());
  }, []);

  /* Al abrir: se recuerdan los pendientes (para resaltarlos) y se marcan
     como leídos, que es lo que apaga el contador de la pestaña. Mientras la
     lista siga abierta, los avisos que lleguen también cuentan como vistos. */
  useEffect(() => {
    if (!open) return;
    const pending = notifications.filter((item) => !item.read);
    if (pending.length === 0) return;
    setPendingIds((prev) => {
      const next = new Set(prev);
      pending.forEach((item) => next.add(item.id));
      return next;
    });
    markAllRead();
  }, [open, notifications, markAllRead]);

  /* Clic fuera, Escape y refresco del "hace 5 min" mientras está abierto. */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      clearInterval(timer);
    };
  }, [open, close]);

  const summary = useMemo(
    () => ({ total: notifications.length, pending: pendingIds.size }),
    [notifications.length, pendingIds.size]
  );

  /** Abre el destino del aviso (ruta del panel o enlace externo). */
  const openEntry = (entry) => {
    markRead(entry.id);
    close();
    const url = (entry.url || "").trim();
    // Sin destino, el aviso queda en la lista y ya marcado como leído.
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(url.startsWith("/") ? url : `/${url}`);
  };

  /** Vaciar la lista exige un segundo clic (evita borrar todo por accidente). */
  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    clearNotifications();
    setPendingIds(new Set());
    setConfirmClear(false);
  };

  useEffect(() => () => clearTimeout(confirmTimerRef.current), []);

  if (hidden) return null;

  /* ---------- Insignia de la campana ---------- */
  const dot =
    status === "on"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-brand-500 animate-pulse";

  const base =
    "relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

  const label =
    unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={
          unread > 0
            ? `${unread} notificación${unread === 1 ? "" : "es"} sin leer`
            : "Notificaciones"
        }
        className={base}
      >
        <FiBell className="text-xl" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : (
          <span className={cx("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", dot)} />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="animate-toast-in absolute right-0 z-30 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-lg"
        >
          {/* ---------- Cabecera ---------- */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.total === 0
                  ? "Aquí verás los avisos que recibas."
                  : summary.pending > 0
                    ? `${summary.pending} nueva${summary.pending === 1 ? "" : "s"} · ${summary.total} guardada${summary.total === 1 ? "" : "s"}`
                    : `${summary.total} guardada${summary.total === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                disabled={summary.total === 0}
                title="Vaciar la lista de notificaciones"
                className={cx(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  confirmClear
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                <FiTrash2 />
                {confirmClear ? "¿Vaciar?" : "Vaciar"}
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar notificaciones"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <FiX />
              </button>
            </div>
          </div>

          {/* ---------- Lista ---------- */}
          {summary.total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FiBell className="text-xl" />
              </span>
              <p className="text-sm font-medium text-slate-600">Sin notificaciones</p>
              <p className="text-xs text-slate-400">
                Cuando haya novedades en tus proyectos, tareas o clientes, quedarán
                listadas aquí aunque el aviso flotante ya haya desaparecido.
              </p>
            </div>
          ) : (
            <ul className="thin-scroll max-h-[min(65vh,24rem)] divide-y divide-slate-100 overflow-y-auto">
              {notifications.map((entry) => {
                const meta = kindMeta(entry.kind);
                const Icon = meta.icon;
                const isNew = pendingIds.has(entry.id);
                return (
                  <li key={entry.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className={cx(
                        "flex w-full items-start gap-3 px-4 py-3 pr-10 text-left transition hover:bg-slate-50",
                        isNew && "bg-brand-50/40"
                      )}
                    >
                      <span
                        className={cx(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base",
                          meta.className
                        )}
                      >
                        <Icon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cx(
                              "min-w-0 flex-1 truncate text-sm",
                              isNew
                                ? "font-semibold text-slate-900"
                                : "font-medium text-slate-700"
                            )}
                          >
                            {entry.title}
                          </span>
                          {isNew && (
                            <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                              Nueva
                            </span>
                          )}
                        </span>
                        {entry.body && (
                          <span className="mt-0.5 block line-clamp-2 text-[13px] leading-5 text-slate-500">
                            {entry.body}
                          </span>
                        )}
                        {/* Lo que estaba pendiente al abrir la lista (o llegó
                            mientras estaba abierta) se queda marcado como "sin
                            leer" durante esa visita, aunque ya se haya apagado
                            el contador de la pestaña. */}
                        <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <FiCheck className={isNew ? "text-brand-500" : "text-emerald-500"} />
                          {isNew ? "Sin leer" : "Leída"}
                          <span aria-hidden="true">·</span>
                          {formatInboxTime(entry.createdAt, now)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNotification(entry.id)}
                      aria-label={`Quitar la notificación ${entry.title}`}
                      title="Quitar de la lista"
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <FiX />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ---------- Pie: estado del push ---------- */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
            {status === "on" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Push activas en este dispositivo
              </span>
            )}
            {status === "off" && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <FiBellOff /> Push desactivadas en este dispositivo
              </span>
            )}
            {status === "error" && (
              <span className="inline-flex items-center gap-1.5 text-red-600">
                <FiBellOff /> No se pudieron activar las push
              </span>
            )}
            {disabled && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <FiBellOff /> Push no disponibles aquí
              </span>
            )}

            <span className="flex items-center gap-2">
              {status === "off" && (
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  <FiBell /> Activar push
                </button>
              )}
              {status === "error" && (
                <button
                  type="button"
                  onClick={retry}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  <FiRefreshCw /> Reintentar
                </button>
              )}
              <Link
                to="/admin/settings"
                onClick={close}
                className="font-medium text-slate-500 transition hover:text-brand-600"
              >
                Preferencias
              </Link>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
