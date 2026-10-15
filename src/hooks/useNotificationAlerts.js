import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearTabIndicator,
  playNotificationSound,
  setTabIndicator,
} from "../utils/notificationAlert";

/**
 * Hook para gestionar el indicador de la pestaña y el sonido de aviso
 * cuando llegan notificaciones con la pestaña abierta.
 *
 * Nota: hoy no lo usa ninguna pantalla. El panel gestiona el aviso desde
 * `src/routes/PushContext.jsx` contra la bandeja de `notificationInbox.js`, que
 * es la única fuente de verdad de lo "sin leer" y **solo** se limpia cuando el
 * usuario abre la campana (este hook, en cambio, lo reinicia al enfocar la
 * pestaña, así que un aviso pendiente se perdería).
 */
export const useNotificationAlerts = () => {
  const [unread, setUnread] = useState(0);
  const baseTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Appsline"
  );

  const notify = useCallback(() => {
    setUnread((prev) => {
      const next = prev + 1;
      setTabIndicator(next);
      return next;
    });
    playNotificationSound();
  }, []);

  const reset = useCallback(() => {
    setUnread(0);
    clearTabIndicator();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        reset();
      }
    };
    const handleFocus = () => reset();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [reset]);

  return { unread, notify, reset, baseTitle: baseTitleRef.current };
};

export default useNotificationAlerts;
