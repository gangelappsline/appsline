/* eslint-disable react/prop-types */
import { useState } from "react";
import { FiGrid, FiMonitor, FiPlus, FiSearch, FiSmartphone } from "react-icons/fi";
import {
  DEVICES,
  DEVICE_GROUPS,
  WIDGETS,
  WIDGET_GROUPS,
  makeWidget,
  widgetMeta,
} from "../../../utils/mockups";
import WidgetBody from "./MockupWidget";
import { cx } from "../../../utils/format";

/** Tipos de arrastre propios de la biblioteca de mockups. */
export const SCREEN_MIME = "application/x-appsline-screen";
export const WIDGET_MIME = "application/x-appsline-widget";

const MiniDevice = ({ device }) => {
  const ratio = Math.min(34 / device.width, 54 / device.height);
  const width = Math.max(12, Math.round(device.width * ratio));
  const height = Math.max(18, Math.round(device.height * ratio));
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center border-[2px] border-slate-700 bg-slate-100"
      style={{ width, height, borderRadius: Math.max(2, Math.round((device.radius || 6) * ratio)) }}
    >
      {device.browserBar ? (
        <span className="h-[3px] w-full self-start bg-slate-300" />
      ) : device.notch === "island" ? (
        <span className="mt-[3px] h-[2px] w-1/3 self-start rounded-full bg-slate-700" />
      ) : null}
    </span>
  );
};

/** Elemento de ejemplo a tamaño de miniatura. */
const WidgetGlyph = ({ type }) => {
  const meta = widgetMeta(type);
  const widget = makeWidget(type);
  const scale = Math.min(40 / meta.w, 22 / meta.h);
  return (
    <span aria-hidden="true" className="relative flex h-[26px] w-[46px] items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
      <span
        style={{
          width: meta.w,
          height: meta.h,
          transform: `scale(${Math.max(0.06, scale)})`,
          transformOrigin: "center",
          display: "block",
        }}
      >
        <WidgetBody widget={widget} />
      </span>
    </span>
  );
};

/**
 * Biblioteca de mockups: dispositivos y elementos de pantalla.
 *
 * Se puede arrastrar un dispositivo al lienzo (crea la pantalla) o un elemento
 * directamente sobre una pantalla (lo coloca donde se suelte). También funciona
 * con clic: el elemento se agrega a la pantalla activa.
 */
const MockupPalette = ({ onAddScreen, onAddWidget, activeScreenLabel, onClose }) => {
  const [tab, setTab] = useState("devices");
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const widgets = WIDGETS.filter((widget) => !term || `${widget.label} ${widget.hint}`.toLowerCase().includes(term));

  return (
    <aside
      aria-label="Biblioteca de pantallas y elementos"
      className="flow-library thin-scroll absolute inset-y-0 left-0 z-20 flex w-64 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl lg:relative lg:shadow-none"
    >
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <div>
          <p className="text-xs font-bold text-slate-800">Mockups</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {activeScreenLabel ? `Pantalla activa: ${activeScreenLabel}` : "Arrastra un dispositivo al lienzo"}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar biblioteca" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            <FiGrid />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-slate-100 p-2">
        {[
          { key: "devices", label: "Pantallas" },
          { key: "widgets", label: "Elementos" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cx(
              "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
              tab === item.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "devices" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {DEVICE_GROUPS.map((group) => {
            const items = DEVICES.filter((device) => device.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key} className="mb-3">
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map((device) => (
                    <button
                      key={device.key}
                      type="button"
                      draggable
                      title={`${device.label} · ${device.width}×${device.height}\nArrastra al lienzo o haz clic para insertar`}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(SCREEN_MIME, device.key);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onAddScreen?.(device.key)}
                      className="flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-2.5 text-center transition hover:border-brand-300 hover:bg-brand-50/40 active:cursor-grabbing"
                    >
                      <MiniDevice device={device} />
                      <span className="w-full truncate text-[11px] font-medium text-slate-600">{device.label}</span>
                      <span className="text-[9px] text-slate-400">
                        {device.browserBar ? <FiMonitor className="mx-auto" /> : <FiSmartphone className="mx-auto" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="px-1 pt-1 text-[11px] leading-4 text-slate-400">
            Cada pantalla es un nodo del diagrama: conéctalas con flechas para dejar claro el flujo.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <FiSearch className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar elemento…"
              aria-label="Buscar elemento"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
            {WIDGET_GROUPS.map((group) => {
              const items = widgets.filter((widget) => widget.group === group.key);
              if (!items.length) return null;
              return (
                <div key={group.key}>
                  <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((widget) => (
                      <button
                        key={widget.key}
                        type="button"
                        draggable
                        title={`${widget.label} — ${widget.hint}\nArrástralo sobre una pantalla o haz clic para agregarlo`}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(WIDGET_MIME, widget.key);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onAddWidget?.(widget.key)}
                        className="flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-center transition hover:border-brand-300 hover:bg-brand-50/40 active:cursor-grabbing"
                      >
                        <WidgetGlyph type={widget.key} />
                        <span className="w-full truncate text-[11px] font-medium text-slate-600">{widget.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {!widgets.length && <p className="px-2 py-6 text-center text-xs text-slate-400">Sin elementos con ese nombre</p>}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => onAddWidget?.("text")}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-2 py-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              <FiPlus /> Agregar a la pantalla activa
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

export { MiniDevice, WidgetGlyph };
export default MockupPalette;
