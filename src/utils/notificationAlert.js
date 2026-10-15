/**
 * Ayudas para que una notificación se note aunque la pestaña esté abierta:
 *   - Indicador en la pestaña: contador en `document.title`, Badging API
 *     (`navigator.setAppBadge`) y punto sobre el favicon.
 *   - Sonido de aviso (Web Audio + respaldo con archivo de audio).
 *
 * El contador representa las notificaciones **sin leer** de la bandeja
 * (`src/utils/notificationInbox.js`) y solo se limpia cuando el usuario abre la
 * campana, por eso `setBaseTitle()` permite cambiar el título de la página sin
 * perder el `(3)` de avisos pendientes.
 *
 * Son funciones pensadas para ejecutarse en el navegador; en entornos sin
 * `window`/`document` (SSR, pruebas en Node) no hacen nada.
 */

const BASE_TITLE_KEY = "appsline.baseTitle";

/** Último contador aplicado: permite repintar el título cuando cambia la página. */
let currentCount = 0;

/** Título base de la pestaña (sin contador). */
export const getBaseTitle = () => {
  if (typeof document === "undefined") return "Appsline";
  try {
    const stored = sessionStorage.getItem(BASE_TITLE_KEY);
    if (stored) return stored;
  } catch {
    /* sessionStorage puede no estar disponible */
  }
  const current = String(document.title || "Appsline").replace(/^\(\d+\)\s*/, "");
  try {
    sessionStorage.setItem(BASE_TITLE_KEY, current);
  } catch {
    /* ignore */
  }
  return current || "Appsline";
};

/** Contador de notificaciones sin leer que muestra ahora la pestaña. */
export const getTabIndicator = () => currentCount;

/**
 * Fija el título base de la pestaña (por ejemplo `Appsline · Dashboard`) sin
 * perder el contador de notificaciones sin leer. Las páginas del panel usan
 * esto en lugar de escribir `document.title` a mano: si no, cada navegación
 * borraría el aviso de "(3) Appsline · Tareas".
 */
export const setBaseTitle = (base) => {
  const clean = String(base || "Appsline").replace(/^\(\d+\)\s*/, "");
  try {
    sessionStorage.setItem(BASE_TITLE_KEY, clean);
  } catch {
    /* ignore */
  }
  return setTabIndicator(currentCount);
};

/** Formatea el título de la pestaña con el contador de notificaciones sin leer. */
export const formatTabTitle = (count = 0, baseTitle) => {
  const base = (baseTitle || getBaseTitle() || "Appsline").replace(/^\(\d+\)\s*/, "");
  const n = Math.max(0, Number(count) || 0);
  return n > 0 ? `(${n}) ${base}` : base;
};

/** Actualiza el indicador de la pestaña (título + badge del navegador + favicon). */
export const setTabIndicator = (count = 0) => {
  if (typeof document === "undefined") return 0;
  const n = Math.max(0, Number(count) || 0);
  currentCount = n;
  document.title = formatTabTitle(n);
  // Badging API (Chrome/Edge para PWAs instaladas y, en algunos casos, pestañas).
  try {
    if (n > 0 && typeof navigator !== "undefined" && navigator.setAppBadge) {
      navigator.setAppBadge(n).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch {
    /* Badging API no disponible */
  }
  try {
    drawFaviconBadge(n);
  } catch {
    /* ignore */
  }
  return n;
};

/** Alias semántico: marca que hay notificaciones sin leer. */
export const setTabBadge = setTabIndicator;
export const setAppBadge = setTabIndicator;
export const setNotificationBadge = setTabIndicator;
export const updateTabIndicator = setTabIndicator;

/** Limpia el indicador de la pestaña. */
export const clearTabIndicator = () => setTabIndicator(0);
export const clearTabBadge = clearTabIndicator;
export const clearAppBadge = clearTabIndicator;
export const clearNotificationBadge = clearTabIndicator;

/** Dibuja un punto/contador sobre el favicon actual (best effort). */
export function drawFaviconBadge(count = 0) {
  if (typeof document === "undefined") return;
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  const n = Math.max(0, Number(count) || 0);
  let img;
  try {
    img = new Image();
  } catch {
    return;
  }
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      if (n > 0) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(24, 8, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n > 9 ? "9+" : String(n), 24, 9);
      }
      const url = canvas.toDataURL("image/png");
      link.href = url;
    } catch {
      /* canvas puede fallar por CORS; se ignora */
    }
  };
  try {
    img.src = link.href;
  } catch {
    /* ignore */
  }
}

/** Reproduce un sonido de aviso. Intenta un archivo y, si falla, un beep Web Audio. */
export function playNotificationSound() {
  if (typeof window === "undefined") return false;
  // 1) Archivo de audio (si existe en /public).
  try {
    const audio = new Audio("/notification.wav");
    audio.volume = 0.5;
    const result = audio.play();
    if (result && typeof result.then === "function") {
      result
        .then(() => {})
        .catch(() => {
          beepWithWebAudio();
        });
      return true;
    }
    return true;
  } catch {
    /* sigue con Web Audio */
  }
  return beepWithWebAudio();
}

/** Beep generado con Web Audio (sin archivos externos). */
export function beepWithWebAudio() {
  if (typeof window === "undefined") return false;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.35);
    oscillator.onended = () => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    };
    return true;
  } catch {
    return false;
  }
}

/** Alias comunes. */
export const playNotificationBeep = playNotificationSound;
export const playSound = playNotificationSound;
export const playBeep = beepWithWebAudio;

export default {
  getBaseTitle,
  getTabIndicator,
  setBaseTitle,
  formatTabTitle,
  setTabIndicator,
  setTabBadge,
  setAppBadge,
  setNotificationBadge,
  updateTabIndicator,
  clearTabIndicator,
  clearTabBadge,
  clearAppBadge,
  clearNotificationBadge,
  drawFaviconBadge,
  playNotificationSound,
  beepWithWebAudio,
  playNotificationBeep,
  playSound,
  playBeep,
};
