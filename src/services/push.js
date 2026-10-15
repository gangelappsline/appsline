/**
 * Acceso a la API para registrar el dispositivo del usuario en FCM.
 *
 * Contrato con el backend (detallado en `docs/API-PUSH.md`):
 *   POST   /push/devices        { token, platform, device_id, user_agent, locale, timezone }
 *   DELETE /push/devices        { token }
 *   GET    /push/devices        → dispositivos del usuario autenticado
 *   POST   /push/devices/test   → envía una notificación de prueba al usuario
 *
 * Los endpoints son **opcionales**: si la API todavía no los expone (404/405)
 * el panel sigue funcionando y avisa en Configuración en lugar de fallar.
 */
import api from "./api";

export const PUSH_DEVICES_PATH = "/push/devices";

/** Claves de localStorage propias del push. */
export const PUSH_DEVICE_KEY = "appsline.push.device";
export const PUSH_DEVICE_ID_KEY = "appsline.push.device_id";

/**
 * `null`  → todavía no se ha sondeado el backend
 * `false` → la API no expone los endpoints de push
 * `true`  → disponibles
 */
let devicesEndpointSupported = null;

export const pushEndpointSupported = () => devicesEndpointSupported !== false;

/** ¿La respuesta significa "este endpoint no existe en la API"? */
const isMissingEndpoint = (err) =>
  [404, 405, 501].includes(err?.response?.status);

/** Identificador estable de este navegador (ayuda al backend a hacer upsert). */
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(PUSH_DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(PUSH_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
};

/** Metadatos del dispositivo que acompañan al token FCM. */
export const deviceMetadata = (token) => ({
  token,
  platform: "web",
  device_id: getDeviceId(),
  user_agent:
    typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  locale:
    typeof navigator !== "undefined"
      ? navigator.language || navigator.userLanguage || "es-MX"
      : "es-MX",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
      : null,
});

/* ------------------------------------------------------------------ */
/* Dispositivo registrado localmente                                  */
/* ------------------------------------------------------------------ */

/** Token ya registrado en la API desde este navegador (o `null`). */
export const getStoredDevice = () => {
  try {
    const raw = localStorage.getItem(PUSH_DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveStoredDevice = (device) => {
  try {
    localStorage.setItem(PUSH_DEVICE_KEY, JSON.stringify(device));
  } catch {
    /* modo privado: seguimos sin persistir */
  }
};

export const clearStoredDevice = () => {
  try {
    localStorage.removeItem(PUSH_DEVICE_KEY);
  } catch {
    /* ignorado */
  }
};

/**
 * ¿Hace falta (re)registrar el token en la API?
 * Se evita la petición cuando el mismo token ya quedó registrado para el
 * mismo usuario en este navegador.
 */
export const needsDeviceRegistration = (token, userId) => {
  const stored = getStoredDevice();
  if (!stored || stored.token !== token) return true;
  // La API todavía no tenía el dispositivo: reintentar en la próxima carga.
  if (stored.server === false) return true;
  return String(stored.userId ?? "") !== String(userId ?? "");
};

/* ------------------------------------------------------------------ */
/* Endpoints                                                          */
/* ------------------------------------------------------------------ */

/**
 * Registra (o actualiza) el token FCM del dispositivo para el usuario actual.
 * @returns {Promise<object|null>} respuesta de la API o `null` si el endpoint no existe
 */
export async function registerPushDevice(payload) {
  try {
    const { data } = await api.post(PUSH_DEVICES_PATH, payload);
    devicesEndpointSupported = true;
    return data ?? null;
  } catch (err) {
    if (isMissingEndpoint(err)) {
      devicesEndpointSupported = false;
      return null;
    }
    throw err;
  }
}

/**
 * Desvincula el token del usuario (al cerrar sesión o desactivar el push).
 * @returns {Promise<boolean>} `true` si la API confirmó la baja
 */
export async function unregisterPushDevice(token) {
  if (!token) return false;
  try {
    await api.delete(PUSH_DEVICES_PATH, { data: { token } });
    devicesEndpointSupported = true;
    return true;
  } catch (err) {
    if (isMissingEndpoint(err)) {
      devicesEndpointSupported = false;
      return false;
    }
    throw err;
  }
}

/** Dispositivos con notificaciones activas del usuario autenticado. */
export async function fetchPushDevices() {
  try {
    const { data } = await api.get(PUSH_DEVICES_PATH);
    devicesEndpointSupported = true;
    const list = Array.isArray(data) ? data : data?.data;
    return Array.isArray(list) ? list : [];
  } catch (err) {
    if (isMissingEndpoint(err)) {
      devicesEndpointSupported = false;
      return null;
    }
    throw err;
  }
}

/**
 * Da de baja el dispositivo al cerrar sesión: quita el token del usuario en la
 * API y olvida el registro local, pero **conserva** el token FCM del navegador
 * para poder volver a asociarlo en el siguiente inicio de sesión (importante
 * cuando varias personas usan el mismo equipo).
 */
export async function releasePushDevice() {
  const stored = getStoredDevice();
  const token = stored?.token || "";
  try {
    if (token) await unregisterPushDevice(token);
  } catch {
    // Cerrar sesión nunca debe fallar por el push.
  } finally {
    clearStoredDevice();
  }
  return token;
}

/**
 * Pide al backend que envíe una notificación de prueba al usuario actual
 * (a todos sus dispositivos o solo al token indicado).
 * @returns {Promise<object|null>} `null` si el endpoint no existe todavía
 */
export async function sendTestPush(token) {
  try {
    const { data } = await api.post(`${PUSH_DEVICES_PATH}/test`, token ? { token } : {});
    devicesEndpointSupported = true;
    return data ?? {};
  } catch (err) {
    if (isMissingEndpoint(err)) {
      devicesEndpointSupported = false;
      return null;
    }
    throw err;
  }
}
