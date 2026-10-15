/* eslint-disable react/prop-types */
/**
 * Tarjeta de Configuración > Preferencias para activar/desactivar las
 * notificaciones push del navegador y probarlas.
 *
 * Todo el estado viene de `usePushNotifications()` (ver `src/routes/PushContext.jsx`).
 */
import { useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiBellOff,
  FiCheckCircle,
  FiCopy,
  FiInfo,
  FiSend,
  FiSmartphone,
} from "react-icons/fi";
import { Button, Card, CardHeader } from ".";
import { useToast } from "./Toasts";
import { usePushNotifications } from "../../routes/PushContext";

/** Texto corto del token FCM para mostrarlo en la interfaz. */
const maskToken = (token = "") =>
  token.length > 16 ? `${token.slice(0, 8)}…${token.slice(-6)}` : token;

/** Caja de aviso con tono semántico. */
const Notice = ({ tone = "info", icon: Icon = FiInfo, children }) => {
  const tones = {
    info: "border-brand-100 bg-brand-50/60 text-brand-800",
    success: "border-emerald-100 bg-emerald-50/60 text-emerald-800",
    danger: "border-red-100 bg-red-50/60 text-red-700",
    warning: "border-amber-100 bg-amber-50/60 text-amber-800",
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 shrink-0 text-base" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
};

const PushSettings = ({ className = "" }) => {
  const {
    status,
    blocker,
    permission,
    token,
    deviceCount,
    endpointSupported,
    error,
    busy,
    missingEnv = [],
    enable,
    disable,
    sendTest,
    retry,
    refresh,
  } = usePushNotifications();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  const active = status === "on";

  /** Copia el token FCM completo (se pega en la consola de Firebase para probar). */
  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      notify("Token FCM copiado al portapapeles");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("No se pudo copiar el token. Cópialo desde la consola del navegador.", "error");
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <CardHeader
        title="Notificaciones push"
        subtitle="Recibe avisos de tareas y proyectos aunque el panel esté cerrado."
        actions={
          active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <FiCheckCircle /> Activas
            </span>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {active ? <FiBell /> : <FiBellOff />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Este dispositivo</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {active
                ? "Las notificaciones están activas en este navegador."
                : "Actívalas para que el navegador te avise al instante."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {active ? (
            <>
              <Button variant="secondary" onClick={sendTest} loading={busy}>
                <FiSend /> Enviar prueba
              </Button>
              <Button variant="ghost" onClick={disable} disabled={busy}>
                <FiBellOff /> Desactivar
              </Button>
            </>
          ) : (
            <Button
              onClick={enable}
              loading={busy}
              disabled={Boolean(blocker) || status === "loading"}
            >
              <FiBell /> Activar notificaciones
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {status === "loading" && (
          <Notice>Comprobando el estado de las notificaciones…</Notice>
        )}

        {status === "unsupported" && (
          <Notice tone="warning" icon={FiAlertTriangle}>
            <p className="font-semibold">Este navegador no soporta notificaciones push.</p>
            <p>
              Usa una versión reciente de Chrome, Edge, Firefox o Safari. En iPhone
              es necesario instalar el panel como app (Compartir → Añadir a inicio).
            </p>
          </Notice>
        )}

        {status === "insecure-context" && (
          <Notice tone="warning" icon={FiAlertTriangle}>
            <p className="font-semibold">El sitio debe servirse por HTTPS.</p>
            <p>
              Las notificaciones push solo funcionan en HTTPS (o en{" "}
              <code className="font-mono">localhost</code> durante el desarrollo).
            </p>
          </Notice>
        )}

        {status === "not-configured" && (
          <Notice tone="info" icon={FiInfo}>
            <p className="font-semibold">Firebase todavía no está configurado.</p>
            <p>
              Agrega estas variables al <code className="font-mono">.env</code> y
              reinicia el servidor de desarrollo:
            </p>
            {(missingEnv.length
              ? missingEnv
              : ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_APP_ID"]
            ).map((key) => (
              <code key={key} className="block font-mono text-[12px]">
                {key}=…
              </code>
            ))}
            <p>
              La guía completa (crear la app web, obtener la clave VAPID y lo que
              falta en la API) está en <code className="font-mono">docs/API-PUSH.md</code>.
            </p>
          </Notice>
        )}

        {status === "missing-vapid-key" && (
          <Notice tone="info" icon={FiInfo}>
            <p className="font-semibold">Falta la clave VAPID.</p>
            <p>
              Genera un par de claves en Firebase Console → Cloud Messaging →
              Certificados push web y guarda la clave pública en la variable{" "}
              <code className="font-mono">VITE_FIREBASE_VAPID_KEY</code>.
            </p>
          </Notice>
        )}

        {status === "permission-denied" && (
          <Notice tone="warning" icon={FiAlertTriangle}>
            <p className="font-semibold">El navegador bloqueó las notificaciones.</p>
            <p>
              Ábrelas en el candado 🔒 de la barra de direcciones → Notificaciones →
              Permitir, y vuelve a intentarlo.
            </p>
            <Button variant="subtle" onClick={refresh} className="mt-1">
              Ya las habilité, verificar de nuevo
            </Button>
          </Notice>
        )}

        {status === "error" && (
          <Notice tone="danger" icon={FiAlertTriangle}>
            <p className="font-semibold">No se pudieron activar las notificaciones.</p>
            {error && <p>{error}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={retry} disabled={busy}>
                Reintentar
              </Button>
              <Button variant="ghost" onClick={enable} disabled={busy}>
                Activar de nuevo
              </Button>
            </div>
          </Notice>
        )}

        {active && (
          <>
            <Notice tone="success" icon={FiCheckCircle}>
              <p className="font-semibold">Listo: este dispositivo recibirá los avisos.</p>
              <p>
                Permiso del navegador: <strong>{permission}</strong>. Prueba con
                “Enviar prueba”: si la API aún no expone{" "}
                <code className="font-mono">POST /push/devices/test</code>, se
                mostrará una notificación local.
              </p>
              <p>
                Cada aviso queda guardado en la <strong>campana 🔔 del encabezado</strong>:
                ahí puedes revisarlo aunque el aviso flotante ya haya desaparecido. La
                lista se marca como leída al abrirla, y con eso desaparece el contador
                de la pestaña.
              </p>
            </Notice>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <FiSmartphone /> {maskToken(token) || "token pendiente"}
              </span>
              {token && (
                <button
                  type="button"
                  onClick={copyToken}
                  className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-brand-600"
                  title="Copiar el token FCM completo (para enviar una prueba desde la consola de Firebase)"
                >
                  <FiCopy /> {copied ? "Copiado" : "Copiar token"}
                </button>
              )}
              {typeof deviceCount === "number" && (
                <span>
                  {deviceCount === 1
                    ? "1 dispositivo con notificaciones activas"
                    : `${deviceCount} dispositivos con notificaciones activas`}
                </span>
              )}
              {!endpointSupported && (
                <span className="text-amber-600">
                  La API todavía no guarda el dispositivo (falta{" "}
                  <code className="font-mono">POST /push/devices</code>).
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default PushSettings;
