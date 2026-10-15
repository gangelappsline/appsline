/* eslint-disable react/prop-types */
/**
 * Diagnóstico de notificaciones push **desde el frontend**.
 *
 * Responde a la pregunta "activé el push y no me llega nada": en lugar de
 * adivinar, revisa cada eslabón de la cadena y enseña la respuesta cruda de la
 * API. Las pruebas posibles, de la más local a la más lejana:
 *
 *  1. `Notificación local` — el navegador muestra la notificación (service
 *     worker + permiso). Sin Firebase de por medio.
 *  2. `Simular push` — el service worker recibe un push falso por
 *     `postMessage` y hace lo mismo que con uno real: notificación del sistema
 *     + aviso dentro del panel. Si esto funciona, el problema está en el envío.
 *  3. `POST /push/devices/test` — la API debe entregar a FCM. Se puede probar con
 *     **el token que está guardado en la base de datos** (pegado a mano), así se
 *     comprueba si ese token sigue siendo válido y si el backend tiene la cuenta
 *     de servicio correcta.
 *  4. `Consola de Firebase` — enviar un mensaje de prueba desde Google al mismo
 *     token. Si Firebase sí entrega y la API no, el fallo está en el backend
 *     (cuenta de servicio, `SENDER_ID_MISMATCH`, API legacy apagada…).
 *
 * El panel muestra también la lista de dispositivos registrados (`GET
 * /push/devices`), el detalle de la última petición y comandos `curl` para
 * reproducir el problema fuera del navegador.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiCopy,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import { Button, Card, CardHeader, Field, useToast } from ".";
import { API_URL } from "../../services/api";
import { getToken as getSessionToken } from "../../services/session";
import {
  getStoredDevice,
  probePushDevices,
  removePushDeviceFromServer,
  sendTestPushToToken,
} from "../../services/push";
import {
  decodeFcmToken,
  getPermission,
  inspectMessagingServiceWorkerFile,
  isPushSupported,
  maskToken,
  messagingServiceWorkerStatus,
  missingFirebaseEnv,
  showLocalNotification,
  simulatePushThroughServiceWorker,
} from "../../firebase/messaging";
import { firebaseConfig, vapidKey } from "../../firebase/config";
import { usePushNotifications } from "../../routes/PushContext";
import { cx, formatDateTime } from "../../utils/format";

/** Tonos de cada comprobación. */
const TONES = {
  ok: {
    icon: FiCheckCircle,
    className: "border-emerald-100 bg-emerald-50/60 text-emerald-800",
    badge: "bg-emerald-100 text-emerald-700",
  },
  warn: {
    icon: FiAlertTriangle,
    className: "border-amber-100 bg-amber-50/60 text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  error: {
    icon: FiXCircle,
    className: "border-red-100 bg-red-50/60 text-red-700",
    badge: "bg-red-100 text-red-700",
  },
  info: {
    icon: FiInfo,
    className: "border-slate-200 bg-slate-50 text-slate-600",
    badge: "bg-slate-200/70 text-slate-600",
  },
};

