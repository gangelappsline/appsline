/* eslint-disable react/prop-types */
/**
 * Estado global de las notificaciones push del navegador.
 *
 * Se monta una sola vez en `main.jsx` (dentro de `AuthProvider` y
 * `ToastProvider`) y cualquier parte del panel consume el estado con
 * `usePushNotifications()`.
 *
 * Flujo:
 *  - Un usuario logueado activa el push con un clic (Configuración o la
 *    campana del encabezado) → se pide permiso, se obtiene el token FCM y se
 *    registra en la API (`POST /push/devices`).
 *  - En cada carga, si el permiso ya está concedido, el token se sincroniza en
 *    silencio (así se refrescan tokens y se re-asocia el dispositivo).
 *  - Los mensajes que llegan con la pestaña abierta se muestran como toast **y**
 *    se guardan en la bandeja del usuario (`src/utils/notificationInbox.js`),
 *    para que el aviso no se pierda cuando el toast desaparece.
 *  - `unreadCount` sale de esa bandeja: alimenta la insignia de la campana y el
 *    contador de la pestaña, y solo se limpia cuando el usuario abre la campana.
 *  - Al cerrar sesión el dispositivo se desvincula del usuario.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/admin/Toasts";
import {
  clearTabIndicator,
  playNotificationSound,
  setTabIndicator,
} from "../utils/notificationAlert";
import {
  addInboxEntry,
  clearInbox,
  markAllRead as markInboxAllRead,
  markEntryRead,
  notificationFromPayload,
  readInbox,
  removeInboxEntry,
  subscribeToInbox,
  unreadCount as countUnread,
} from "../utils/notificationInbox";
import {
  PushError,
  deletePushToken,
  fetchPushToken,
  getPermission,
  getPushBlocker,
  missingFirebaseEnv,
  showLocalNotification,
  subscribeToPushMessages,
} from "../firebase/messaging";
import {
  clearStoredDevice,
  deviceMetadata,
  fetchPushDevices,
  getStoredDevice,
  needsDeviceRegistration,
  pushEndpointSupported,
  registerPushDevice,
  saveStoredDevice,
  sendTestPush,
  unregisterPushDevice,
} from "../services/push";

const PushContext = createContext(null);

/**
 * `status`:
 *  - "loading"                        → comprobando entorno y permiso
 *  - "off"                            → se puede activar (permiso "default")
 *  - "on"                             → activo en este dispositivo
 *  - "error"                          → falló la última operación
 *  - "unsupported" | "insecure-context" | "not-configured" |
 *    "missing-vapid-key" | "permission-denied" → no se puede activar (ver `blocker`)
 */
