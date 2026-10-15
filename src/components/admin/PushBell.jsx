/**
 * Indicador del encabezado del panel para las notificaciones push.
 *
 *  - Sin activar (`off`)        → campana con punto azul; al hacer clic pide el
 *                                 permiso al navegador y registra el dispositivo.
 *  - Activas (`on`)             → campana con punto verde; lleva a Configuración.
 *  - Error                     → campana con punto rojo para reintentar.
 *
 * No se muestra cuando la situación no se puede resolver desde la interfaz
 * (navegador sin soporte, falta de configuración de Firebase, permiso
 * bloqueado): en esos casos Configuración → Preferencias explica qué hacer.
 */
import { Link } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import { cx } from "../../utils/format";
import { usePushNotifications } from "../../routes/PushContext";

const HIDDEN_STATUSES = [
  "loading",
  "unsupported",
  "insecure-context",
  "not-configured",
  "missing-vapid-key",
  "permission-denied",
];

const PushBell = () => {
  const { status, busy, enable, retry } = usePushNotifications();

  if (HIDDEN_STATUSES.includes(status)) return null;

  const dot =
    status === "on"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-brand-500 animate-pulse";

  const base =
    "relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

  if (status === "on") {
    return (
      <Link
        to="/admin/settings"
        className={cx(base, "block")}
        title="Notificaciones push activadas en este dispositivo"
        aria-label="Notificaciones push activadas"
      >
        <FiBell className="text-xl" />
        <span className={cx("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", dot)} />
      </Link>
    );
  }

  const handleClick = () => {
    if (status === "error") retry();
    else enable();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={base}
      title={
        status === "error"
          ? "No se pudieron activar las notificaciones. Reintentar."
          : "Activar las notificaciones push en este dispositivo"
      }
      aria-label="Activar notificaciones push"
    >
      <FiBell className="text-xl" />
      <span className={cx("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", dot)} />
    </button>
  );
};

export default PushBell;
