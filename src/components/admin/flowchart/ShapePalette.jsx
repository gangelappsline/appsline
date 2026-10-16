/* eslint-disable react/prop-types */
import { useState } from "react";
import { FiLayout, FiSearch } from "react-icons/fi";
import ShapeSvg from "./ShapeSvg";
import { SHAPES, SHAPE_GROUPS, TEMPLATES } from "../../../utils/diagrams";
import { cx } from "../../../utils/format";

export const SHAPE_MIME = "application/x-appsline-shape";

/** Miniatura de una forma para la paleta. */
export const ShapeGlyph = ({ shape, width = 48, height = 30, className = "" }) => (
  <ShapeSvg
    shape={shape.key}
    width={width}
    height={height}
    className={className}
    style={{ fill: shape.fill, stroke: shape.stroke, strokeWidth: 1.5, radius: 4, shadow: false }}
  />
);

/**
 * Paleta lateral: formas (arrastrar al lienzo o clic para insertarlas) y
 * plantillas que se pueden insertar en el diagrama actual.
 */
const ShapePalette = ({ onAddShape, onInsertTemplate }) => {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("shapes");
  const term = query.trim().toLowerCase();

  const visible = SHAPES.filter(
    (s) => !term || `${s.label} ${s.hint}`.toLowerCase().includes(term),
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex gap-1 border-b border-slate-100 p-2">
        {[
          { key: "shapes", label: "Formas" },
          { key: "templates", label: "Plantillas" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cx(
              "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
              tab === t.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "shapes" ? (
        <>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <FiSearch className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar forma..."
              aria-label="Buscar forma"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {SHAPE_GROUPS.map((group) => {
              const items = visible.filter((s) => s.group === group.key);
              if (!items.length) return null;
              return (
                <div key={group.key} className="mb-3">
                  <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((shape) => (
                      <button
                        key={shape.key}
                        type="button"
                        draggable
                        title={`${shape.label} — ${shape.hint}\nArrastra al lienzo o haz clic para insertar`}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(SHAPE_MIME, shape.key);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onAddShape?.(shape.key)}
                        className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-center transition hover:border-brand-300 hover:bg-brand-50/40 active:cursor-grabbing"
                      >
                        <ShapeGlyph shape={shape} />
                        <span className="w-full truncate text-[11px] font-medium text-slate-600">
                          {shape.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-400">Sin formas con ese nombre</p>
            )}
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-4 text-slate-400">
            Doble clic en el lienzo crea un proceso. Doble clic en una forma edita su texto.
          </p>
        </>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {TEMPLATES.filter((t) => t.key !== "blank").map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => onInsertTemplate?.(tpl.key)}
              className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FiLayout />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-700">{tpl.label}</span>
                <span className="block text-[11px] leading-4 text-slate-400">{tpl.description}</span>
              </span>
            </button>
          ))}
          <p className="px-1 pt-1 text-[11px] leading-4 text-slate-400">
            La plantilla se agrega junto a lo que ya tengas en el lienzo; nada se borra.
          </p>
        </div>
      )}
    </aside>
  );
};

export default ShapePalette;
