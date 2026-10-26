/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiChevronLeft, FiMonitor, FiPlay, FiRotateCcw, FiX } from "react-icons/fi";
import MockupPreview from "./MockupPreview";
import { deviceMeta, screenLinks, SCREEN_SHAPE, SCREEN_TYPE } from "../../../utils/mockups";
import { cx } from "../../../utils/format";

/**
 * Prototipo navegable: muestra la pantalla a tamaño de dispositivo y permite
 * recorrer el flujo siguiendo las conexiones del diagrama (incluidas las que
 * salen de un botón concreto).
 */
const PrototypePlayer = ({ open, onClose, nodes = [], edges = [], startId = null, onCommentAt = null }) => {
  const screens = useMemo(
    () => nodes.filter((node) => node.type === SCREEN_TYPE || node.data?.shape === SCREEN_SHAPE),
    [nodes],
  );
  const initial = startId || screens.find((screen) => screen.data?.start)?.id || screens[0]?.id || null;
  const [currentId, setCurrentId] = useState(initial);
  const [history, setHistory] = useState([]);
  const [size, setSize] = useState({ width: 1280, height: 800 });
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setCurrentId(initial);
    setHistory([]);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const rect = boxRef.current?.getBoundingClientRect();
      setSize({ width: rect?.width || 640, height: rect?.height || 620 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, currentId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = screens.find((screen) => screen.id === currentId) || screens[0];
  if (!current) {
    return (
      <Modal onClose={onClose}>
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Aún no hay pantallas en este diagrama</p>
          <p className="mt-1 text-xs text-slate-500">Agrega una pantalla desde la biblioteca de mockups para probar el flujo.</p>
        </div>
      </Modal>
    );
  }

  const device = deviceMeta(current.data?.device);
  const links = screenLinks(nodes, edges, current.id);
  const scale = Math.max(0.28, Math.min((size.height - 36) / device.height, (size.width - 40) / device.width, 1));

  const go = (id) => {
    if (!id || id === current.id) return;
    setHistory((stack) => [...stack, current.id]);
    setCurrentId(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Prototipo del flujo">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <FiPlay /> Prototipo
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
          {device.label} · {current.data?.label || "Pantalla"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const prev = history[history.length - 1];
              if (!prev) return;
              setHistory((stack) => stack.slice(0, -1));
              setCurrentId(prev);
            }}
            disabled={!history.length}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            <FiChevronLeft /> Atrás
          </button>
          <button
            type="button"
            onClick={() => {
              setHistory([]);
              setCurrentId(initial);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            <FiRotateCcw /> Reiniciar
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10" aria-label="Cerrar prototipo">
            <FiX />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={boxRef} className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-4">
          <MockupPreview
            node={{ ...current, width: device.width, height: device.height }}
            scale={scale}
            onWidgetClick={(widget) => {
              const link = links.find((item) => item.originWidgetId === widget.id);
              if (link) go(link.targetId);
              else if (onCommentAt) onCommentAt(current.id, widget.id);
            }}
          />
        </div>

        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 p-3 text-white md:flex">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Pantallas</p>
            <div className="mt-1.5 space-y-1">
              {screens.map((screen) => (
                <button
                  key={screen.id}
                  type="button"
                  onClick={() => go(screen.id)}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition",
                    screen.id === current.id ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10",
                  )}
                >
                  <FiMonitor className="shrink-0 opacity-60" />
                  <span className="truncate">{screen.data?.label || "Pantalla"}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Siguientes</p>
            {!links.length && <p className="mt-1.5 text-[11px] leading-4 text-white/40">Esta pantalla no tiene conexiones de salida.</p>}
            <div className="mt-1.5 space-y-1">
              {links.map((link) => (
                <button
                  key={link.edgeId}
                  type="button"
                  onClick={() => go(link.targetId)}
                  className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/20"
                >
                  <FiArrowLeft className="shrink-0 rotate-180 opacity-60" />
                  <span className="min-w-0 flex-1 truncate">{link.label || link.targetLabel}</span>
                  <span className="truncate text-[10px] text-white/40">{link.targetLabel}</span>
                </button>
              ))}
            </div>
          </section>

          <p className="mt-auto text-[10px] leading-4 text-white/40">
            Haz clic en un botón de la pantalla para seguir el flujo. Las flechas del diagrama definen la navegación.
          </p>
        </aside>
      </div>
    </div>
  );
};

const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <p className="text-sm font-semibold text-slate-700">Prototipo</p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <FiX />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default PrototypePlayer;
