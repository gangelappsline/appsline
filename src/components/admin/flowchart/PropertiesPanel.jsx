/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiArrowDown,
  FiArrowUp,
  FiBold,
  FiChevronDown,
  FiCopy,
  FiItalic,
  FiLock,
  FiRepeat,
  FiTrash2,
  FiUnlock,
} from "react-icons/fi";
import {
  BACKGROUNDS,
  COLOR_PRESETS,
  DASH_OPTIONS,
  DIRECTIONS,
  EDGE_KINDS,
  MARKERS,
  SHAPES,
  THEMES,
  shapeMeta,
} from "../../../utils/diagrams";
import { cx } from "../../../utils/format";
import { NODE_ICONS } from "./icons";
import { ShapeGlyph } from "./ShapePalette";

/* ---------------- Controles básicos ---------------- */

const Section = ({ title, children, defaultOpen = true, action }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-100">
      <header className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          <FiChevronDown className={cx("transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {action}
      </header>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </section>
  );
};

const Row = ({ label, children, hint }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="shrink-0 text-xs text-slate-500" title={hint}>
      {label}
    </span>
    <div className="flex min-w-0 items-center gap-1.5">{children}</div>
  </div>
);

const Input = ({ className = "", ...props }) => (
  <input
    {...props}
    className={cx(
      "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15",
      className,
    )}
  />
);

const Select = ({ className = "", children, ...props }) => (
  <select
    {...props}
    className={cx(
      "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15",
      className,
    )}
  >
    {children}
  </select>
);

const ColorInput = ({ value, onChange, allowTransparent = false, label }) => {
  const transparent = !value || value === "transparent";
  return (
    <div className="flex items-center gap-1">
      <label
        className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200"
        title={label}
        style={{
          background: transparent
            ? "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 8px 8px"
            : value,
        }}
      >
        <input
          type="color"
          value={transparent ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        value={transparent ? "" : value}
        placeholder={transparent ? "ninguno" : "#000000"}
        onChange={(e) => onChange(e.target.value || (allowTransparent ? "transparent" : "#000000"))}
        className="w-[76px] font-mono"
        aria-label={`${label} (hex)`}
      />
      {allowTransparent && (
        <button
          type="button"
          onClick={() => onChange("transparent")}
          title="Sin color"
          className={cx(
            "rounded-md border px-1.5 py-1 text-[10px] font-semibold",
            transparent ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
          )}
        >
          Ø
        </button>
      )}
    </div>
  );
};

const Segmented = ({ value, options, onChange, ariaLabel }) => (
  <div role="radiogroup" aria-label={ariaLabel} className="flex overflow-hidden rounded-md border border-slate-200">
    {options.map((opt) => {
      const Icon = opt.icon;
      return (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={value === opt.key}
          title={opt.label}
          onClick={() => onChange(opt.key)}
          className={cx(
            "flex h-6 min-w-6 items-center justify-center px-1.5 text-xs transition",
            value === opt.key ? "bg-brand-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50",
          )}
        >
          {Icon ? <Icon /> : opt.short || opt.label}
        </button>
      );
    })}
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cx(
      "relative h-5 w-9 shrink-0 rounded-full transition",
      checked ? "bg-brand-600" : "bg-slate-300",
    )}
  >
    <span
      className={cx(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
        checked ? "left-[18px]" : "left-0.5",
      )}
    />
  </button>
);

const Slider = ({ value, min, max, step = 1, onChange, suffix = "" }) => (
  <div className="flex items-center gap-1.5">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-20 cursor-pointer accent-brand-600"
    />
    <span className="w-9 text-right text-[11px] tabular-nums text-slate-500">
      {value}
      {suffix}
    </span>
  </div>
);

const IconButton = ({ title, onClick, children, danger = false, active = false, disabled = false }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={cx(
      "flex h-7 w-7 items-center justify-center rounded-md border text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
      danger
        ? "border-red-200 text-red-600 hover:bg-red-50"
        : active
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50",
    )}
  >
    {children}
  </button>
);

/** Valor común entre varios elementos (o "" si difieren). */
const common = (items, pick) => {
  if (!items.length) return "";
  const first = pick(items[0]);
  return items.every((item) => pick(item) === first) ? first : "";
};

/* ---------------- Nodo(s) ---------------- */

const NodeProperties = ({
  nodes,
  onPatchData,
  onPatchStyle,
  onResize,
  onMove,
  onChangeShape,
  onAlign,
  onDistribute,
  onDelete,
  onDuplicate,
  onZOrder,
  onToggleLock,
}) => {
  const one = nodes.length === 1 ? nodes[0] : null;
  const style = (key) => common(nodes, (n) => n.data?.style?.[key]);
  const shape = common(nodes, (n) => n.data?.shape);
  const locked = nodes.every((n) => n.data?.locked);
  const many = nodes.length > 1;

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {one ? shapeMeta(one.data.shape).label : `${nodes.length} elementos`}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {one ? one.data.label || "Sin texto" : "Los cambios aplican a todos"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton title="Duplicar (Ctrl+D)" onClick={onDuplicate}>
            <FiCopy />
          </IconButton>
          <IconButton title={locked ? "Desbloquear" : "Bloquear posición"} onClick={onToggleLock} active={locked}>
            {locked ? <FiLock /> : <FiUnlock />}
          </IconButton>
          <IconButton title="Eliminar (Supr)" onClick={onDelete} danger>
            <FiTrash2 />
          </IconButton>
        </div>
      </div>

      {one && (
        <Section title="Contenido">
          <textarea
            value={one.data.label || ""}
            onChange={(e) => onPatchData({ label: e.target.value }, "label")}
            rows={2}
            placeholder="Texto del nodo"
            aria-label="Texto del nodo"
            className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
          />
          <Input
            value={one.data.description || ""}
            onChange={(e) => onPatchData({ description: e.target.value }, "description")}
            placeholder="Descripción (tooltip)"
            aria-label="Descripción"
            className="w-full"
          />
          <Input
            value={one.data.link || ""}
            onChange={(e) => onPatchData({ link: e.target.value }, "link")}
            placeholder="Enlace https://…"
            aria-label="Enlace"
            className="w-full"
          />
        </Section>
      )}

      <Section title="Forma">
        <div className="grid grid-cols-5 gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.key}
              type="button"
              title={s.label}
              aria-label={`Forma ${s.label}`}
              aria-pressed={shape === s.key}
              onClick={() => onChangeShape(s.key)}
              className={cx(
                "flex items-center justify-center rounded-md border p-1 transition",
                shape === s.key ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <ShapeGlyph shape={s} width={30} height={20} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Color">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              aria-label={`Color ${p.label}`}
              onClick={() => onPatchStyle({ fill: p.fill, stroke: p.stroke, textColor: p.text }, `preset-${p.key}`)}
              className="h-6 w-6 rounded-full border-2 transition hover:scale-110"
              style={{ background: p.fill, borderColor: p.stroke }}
            />
          ))}
        </div>
        <Row label="Relleno">
          <ColorInput label="Relleno" value={style("fill")} onChange={(v) => onPatchStyle({ fill: v }, "fill")} allowTransparent />
        </Row>
        <Row label="Borde">
          <ColorInput label="Borde" value={style("stroke")} onChange={(v) => onPatchStyle({ stroke: v }, "stroke")} allowTransparent />
        </Row>
        <Row label="Grosor">
          <Slider value={Number(style("strokeWidth") || 0)} min={0} max={10} step={0.5} onChange={(v) => onPatchStyle({ strokeWidth: v }, "strokeWidth")} suffix="px" />
        </Row>
        <Row label="Línea">
          <Select value={style("dash") || "solid"} onChange={(e) => onPatchStyle({ dash: e.target.value }, "dash")} aria-label="Estilo de línea">
            {DASH_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
        </Row>
        <Row label="Esquinas">
          <Slider value={Number(style("radius") || 0)} min={0} max={40} onChange={(v) => onPatchStyle({ radius: v }, "radius")} suffix="px" />
        </Row>
        <Row label="Opacidad">
          <Slider value={Math.round(Number(style("opacity") ?? 1) * 100)} min={10} max={100} onChange={(v) => onPatchStyle({ opacity: v / 100 }, "opacity")} suffix="%" />
        </Row>
        <Row label="Sombra">
          <Toggle label="Sombra" checked={Boolean(style("shadow"))} onChange={(v) => onPatchStyle({ shadow: v }, "shadow")} />
        </Row>
      </Section>

      <Section title="Texto">
        <Row label="Color">
          <ColorInput label="Color del texto" value={style("textColor")} onChange={(v) => onPatchStyle({ textColor: v }, "textColor")} />
        </Row>
        <Row label="Tamaño">
          <Slider value={Number(style("fontSize") || 14)} min={9} max={48} onChange={(v) => onPatchStyle({ fontSize: v }, "fontSize")} suffix="px" />
        </Row>
        <Row label="Estilo">
          <IconButton title="Negrita" active={Number(style("fontWeight")) >= 600} onClick={() => onPatchStyle({ fontWeight: Number(style("fontWeight")) >= 600 ? 400 : 700 }, "fontWeight")}>
            <FiBold />
          </IconButton>
          <IconButton title="Cursiva" active={style("fontStyle") === "italic"} onClick={() => onPatchStyle({ fontStyle: style("fontStyle") === "italic" ? "normal" : "italic" }, "fontStyle")}>
            <FiItalic />
          </IconButton>
        </Row>
        <Row label="Alinear">
          <Segmented
            ariaLabel="Alineación horizontal del texto"
            value={style("align") || "center"}
            onChange={(v) => onPatchStyle({ align: v }, "align")}
            options={[
              { key: "left", label: "Izquierda", icon: FiAlignLeft },
              { key: "center", label: "Centro", icon: FiAlignCenter },
              { key: "right", label: "Derecha", icon: FiAlignRight },
            ]}
          />
          <Segmented
            ariaLabel="Alineación vertical del texto"
            value={style("valign") || "middle"}
            onChange={(v) => onPatchStyle({ valign: v }, "valign")}
            options={[
              { key: "top", label: "Arriba", short: "↑" },
              { key: "middle", label: "Centro", short: "↕" },
              { key: "bottom", label: "Abajo", short: "↓" },
            ]}
          />
        </Row>
        <Row label="Icono">
          <Select value={style("icon") || ""} onChange={(e) => onPatchStyle({ icon: e.target.value }, "icon")} aria-label="Icono" className="max-w-[150px]">
            <option value="">Sin icono</option>
            {NODE_ICONS.map((i) => (
              <option key={i.key} value={i.key}>{i.label}</option>
            ))}
          </Select>
        </Row>
      </Section>

      <Section title="Posición y tamaño" defaultOpen={Boolean(one)}>
        {one && (
          <>
            <Row label="Posición">
              <Input type="number" value={Math.round(one.position.x)} onChange={(e) => onMove({ x: Number(e.target.value) })} className="w-[70px]" aria-label="X" />
              <Input type="number" value={Math.round(one.position.y)} onChange={(e) => onMove({ y: Number(e.target.value) })} className="w-[70px]" aria-label="Y" />
            </Row>
            <Row label="Tamaño">
              <Input type="number" min={30} value={Math.round(one.width || one.measured?.width || 0)} onChange={(e) => onResize({ width: Number(e.target.value) })} className="w-[70px]" aria-label="Ancho" />
              <Input type="number" min={24} value={Math.round(one.height || one.measured?.height || 0)} onChange={(e) => onResize({ height: Number(e.target.value) })} className="w-[70px]" aria-label="Alto" />
            </Row>
          </>
        )}
        <Row label="Capa">
          <IconButton title="Traer al frente" onClick={() => onZOrder("front")}><FiArrowUp /></IconButton>
          <IconButton title="Enviar atrás" onClick={() => onZOrder("back")}><FiArrowDown /></IconButton>
        </Row>
        {many && (
          <>
            <Row label="Alinear">
              <Segmented
                ariaLabel="Alinear elementos"
                value=""
                onChange={onAlign}
                options={[
                  { key: "left", label: "Izquierda", short: "⇤" },
                  { key: "center", label: "Centro horizontal", short: "↔" },
                  { key: "right", label: "Derecha", short: "⇥" },
                  { key: "top", label: "Arriba", short: "⤒" },
                  { key: "middle", label: "Centro vertical", short: "↕" },
                  { key: "bottom", label: "Abajo", short: "⤓" },
                ]}
              />
            </Row>
            <Row label="Distribuir">
              <Segmented
                ariaLabel="Distribuir elementos"
                value=""
                onChange={onDistribute}
                options={[
                  { key: "horizontal", label: "Horizontal (3+)", short: "H" },
                  { key: "vertical", label: "Vertical (3+)", short: "V" },
                ]}
              />
            </Row>
          </>
        )}
      </Section>
    </>
  );
};

/* ---------------- Conexión(es) ---------------- */

const EdgeProperties = ({ edges, onPatch, onReverse, onDelete }) => {
  const one = edges.length === 1 ? edges[0] : null;
  const val = (key) => common(edges, (e) => e.data?.[key]);
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {one ? "Conexión" : `${edges.length} conexiones`}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {one ? one.data?.label || "Sin etiqueta" : "Los cambios aplican a todas"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton title="Invertir dirección" onClick={onReverse}><FiRepeat /></IconButton>
          <IconButton title="Eliminar (Supr)" onClick={onDelete} danger><FiTrash2 /></IconButton>
        </div>
      </div>
      <Section title="Etiqueta">
        <Input
          value={val("label") || ""}
          onChange={(e) => onPatch({ label: e.target.value }, "edge-label")}
          placeholder="Ej. Sí / No"
          aria-label="Etiqueta de la conexión"
          className="w-full"
        />
        <Row label="Tamaño">
          <Slider value={Number(val("fontSize") || 12)} min={9} max={24} onChange={(v) => onPatch({ fontSize: v }, "edge-fontSize")} suffix="px" />
        </Row>
        <Row label="Texto">
          <ColorInput label="Color del texto" value={val("labelColor") || "#334155"} onChange={(v) => onPatch({ labelColor: v }, "edge-labelColor")} />
        </Row>
        <Row label="Fondo">
          <ColorInput label="Fondo de la etiqueta" value={val("labelBg") || "#ffffff"} onChange={(v) => onPatch({ labelBg: v }, "edge-labelBg")} allowTransparent />
        </Row>
      </Section>
      <Section title="Línea">
        <Row label="Tipo">
          <Select value={val("kind") || "smoothstep"} onChange={(e) => onPatch({ kind: e.target.value }, "edge-kind")} aria-label="Tipo de línea">
            {EDGE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </Select>
        </Row>
        <Row label="Color">
          <ColorInput label="Color de la línea" value={val("color") || "#64748b"} onChange={(v) => onPatch({ color: v }, "edge-color")} />
        </Row>
        <Row label="Grosor">
          <Slider value={Number(val("width") || 2)} min={1} max={8} step={0.5} onChange={(v) => onPatch({ width: v }, "edge-width")} suffix="px" />
        </Row>
        <Row label="Trazo">
          <Select value={val("dash") || "solid"} onChange={(e) => onPatch({ dash: e.target.value }, "edge-dash")} aria-label="Trazo">
            {DASH_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
        </Row>
        <Row label="Animada">
          <Toggle label="Animada" checked={Boolean(val("animated"))} onChange={(v) => onPatch({ animated: v }, "edge-animated")} />
        </Row>
      </Section>
      <Section title="Puntas">
        <Row label="Inicio">
          <Select value={val("markerStart") || "none"} onChange={(e) => onPatch({ markerStart: e.target.value }, "edge-ms")} aria-label="Punta inicial">
            {MARKERS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </Row>
        <Row label="Fin">
          <Select value={val("markerEnd") || "arrowclosed"} onChange={(e) => onPatch({ markerEnd: e.target.value }, "edge-me")} aria-label="Punta final">
            {MARKERS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </Row>
      </Section>
    </>
  );
};

/* ---------------- Diagrama ---------------- */

const DiagramProperties = ({ meta, settings, tasks, onMeta, onSettings, onApplyTheme, stats }) => (
  <>
    <div className="border-b border-slate-100 px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-800">Diagrama</p>
      <p className="text-[11px] text-slate-400">
        {stats.nodes} nodos · {stats.edges} conexiones
      </p>
    </div>
    <Section title="Información">
      <Input
        value={meta.name}
        onChange={(e) => onMeta({ name: e.target.value })}
        placeholder="Nombre del diagrama"
        aria-label="Nombre del diagrama"
        className="w-full font-semibold"
      />
      <textarea
        value={meta.description || ""}
        onChange={(e) => onMeta({ description: e.target.value })}
        rows={2}
        placeholder="Descripción u objetivo del flujo"
        aria-label="Descripción del diagrama"
        className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
      />
      <Row label="Vinculado a" hint="Deja «Proyecto» para que sea general del proyecto">
        <Select
          value={meta.task_id ?? ""}
          onChange={(e) => onMeta({ task_id: e.target.value || null })}
          aria-label="Vincular a tarea"
          className="max-w-[150px]"
        >
          <option value="">Proyecto (general)</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.id} · {t.title}
            </option>
          ))}
        </Select>
      </Row>
    </Section>
    <Section title="Lienzo">
      <Row label="Fondo">
        <Select value={settings.background} onChange={(e) => onSettings({ background: e.target.value })} aria-label="Fondo del lienzo">
          {BACKGROUNDS.map((b) => (
            <option key={b.key} value={b.key}>{b.label}</option>
          ))}
        </Select>
      </Row>
      <Row label="Color">
        <ColorInput label="Color del lienzo" value={settings.canvasColor} onChange={(v) => onSettings({ canvasColor: v })} />
      </Row>
      <Row label="Cuadrícula">
        <Slider value={Number(settings.gridSize)} min={8} max={60} step={2} onChange={(v) => onSettings({ gridSize: v })} suffix="px" />
      </Row>
      <Row label="Imán">
        <Toggle label="Ajustar a la cuadrícula" checked={Boolean(settings.snap)} onChange={(v) => onSettings({ snap: v })} />
      </Row>
      <Row label="Minimapa">
        <Toggle label="Minimapa" checked={Boolean(settings.minimap)} onChange={(v) => onSettings({ minimap: v })} />
      </Row>
      <Row label="Controles">
        <Toggle label="Controles de zoom" checked={Boolean(settings.controls)} onChange={(v) => onSettings({ controls: v })} />
      </Row>
    </Section>
    <Section title="Conexiones nuevas">
      <Row label="Tipo">
        <Select value={settings.edgeKind} onChange={(e) => onSettings({ edgeKind: e.target.value })} aria-label="Tipo de conexión por defecto">
          {EDGE_KINDS.map((k) => (
            <option key={k.key} value={k.key}>{k.label}</option>
          ))}
        </Select>
      </Row>
      <Row label="Animadas">
        <Toggle label="Conexiones animadas" checked={Boolean(settings.animatedEdges)} onChange={(v) => onSettings({ animatedEdges: v })} />
      </Row>
      <Row label="Dirección" hint="Se usa en el auto-acomodo">
        <Select value={settings.direction} onChange={(e) => onSettings({ direction: e.target.value })} aria-label="Dirección del flujo">
          {DIRECTIONS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </Select>
      </Row>
    </Section>
    <Section title="Tema de colores">
      <div className="grid grid-cols-2 gap-1.5">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onApplyTheme(t.key)}
            className={cx(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition hover:border-brand-300",
              settings.theme === t.key ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600",
            )}
          >
            <span className="h-4 w-4 rounded-full border" style={{ background: t.canvas, borderColor: t.edge }} />
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-4 text-slate-400">Recolorea todos los nodos y el lienzo. Se puede deshacer.</p>
    </Section>
  </>
);

/* ---------------- Panel ---------------- */

const PropertiesPanel = ({ selectedNodes, selectedEdges, ...rest }) => (
  <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
    {selectedNodes.length ? (
      <NodeProperties nodes={selectedNodes} {...rest.node} />
    ) : selectedEdges.length ? (
      <EdgeProperties edges={selectedEdges} {...rest.edge} />
    ) : (
      <DiagramProperties {...rest.diagram} />
    )}
  </aside>
);

export default PropertiesPanel;
