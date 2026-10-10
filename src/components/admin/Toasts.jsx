/* eslint-disable react/prop-types */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import { cx } from "../../utils/format";

export const TOASTS_PREF_KEY = "appsline.toasts.enabled";

const ToastContext = createContext({ notify: () => {} });

/** ¿El usuario activó las notificaciones flotantes? (Configuración > Preferencias). */
export const toastsEnabled = () => localStorage.getItem(TOASTS_PREF_KEY) !== "off";

const TONES = {
  success: { icon: FiCheckCircle, bar: "bg-emerald-500", iconClass: "text-emerald-500" },
  error: { icon: FiAlertCircle, bar: "bg-red-500", iconClass: "text-red-500" },
  info: { icon: FiInfo, bar: "bg-brand-500", iconClass: "text-brand-500" },
};

/**
 * Proveedor de notificaciones flotantes. Se monta una vez en LayoutAdmin;
 * cualquier página hija usa `notify()` con el hook `useToast`.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [enabled, setEnabled] = useState(toastsEnabled());

  // Reacciona al cambio de preferencia sin recargar (ver Configuración).
  useEffect(() => {
    const sync = () => setEnabled(toastsEnabled());
    window.addEventListener("appsline:toasts", sync);
    return () => window.removeEventListener("appsline:toasts", sync);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((old) => old.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = "success") => {
      if (!toastsEnabled()) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((old) => [...old.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), 3600);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {enabled && toasts.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
          {toasts.map((t) => {
            const tone = TONES[t.type] || TONES.info;
            const Icon = tone.icon;
            return (
              <div
                key={t.id}
                className="animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-2 shadow-card-lg"
              >
                <span className={cx("mt-0.5 text-lg", tone.iconClass)}>
                  <Icon />
                </span>
                <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-5 text-slate-700">
                  {t.message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Descartar notificación"
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <FiX />
                </button>
                <span className={cx("absolute inset-y-0 left-0 w-1", tone.bar)} />
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

export default ToastProvider;