const Check = ({ tone = "info", label, detail, action }) => {
  const { icon: Icon, className, badge } = TONES[tone] || TONES.info;
  return (
    <div className={cx("flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-[13px]", className)}>
      <Icon className="mt-0.5 shrink-0 text-base" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {label}
          <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", badge)}>
            {tone === "ok" ? "Correcto" : tone === "warn" ? "Revisar" : tone === "error" ? "Problema" : "Info"}
          </span>
        </p>
        {detail && <p className="mt-0.5 break-words text-[12px] leading-5 opacity-90">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

const PushDiagnostics = ({ className = "" }) => {
  const { notify } = useToast();
  const { token: contextToken, refresh, retry } = usePushNotifications();

  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState(null);
  const [swFile, setSwFile] = useState(null);
  const [worker, setWorker] = useState(null);
  const [devices, setDevices] = useState(null);
  const [devicesError, setDevicesError] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [log, setLog] = useState([]);

  // El registro local se relee al repetir el diagnóstico y al cambiar el token.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stored = useMemo(() => getStoredDevice(), [ranAt, contextToken]);
  const localToken = contextToken || stored?.token || "";
  const decoded = useMemo(() => decodeFcmToken(tokenInput || localToken), [tokenInput, localToken]);

  /** Guarda cada respuesta en el historial (lo más útil del diagnóstico). */
  const pushLog = useCallback((entry) => {
    setLog((old) => [{ id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), ...entry }, ...old].slice(0, 8));
  }, []);

  /* ---------------------------------------------------------------- */
  /* Comprobaciones                                                    */
  /* ---------------------------------------------------------------- */

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    try {
      const [fileInfo, workerInfo, deviceInfo] = await Promise.all([
        inspectMessagingServiceWorkerFile(),
        messagingServiceWorkerStatus(),
        probePushDevices(),
      ]);
      setSwFile(fileInfo);
      setWorker(workerInfo);
      setDevices(deviceInfo.devices);
      setDevicesError(deviceInfo.ok ? "" : deviceInfo.message);
      setRanAt(new Date().toISOString());
      refresh?.();
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missingEnv = missingFirebaseEnv();
  const supported = isPushSupported();
  const permission = getPermission();
  const tokenProject = decoded?.projectId || null;
  const projectMismatch =
    Boolean(tokenProject) && Boolean(firebaseConfig.projectId) && tokenProject !== firebaseConfig.projectId;
  const tokenInDatabase = Boolean(
    devices?.some((device) => String(device.token) === String(localToken))
  );

  /* ---------------------------------------------------------------- */
  /* Acciones                                                          */
  /* ---------------------------------------------------------------- */

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(message || "Copiado al portapapeles");
    } catch {
      notify("No se pudo copiar. Selecciona el texto manualmente.", "error");
    }
  };

  const testLocalNotification = async () => {
    setBusyAction("local");
    try {
      await showLocalNotification({
        title: "Prueba local de Appsline",
        body: "Si ves esto, el navegador ya muestra notificaciones de este sitio.",
        url: "/admin/settings",
      });
      pushLog({
        label: "Notificación local (service worker)",
        ok: true,
        status: 200,
        message: "El navegador aceptó la notificación local.",
      });
      notify("Notificación local enviada: revisa el centro de notificaciones del sistema.");
    } catch (err) {
      pushLog({
        label: "Notificación local (service worker)",
        ok: false,
        status: 0,
        message: err?.message || "El navegador rechazó la notificación.",
      });
      notify(err?.message || "No se pudo mostrar la notificación local", "error");
    } finally {
      setBusyAction("");
      runDiagnostics();
    }
  };

  const testSimulatedPush = async () => {
    setBusyAction("simulate");
    try {
      await simulatePushThroughServiceWorker({
        title: "Push simulado",
        body: "Este push lo generó el panel: service worker + aviso dentro de la app.",
        url: "/admin/settings",
      });
      pushLog({
        label: "Push simulado por el service worker",
        ok: true,
        status: 200,
        message: "El service worker recibió el payload simulado.",
      });
      notify("Push simulado enviado al service worker.");
    } catch (err) {
      pushLog({
        label: "Push simulado por el service worker",
        ok: false,
        status: 0,
        message: err?.message || "El service worker no respondió.",
      });
      notify(err?.message || "No se pudo simular el push", "error");
    } finally {
      setBusyAction("");
      runDiagnostics();
    }
  };

  const testApiPush = async (explicitToken) => {
    const target = (explicitToken ?? tokenInput).trim();
    setBusyAction(explicitToken ? `device-${explicitToken}` : "api");
    try {
      const result = await sendTestPushToToken(target || undefined);
      pushLog({
        label: target ? `POST /push/devices/test → token ${maskToken(target)}` : "POST /push/devices/test → todos mis dispositivos",
        ...result,
      });
      if (result.ok) {
        notify(
          "La API aceptó el envío. Si no aparece en segundos, el problema está en FCM o en la cuenta de servicio.",
        );
      } else {
        notify(result.message, "error");
      }
      runDiagnostics();
    } finally {
      setBusyAction("");
    }
  };

  const removeDevice = async (deviceToken) => {
    setBusyAction(`remove-${deviceToken}`);
    try {
      const result = await removePushDeviceFromServer(deviceToken);
      pushLog({ label: `DELETE /push/devices → ${maskToken(deviceToken)}`, ...result });
      notify(result.ok ? "Token dado de baja" : result.message, result.ok ? "info" : "error");
      runDiagnostics();
    } finally {
      setBusyAction("");
    }
  };

  const curlCommand = useMemo(() => {
    const session = getSessionToken() || "<TU_TOKEN_DE_SESION>";
    const target = (tokenInput || localToken || "<TOKEN_FCM>").trim();
    return [
      `curl -X POST ${API_URL}/push/devices/test \\`,
      `  -H "Authorization: Bearer ${session}" \\`,
      `  -H "Accept: application/json" -H "Content-Type: application/json" \\`,
      `  -d '{"token":"${target}"}'`,
    ].join("\n");
  }, [tokenInput, localToken]);

  const firebaseConsoleUrl = firebaseConfig.projectId
    ? `https://console.firebase.google.com/project/${firebaseConfig.projectId}/messaging`
    : "https://console.firebase.google.com/";

  return (
    <Card className={cx("p-6", className)}>
      <CardHeader
        title="Diagnóstico de notificaciones"
        subtitle="Revisa cada paso del push y prueba un token concreto de la base de datos."
        actions={
          <Button variant="secondary" onClick={runDiagnostics} loading={running}>
            <FiRefreshCw /> Repetir
          </Button>
        }
      />

      {/* ---------------- Comprobaciones ---------------- */}
      <div className="mt-4 space-y-2.5">
        <Check
          tone={supported ? "ok" : "error"}
          label="El navegador soporta push web"
          detail={
            supported
              ? `Contexto seguro (HTTPS) · Notification · Service Worker · PushManager`
              : "Falta HTTPS (o localhost), la API de notificaciones, el service worker o PushManager."
          }
        />
        <Check
          tone={permission === "granted" ? "ok" : permission === "denied" ? "error" : "warn"}
          label={`Permiso del navegador: ${permission}`}
          detail={
            permission === "granted"
              ? "El sitio puede mostrar notificaciones."
              : permission === "denied"
                ? "Está bloqueado: ábrelo en el candado 🔒 de la barra de direcciones → Notificaciones → Permitir."
                : "Todavía no se ha concedido: pulsa la campana o “Activar notificaciones”."
          }
        />
        <Check
          tone={missingEnv.length ? "error" : "ok"}
          label="Variables de Firebase (VITE_FIREBASE_*)"
          detail={
            missingEnv.length
              ? `Faltan: ${missingEnv.join(", ")}. Reinicia el servidor de desarrollo después de añadirlas.`
              : `Proyecto ${firebaseConfig.projectId} · VAPID ${vapidKey ? `${vapidKey.slice(0, 8)}…` : "ausente"}`
          }
        />
        <Check
          tone={!swFile ? "info" : swFile.ok && swFile.isJavaScript ? "ok" : swFile.ok ? "warn" : "error"}
          label="El service worker se sirve como JavaScript"
          detail={
            !swFile
              ? "Comprobando…"
              : swFile.ok && swFile.isJavaScript
                ? `/firebase-messaging-sw.js · ${swFile.status} · ${swFile.contentType} · ${swFile.bytes} bytes`
                : swFile.ok
                  ? `Responde ${swFile.status} pero con “${swFile.contentType}”: el hosting está devolviendo el index.html de la SPA. Excluye esa ruta del fallback y sirve el archivo real.`
                  : `No se pudo descargar (${swFile.status}). ${swFile.error || ""}`
          }
        />
        <Check
          tone={worker?.ours?.active ? "ok" : worker?.ours ? "warn" : "error"}
          label="Service worker de notificaciones registrado"
          detail={
            worker?.ours
              ? `${worker.ours.scope} · ${worker.ours.active ? "activo" : "instalándose"} · ${worker.ours.scriptURL}`
              : "No hay ningún service worker con firebase-messaging-sw.js. Activa las notificaciones desde la campana."
          }
        />
        <Check
          tone={localToken ? "ok" : "warn"}
          label="Token FCM de este dispositivo"
          detail={
            localToken
              ? `${maskToken(localToken)} (${localToken.length} caracteres)${
                  tokenProject ? ` · proyecto del token: ${tokenProject}` : ""
                }`
              : "Todavía no hay token en este navegador: activa las notificaciones."
          }
          action={
            localToken ? (
              <Button variant="ghost" onClick={() => copy(localToken, "Token FCM copiado")}>
                <FiCopy /> Copiar
              </Button>
            ) : null
          }
        />
        {projectMismatch && (
          <Check
            tone="error"
            label="El token pertenece a otro proyecto de Firebase"
            detail={`El token dice “${tokenProject}” y la app está configurada con “${firebaseConfig.projectId}”. FCM responderá SENDER_ID_MISMATCH: revisa que la cuenta de servicio del backend sea del mismo proyecto.`}
          />
        )}
        <Check
          tone={devicesError ? "warn" : "ok"}
          label="Dispositivos registrados en la API"
          detail={
            devicesError
              ? devicesError
              : `${devices?.length ?? 0} dispositivo(s) con push para tu usuario.${
                  localToken ? (tokenInDatabase ? " El token de este navegador está guardado." : " Ojo: el token de este navegador NO aparece en la API.") : ""
                }`
          }
        />
        <Check
          tone={log[0] ? (log[0].ok ? "ok" : "error") : "info"}
          label="Última respuesta HTTP"
          detail={
            log[0]
              ? `${log[0].label} → ${log[0].status || "sin respuesta"}${log[0].message ? ` · ${log[0].message}` : ""}`
              : "Aún no has probado ninguna petición."
          }
        />
      </div>

      {/* ---------------- Pruebas en este navegador ---------------- */}
      <div className="mt-6 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FiZap className="text-brand-600" /> 1. Probar en este navegador
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Si la notificación local no aparece, el problema está en el navegador o en el service worker
          (permiso, HTTPS, archivo no servido). No hace falta Firebase.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={testLocalNotification} loading={busyAction === "local"}>
            <FiBell /> Notificación local
          </Button>
          <Button
            variant="secondary"
            onClick={testSimulatedPush}
            loading={busyAction === "simulate"}
          >
            <FiActivity /> Simular push (service worker)
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              retry?.();
              refresh?.();
              notify("Estado del push actualizado");
            }}
          >
            <FiRefreshCw /> Reintentar sincronización
          </Button>
        </div>
      </div>

      {/* ---------------- Token de la base de datos ---------------- */}
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FiSend className="text-brand-600" /> 2. Probar un token de la base de datos
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Pega el token de la tabla <code className="font-mono">push_devices</code> (o el de cualquier
          dispositivo de la lista de abajo) y pide a la API que le envíe una prueba. La respuesta HTTP
          queda registrada abajo, tal cual la devolvió el servidor.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field
            label="Token de FCM"
            hint={
              decoded
                ? `Se pudo leer el token: proyecto ${decoded.projectId || "desconocido"}${
                    decoded.appId ? ` · app ${String(decoded.appId).slice(0, 24)}…` : ""
                  }`
                : "El formato del token no permite leer su contenido (es normal): solo se envía tal cual."
            }
          >
            <input
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="fZx…  (pega aquí el token guardado en la base de datos)"
              className="admin-input font-mono text-[12px]"
              aria-label="Token de FCM a probar"
            />
          </Field>
          <div className="flex flex-wrap gap-2 pb-1">
            <Button
              onClick={() => testApiPush()}
              loading={busyAction === "api"}
              disabled={!tokenInput.trim()}
            >
              <FiSend /> Enviar prueba
            </Button>
            <Button variant="secondary" onClick={() => testApiPush(tokenInput.trim() || localToken)}>
              <FiSend /> A todos mis dispositivos
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => copy(tokenInput || localToken, "Token copiado")}>
            <FiCopy /> Copiar token
          </Button>
          <Button variant="ghost" onClick={() => copy(curlCommand, "Comando curl copiado")}>
            <FiCopy /> Copiar curl
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              copy(
                `${firebaseConsoleUrl}\n(token: ${tokenInput || localToken || "<TU_TOKEN>"})`,
                "Enlace y token copiados: pégalos en “Enviar mensaje de prueba” de Firebase"
              )
            }
          >
            <FiCopy /> Copiar enlace de Firebase Console
          </Button>
          <a
            href={firebaseConsoleUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FiExternalLink /> Consola de Firebase
          </a>
          {tokenInput.trim() && (
            <Button
              variant="ghost"
              onClick={() => removeDevice(tokenInput.trim())}
              loading={busyAction === `remove-${tokenInput.trim()}`}
            >
              <FiTrash2 /> Dar de baja el token
            </Button>
          )}
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-500">
          Regla práctica: si Firebase Console entrega al mismo token pero{" "}
          <code className="font-mono">POST /push/devices/test</code> falla, el problema está en el
          backend (cuenta de servicio de otro proyecto, credenciales sin permiso, o la API legacy
          <code className="mx-1 font-mono">fcm.googleapis.com/fcm/send</code> que Google apagó en 2024).
        </p>
      </div>

      {/* ---------------- Dispositivos ---------------- */}
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FiBell className="text-brand-600" /> 3. Dispositivos registrados (GET /push/devices)
        </h3>
        {devices === null ? (
          <p className="mt-2 text-[13px] text-slate-400">Consultando la API…</p>
        ) : devices.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-500">
            La API no tiene dispositivos para tu usuario. Si este navegador ya tiene token, vuelve a
            activar las notificaciones para que se registre.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-3 py-2.5">Token</th>
                  <th className="px-3 py-2.5">Plataforma</th>
                  <th className="px-3 py-2.5">Última vez</th>
                  <th className="px-3 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((device) => {
                  const deviceToken = String(device.token || "");
                  const isLocal = deviceToken && deviceToken === localToken;
                  return (
                    <tr key={device.id || deviceToken} className={cx(isLocal && "bg-brand-50/40")}>
                      <td className="max-w-72 px-3 py-2.5">
                        <button
                          type="button"
                          title="Usar este token en la prueba"
                          onClick={() => setTokenInput(deviceToken)}
                          className="truncate font-mono text-[12px] text-slate-600 transition hover:text-brand-700"
                        >
                          {maskToken(deviceToken)}
                        </button>
                        {isLocal && (
                          <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                            este navegador
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{device.platform || "web"}</td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {device.last_seen_at ? formatDateTime(device.last_seen_at) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="Enviar una prueba a este token"
                            disabled={busyAction === `device-${deviceToken}`}
                            onClick={() => testApiPush(deviceToken)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
                          >
                            <FiSend />
                          </button>
                          <button
                            type="button"
                            title="Copiar el token completo"
                            onClick={() => copy(deviceToken, "Token copiado")}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            <FiCopy />
                          </button>
                          <button
                            type="button"
                            title="Dar de baja este dispositivo"
                            disabled={busyAction === `remove-${deviceToken}`}
                            onClick={() => removeDevice(deviceToken)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Historial ---------------- */}
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FiInfo className="text-brand-600" /> 4. Respuestas de la API
          {ranAt && (
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              Diagnóstico: {formatDateTime(ranAt)}
            </span>
          )}
        </h3>
        {log.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-400">
            Aquí aparecerá la respuesta de cada prueba (código HTTP, mensaje y cuerpo JSON).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {log.map((entry) => (
              <li
                key={entry.id}
                className={cx(
                  "rounded-lg border px-3 py-2 text-[12px]",
                  entry.ok ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"
                )}
              >
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                  {entry.ok ? <FiCheckCircle /> : <FiXCircle />}
                  <span className="font-mono text-[11px]">
                    {entry.status ? `HTTP ${entry.status}` : "sin respuesta"}
                  </span>
                  <span>{entry.label}</span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {formatDateTime(entry.at)}
                  </span>
                </p>
                {entry.message && <p className="mt-1 text-slate-600">{entry.message}</p>}
                {entry.data && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-slate-500">Ver cuerpo de la respuesta</summary>
                    <pre className="mt-1 max-h-56 overflow-auto rounded bg-white/80 p-2 font-mono text-[11px] leading-4 text-slate-600">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------- Causas frecuentes ---------------- */}
      <details className="mt-5 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-800">
          Causas frecuentes de que no llegue la notificación
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-5 text-slate-600">
          <li>
            El backend usa la <b>API legacy</b> (<code className="font-mono">/fcm/send</code>): Google la
            apagó en 2024 y responde error sin avisar. Migra a HTTP v1 (ver{" "}
            <code className="font-mono">docs/API-PUSH.md</code>).
          </li>
          <li>
            La cuenta de servicio del backend es de <b>otro proyecto</b> de Firebase: FCM responde{" "}
            <code className="font-mono">SENDER_ID_MISMATCH</code>. Compara el proyecto del token con el
            de la app en la primera comprobación de este panel.
          </li>
          <li>
            El token de la base de datos es <b>viejo</b> (otro navegador, perfil borrado, app
            desinstalada): FCM responde <code className="font-mono">UNREGISTERED</code>. Da de baja ese
            token y registra el dispositivo actual.
          </li>
          <li>
            Faltan las claves <code className="font-mono">webpush</code> en el envío
            (<code className="font-mono">webpush.headers.TTL</code> o un payload de solo datos sin
            `notification`): algunos navegadores no muestran nada si el mensaje no trae contenido.
          </li>
          <li>
            En <b>iPhone/iPad</b> el push web necesita iOS 16.4+ y el panel instalado como app
            (Compartir → Añadir a pantalla de inicio).
          </li>
          <li>
            En el navegador: permiso bloqueado, HTTPS ausente o service worker servido como HTML (las
            dos últimas comprobaciones de arriba lo detectan).
          </li>
        </ul>
      </details>
    </Card>
  );
};

export default PushDiagnostics;
