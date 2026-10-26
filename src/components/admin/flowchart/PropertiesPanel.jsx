/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiArrowDown,
  FiArrowUp,
  FiBold,
  FiCopy,
  FiItalic,
  FiLock,
  FiRepeat,
  FiTrash2,
  FiUnlock,
  FiUpload,
  FiX,
  FiZap,
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
import IconPicker from "./IconPicker";
import MockupProperties from "./MockupProperties";
import { ColorInput, IconButton, Input, Row, Section, Segmented, Select, Slider, Toggle } from "./panelControls";
import { DIAGRAM_IMAGE_ACCEPT } from "../../../utils/diagramMedia";
import { ShapeGlyph } from "./ShapePalette";

/* ---------------- Controles básicos ---------------- */

/** Valor común entre varios elementos (o "" si difieren). */
const common = (items, pick) => {
  if (!items.length) return "";
  const first = pick(items[0]);
  return items.every((item) => pick(item) === first) ? first : "";
};

const ImageProperties = ({ node, onPatchData, onReplaceImage, uploading }) => {
  const inputRef = useRef(null);
  const image = node.data.image;
  const patch = (change) => onPatchData({ image: { ...image, ...change } }, "image");
  return (
    <Section title="Imagen propia">
      {image && <img src={image.src} alt={image.alt || image.name} className="h-24 w-full rounded-lg border border-slate-100 bg-slate-50 object-contain" />}
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
        <FiUpload /> {uploading ? "Procesando…" : image ? "Reemplazar imagen" : "Agregar imagen"}
      </button>
      <input ref={inputRef} type="file" accept={DIAGRAM_IMAGE_ACCEPT} aria-label="Reemplazar imagen" hidden onChange={(event) => { onReplaceImage(event.target.files?.[0]); event.target.value = ""; }} />
      {image && <>
        <p className="truncate text-[11px] text-slate-400" title={image.name}>{image.name}</p>
        <Input value={image.alt} onChange={(event) => patch({ alt: event.target.value })} aria-label="Texto alternativo de la imagen" placeholder="Describe la imagen" className="w-full" />
        <Row label="Ajuste">
          <Select value={image.fit} onChange={(event) => patch({ fit: event.target.value })} aria-label="Ajuste de la imagen">
            <option value="contain">Mostrar completa</option>
            <option value="cover">Rellenar y recortar</option>
          </Select>
        </Row>
        <Row label="Mantener proporción"><Toggle label="Mantener proporción" checked={image.lockAspectRatio !== false} onChange={(value) => patch({ lockAspectRatio: value })} /></Row>
      </>}
      <p className="text-[11px] text-slate-400">PNG, JPG o WebP · hasta 5 MB. Se guarda dentro del diagrama.</p>
    </Section>
  );
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
  onReplaceImage,
  uploading,
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

      <Section title="Posición y tamaño" defaultOpen={Boolean(one)}>
        {one && (
          <>
            <Row label="Posición">
              <Input type="number" disabled={locked} value={Math.round(one.position.x)} onChange={(e) => onMove({ x: Number(e.target.value) })} className="w-[70px]" aria-label="X" />
              <Input type="number" disabled={locked} value={Math.round(one.position.y)} onChange={(e) => onMove({ y: Number(e.target.value) })} className="w-[70px]" aria-label="Y" />
            </Row>
            <Row label="Tamaño">
              <Input type="number" disabled={locked} min={44} value={Math.round(one.width || one.measured?.width || 0)} onChange={(e) => onResize({ width: Number(e.target.value) })} className="w-[70px]" aria-label="Ancho" />
              <Input type="number" disabled={locked} min={28} value={Math.round(one.height || one.measured?.height || 0)} onChange={(e) => onResize({ height: Number(e.target.value) })} className="w-[70px]" aria-label="Alto" />
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

      {one?.data.shape === "image" && <ImageProperties node={one} onPatchData={onPatchData} onReplaceImage={onReplaceImage} uploading={uploading} />}

      {!["image", "icon"].includes(shape) && <Section title="Forma" defaultOpen={false}>
        <div className="grid grid-cols-5 gap-1">
          {SHAPES.filter((s) => !["media", "screens"].includes(s.group)).map((s) => (
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
      </Section>}

      <Section title="Color y apariencia">
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
      </Section>

      {shape !== "image" && <Section title="Icono" defaultOpen={shape === "icon" || Boolean(style("icon"))}>
        <IconPicker value={style("icon") || ""} allowNone={shape !== "icon"} onChange={(key) => onPatchStyle({ icon: key }, "icon")} />
        {style("icon") && <Row label="Tamaño">
          <Slider label="Tamaño del icono" value={Number(style("iconSize") || (shape === "icon" ? 40 : 18))} min={12} max={96} onChange={(value) => onPatchStyle({ iconSize: value }, "icon-size")} suffix="px" />
        </Row>}
      </Section>}


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

const DiagramProperties = ({ meta, settings, tasks, onMeta, onSettings, onApplyTheme, onLayout, stats }) => (
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
    <Section title="Organización del flujo">
      <Row label="Dirección">
        <Select value={settings.direction} onChange={(e) => onSettings({ direction: e.target.value })} aria-label="Dirección del flujo">
          {DIRECTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </Select>
      </Row>
      <Row label="Entre nodos">
        <Slider label="Separación entre nodos" value={Number(settings.nodeSpacing || 80)} min={24} max={200} step={4} onChange={(value) => onSettings({ nodeSpacing: value })} suffix="px" />
      </Row>
      <Row label="Entre niveles">
        <Slider label="Separación entre niveles" value={Number(settings.rankSpacing || 100)} min={40} max={240} step={4} onChange={(value) => onSettings({ rankSpacing: value })} suffix="px" />
      </Row>
      <button type="button" onClick={onLayout} disabled={stats.nodes < 2} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40">
        <FiZap /> Organizar nodos y flechas
      </button>
      <p className="text-[11px] leading-4 text-slate-400">Distribuye por niveles y reorienta las conexiones. Respeta los bloqueos; puedes deshacerlo.</p>
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

export { ColorInput, IconButton, Input, Row, Section, Segmented, Select, Slider, Toggle };

/* ---------------- Panel ---------------- */

const PropertiesPanel = ({ selectedNodes, selectedEdges, onClose, ...rest }) => {
  const [tab, setTab] = useState("selection");
  const mockup = rest.mockup || null;
  const screenSelected =
    selectedNodes.length === 1 &&
    (selectedNodes[0].type === "screen" || selectedNodes[0].data?.shape === "screen");
  const showMockup = Boolean(mockup && (mockup.widget || screenSelected));
  const selectionKey = selectedNodes.map((node) => node.id).join(",") || selectedEdges.map((edge) => edge.id).join(",");
  useEffect(() => { if (selectionKey) setTab("selection"); }, [selectionKey]);
  const showingSelection = tab === "selection" && Boolean(selectionKey);
  return (
    <aside aria-label="Propiedades del diagrama" className="flow-properties absolute inset-y-0 right-0 z-20 flex w-80 max-w-[90vw] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl lg:relative lg:shadow-none">
      <div className="flex items-center gap-1 border-b border-slate-100 p-2">
        <div role="tablist" aria-label="Propiedades" className="flex flex-1 gap-1">
          <button type="button" role="tab" aria-selected={showingSelection} disabled={!selectionKey} onClick={() => setTab("selection")} className={cx("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40", showingSelection ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100")}>Selección</button>
          <button type="button" role="tab" aria-selected={!showingSelection} onClick={() => setTab("canvas")} className={cx("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold", !showingSelection ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100")}>Lienzo</button>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar propiedades" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><FiX /></button>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {showingSelection ? (
          showMockup ? (
            <MockupProperties {...mockup} />
          ) : selectedNodes.length ? (
            <NodeProperties nodes={selectedNodes} {...rest.node} />
          ) : (
            <EdgeProperties edges={selectedEdges} {...rest.edge} />
          )
        ) : <DiagramProperties {...rest.diagram} />}
      </div>
    </aside>
  );
};

export default PropertiesPanel;
