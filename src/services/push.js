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

/**
 * Extrae un mensaje legible de la respuesta de error de la API.
 *
 * La API puede devolver la forma habitual de Laravel (`{ message }`) o reenviar
 * tal cual el error de Google/FCM (`{ error: { message, status, details } }`),
 * por eso se prueban ambas. También se extrae el `reason` de `details`
 * (p. ej. `RESOURCE_PROJECT_INVALID`, `SENDER_ID_MISMATCH`) para poder dar una
 * pista accionable en el diagnóstico.
 */
export const extractPushApiError = (err) => {
  const data = err?.response?.data ?? null;
  const googleError =
    data?.error && typeof data.error === "object" ? data.error : null;
  const message =
    (typeof data?.error === "string" ? data.error : null) ||
    googleError?.message ||
    data?.message ||
    err?.message ||
    "La petición falló antes de llegar a la API.";
  const reason =
    googleError?.details?.find?.((d) => d?.reason)?.reason ||
    googleError?.details?.[0]?.reason ||
    data?.reason ||
    null;
  const code = googleError?.status || googleError?.code || data?.code || null;
  return { message: String(message), reason, code };
};

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

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                        */
/* ------------------------------------------------------------------ */

/**
 * Envía una prueba a un token concreto **sin lanzar errores**: devuelve el
 * estado HTTP y el cuerpo de la respuesta. Es lo que necesita el diagnóstico
 * para enseñar *por qué* no llega la notificación (403 del token de otro
 * usuario, 422, 500 al hablar con FCM, `SENDER_ID_MISMATCH`, etc.).
 *
 * @param {string} token Token de FCM (por ejemplo, el que está en `push_devices`).
 * @returns {Promise<{ok:boolean,status:number,message:string,data:object|null}>}
 */
export async function sendTestPushToToken(token) {
  const body = token ? { token } : {};
  try {
    const { data, status } = await api.post(`${PUSH_DEVICES_PATH}/test`, body);
    devicesEndpointSupported = true;
    return {
      ok: true,
      status,
      message: data?.message || "La API aceptó el envío de la notificación.",
      data: data ?? null,
    };
  } catch (err) {
    const status = Number(err?.response?.status) || 0;
    if (isMissingEndpoint(err)) devicesEndpointSupported = false;
    const extracted = extractPushApiError(err);
    return {
      ok: false,
      status,
      message: extracted.message,
      reason: extracted.reason,
      code: extracted.code,
      data: err?.response?.data ?? null,
    };
  }
}

/**
 * Lista los dispositivos del usuario autenticado sin lanzar errores.
 * @returns {Promise<{ok:boolean,status:number,devices:object[]|null,message:string}>}
 */
export async function probePushDevices() {
  try {
    const { data, status } = await api.get(PUSH_DEVICES_PATH);
    devicesEndpointSupported = true;
    const list = Array.isArray(data) ? data : data?.data;
    return {
      ok: true,
      status,
      devices: Array.isArray(list) ? list : [],
      message: "",
    };
  } catch (err) {
    const status = Number(err?.response?.status) || 0;
    if (isMissingEndpoint(err)) devicesEndpointSupported = false;
    return {
      ok: false,
      status,
      devices: null,
      message: isMissingEndpoint(err)
        ? "La API no expone GET /push/devices (404)."
        : extractPushApiError(err).message || "No se pudo consultar la API.",
    };
  }
}

/**
 * Da de baja un token concreto (por ejemplo, uno "fantasma" que quedó en la
 * base de datos) sin lanzar errores.
 * @returns {Promise<{ok:boolean,status:number,message:string}>}
 */
export async function removePushDeviceFromServer(token) {
  if (!token) return { ok: false, status: 0, message: "Falta el token." };
  try {
    const { status } = await api.delete(PUSH_DEVICES_PATH, { data: { token } });
    devicesEndpointSupported = true;
    return { ok: true, status, message: "Token dado de baja del usuario." };
  } catch (err) {
    const status = Number(err?.response?.status) || 0;
    if (isMissingEndpoint(err)) devicesEndpointSupported = false;
    return {
      ok: false,
      status,
      message:
        extractPushApiError(err).message ||
        err?.message ||
        "No se pudo dar de baja el token.",
    };
  }
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