export const PushProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { notify } = useToast();
  const userId = user?.id ?? user?.email ?? null;

  const [status, setStatus] = useState("loading");
  const [blocker, setBlocker] = useState(() => getPushBlocker());
  const [permission, setPermission] = useState(() => getPermission());
  const [token, setToken] = useState(() => getStoredDevice()?.token || "");
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
  const [notifications, setNotifications] = useState(() => readInbox(userId));
  const [endpointSupported, setEndpointSupported] = useState(() =>
    pushEndpointSupported()
  );

  const unreadCount = useMemo(() => countUnread(notifications), [notifications]);

  // El listener de mensajes vive siempre; solo muestra toasts con sesión activa.
  const authenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    authenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  /** Relee permiso/entorno (el usuario pudo cambiarlo desde el navegador). */
  const refresh = useCallback(() => {
    setBlocker(getPushBlocker());
    setPermission(getPermission());
    setEndpointSupported(pushEndpointSupported());
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  /* ---------------------------------------------------------------- */
  /* Sincronización silenciosa (token + registro en la API)           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (blocker) {
      setStatus(blocker);
      return undefined;
    }
    if (!isAuthenticated || !userId) {
      setStatus("off");
      return undefined;
    }
    if (getPermission() !== "granted") {
      setStatus("off");
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const current = await fetchPushToken();
        if (!current || cancelled) return;

        if (needsDeviceRegistration(current, userId)) {
          const response = await registerPushDevice(deviceMetadata(current));
          if (cancelled) return;
          saveStoredDevice({
            token: current,
            userId,
            registered_at: new Date().toISOString(),
            server: Boolean(response),
          });
        }

        if (cancelled) return;
        setToken(current);
        setError("");
        setStatus("on");
        refresh();

        if (pushEndpointSupported()) {
          const list = await fetchPushDevices();
          if (!cancelled) {
            setDevices(list);
            refresh();
          }
        }
      } catch (err) {
        if (cancelled) return;
        setStatus(err?.code === "permission-denied" ? "permission-denied" : "error");
        setError(err?.message || "No se pudieron activar las notificaciones.");
        refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId, blocker, refresh, syncNonce]);

  /* ---------------------------------------------------------------- */
  /* Bandeja de notificaciones (localStorage)                          */
  /* ---------------------------------------------------------------- */

  /**
   * La bandeja se relee al cambiar de usuario y cada vez que cambia en
   * cualquier pestaña (`subscribeToInbox` escucha el evento propio y el
   * `storage` del navegador). Así el contador de sin leer siempre coincide con
   * lo que hay guardado, incluso tras recargar.
   */
  useEffect(() => {
    setNotifications(readInbox(userId));
    return subscribeToInbox(userId, (list) => setNotifications(list));
  }, [userId]);

  /** El contador de la pestaña (título + favicon + badge) refleja lo pendiente. */
  useEffect(() => {
    try {
      setTabIndicator(unreadCount);
    } catch {
      /* ignore */
    }
  }, [unreadCount]);

  /* ---------------------------------------------------------------- */
  /* Mensajes con la pestaña abierta                                   */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return subscribeToPushMessages((payload) => {
      if (!authenticatedRef.current) return;
      // El navegador renovó la suscripción de push: hay que registrar el
      // nuevo token en la API.
      if (payload.type === "subscription-change") {
        setSyncNonce((n) => n + 1);
        return;
      }
      // El usuario tocó la notificación del sistema: ese aviso ya se vio, así
      // que se marca como leído (la app del navegador no puede escribir la
      // bandeja por nosotros).
      if (payload.type === "notification-click") {
        const { id } = notificationFromPayload(payload);
        if (id) markEntryRead(userId, id);
        return;
      }

      // Se guarda primero: si es un reenvío del mismo aviso no se vuelve a
      // sonar ni a mostrar el toast.
      const { entry, added } = addInboxEntry(userId, payload);
      if (!added) return;

      notify(entry.body ? `${entry.title}: ${entry.body}` : entry.title, "info");
      // Aviso visible aunque la pestaña esté abierta: sonido + indicador en la pestaña.
      try {
        playNotificationSound();
      } catch {
        /* ignore */
      }
    });
  }, [notify, userId]);

  /* ---------------------------------------------------------------- */
  /* Acciones                                                          */
  /* ---------------------------------------------------------------- */

  /** Activa las notificaciones en este dispositivo (requiere clic del usuario). */
  const enable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const current = await fetchPushToken({ requestPermission: true });
      if (!current) throw new PushError("permission-dismissed");

      const response = await registerPushDevice(deviceMetadata(current));
      saveStoredDevice({
        token: current,
        userId,
        registered_at: new Date().toISOString(),
        server: Boolean(response),
      });

      setToken(current);
      setStatus("on");
      refresh();

      if (response) {
        notify("Notificaciones push activadas en este dispositivo");
        const list = await fetchPushDevices();
        setDevices(list);
      } else {
        notify(
          "Notificaciones activadas en el navegador. La API todavía no guarda el dispositivo.",
          "info"
        );
      }

      // Confirmación visible: demuestra que el navegador ya muestra notificaciones.
      showLocalNotification({
        title: "Notificaciones activadas",
        body: "Te avisaremos aquí cuando haya novedades en tus proyectos.",
        url: "/admin/settings",
      }).catch(() => null);
    } catch (err) {
      const code = err?.code;
      if (code === "permission-denied") {
        setStatus("permission-denied");
      } else if (code === "permission-dismissed") {
        setStatus("off");
      } else {
        setStatus("error");
      }
      setError(err?.message || "No se pudieron activar las notificaciones.");
      if (code !== "permission-dismissed") {
        notify(
          err?.message || "No se pudieron activar las notificaciones",
          "error"
        );
      }
    } finally {
      refresh();
      setBusy(false);
    }
  }, [notify, refresh, userId]);

  /** Desactiva las notificaciones: baja en la API + revoca el token FCM. */
  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    const current = getStoredDevice()?.token || token;
    try {
      await unregisterPushDevice(current).catch(() => false);
      await deletePushToken().catch(() => null);
      clearStoredDevice();
      setToken("");
      setDevices(null);
      setStatus("off");
      notify("Notificaciones push desactivadas en este dispositivo");
    } finally {
      refresh();
      setBusy(false);
    }
  }, [notify, refresh, token]);

  /** Reintenta la sincronización (útil si falló la red o el registro). */
  const retry = useCallback(() => {
    setError("");
    setSyncNonce((n) => n + 1);
  }, []);

  /**
   * Envía una notificación de prueba.
   * Si la API todavía no expone `/push/devices/test`, muestra una notificación
   * local para comprobar que el navegador las despliega correctamente.
   */
  const sendTest = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const current = getStoredDevice()?.token || token;
      const response = await sendTestPush(current);
      refresh();
      if (response) {
        notify("Notificación de prueba enviada. Debería llegar en unos segundos.");
      } else {
        await showLocalNotification({
          title: "Prueba de notificación",
          body: "Así se verán las notificaciones de Appsline en este dispositivo.",
          url: "/admin/dashboard",
        });
        notify(
          "Prueba local mostrada (la API aún no expone /push/devices/test).",
          "info"
        );
      }
    } catch (err) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo enviar la notificación de prueba.";
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  }, [notify, refresh, token]);

  /** Marca todas las notificaciones como leídas (se llama al abrir la campana). */
  const markAllRead = useCallback(() => {
    markInboxAllRead(userId);
    clearTabIndicator();
  }, [userId]);

  /** Marca una notificación concreta como leída (clic en el aviso). */
  const markRead = useCallback(
    (id) => {
      markEntryRead(userId, id);
    },
    [userId]
  );

  /** Quita una notificación de la bandeja. */
  const removeNotification = useCallback(
    (id) => {
      removeInboxEntry(userId, id);
    },
    [userId]
  );

  /** Vacía la bandeja: el usuario ya no necesita el historial. */
  const clearNotifications = useCallback(() => {
    clearInbox(userId);
    clearTabIndicator();
  }, [userId]);

  const value = useMemo(
    () => ({
      status,
      blocker,
      permission,
      token,
      devices,
      deviceCount: devices?.length ?? null,
      error,
      busy,
      endpointSupported,
      // Bandeja de notificaciones: lo que la campana del encabezado lista.
      notifications,
      unreadCount,
      missingEnv: missingFirebaseEnv(),
      enable,
      disable,
      sendTest,
      retry,
      refresh,
      markAllRead,
      markRead,
      removeNotification,
      clearNotifications,
      // Compatibilidad con los nombres anteriores.
      markNotificationsRead: markAllRead,
      clearUnread: markAllRead,
    }),
    [
      status,
      blocker,
      permission,
      token,
      devices,
      error,
      busy,
      endpointSupported,
      notifications,
      unreadCount,
      enable,
      disable,
      sendTest,
      retry,
      refresh,
      markAllRead,
      markRead,
      removeNotification,
      clearNotifications,
    ]
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
};

export const usePushNotifications = () => {
  const ctx = useContext(PushContext);
  if (!ctx) {
    throw new Error(
      "usePushNotifications debe usarse dentro de <PushProvider>."
    );
  }
  return ctx;
};

export default PushProvider;
