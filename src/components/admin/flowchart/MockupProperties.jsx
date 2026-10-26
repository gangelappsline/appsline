/* eslint-disable react/prop-types */
import { useRef } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiArrowDown,
  FiArrowUp,
  FiBold,
  FiCopy,
  FiImage,
  FiItalic,
  FiLink,
  FiMessageSquare,
  FiPlay,
  FiPlus,
  FiTrash2,
  FiUpload,
  FiVideo,
} from "react-icons/fi";
import {
  DEVICES,
  SCREEN_BACKGROUNDS,
  WIDGETS,
  WIDGET_COLORS,
  deviceMeta,
  screenSize,
  widgetMeta,
} from "../../../utils/mockups";
import { DIAGRAM_IMAGE_ACCEPT } from "../../../utils/diagramMedia";
import { cx } from "../../../utils/format";
import { ColorInput, IconButton, Input, Row, Section, Segmented, Slider, Toggle } from "./panelControls";
import IconPicker from "./IconPicker";

/**
 * Panel de propiedades de los mockups: una pantalla completa o el elemento
 * activo dentro de ella. Todos los controles escriben en `node.data`, así que
 * lo que se ve es exactamente lo que se guarda en la API.
 */

const WidgetSection = ({ widget, onPatch, onDelete, onDuplicate, onOrder, onReplaceImage, uploading, onConnectHint }) => {
  const imageRef = useRef(null);
  const meta = widgetMeta(widget.type);
  const style = widget.style || {};
  const props = widget.props || {};
  const supportsText = !["image", "divider", "slider", "progress", "gallery", "keyboard", "map", "video", "icon", "icon-button", "fab", "avatar", "rating"].includes(widget.type);
  const patchStyle = (change, key) => onPatch({ style: change }, key);
  const patchProps = (change, key) => onPatch({ props: change }, key);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{meta.label}</p>
          <p className="truncate text-[11px] text-slate-400">Elemento de la pantalla</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton title="Duplicar elemento" onClick={onDuplicate}><FiCopy /></IconButton>
          <IconButton title="Eliminar elemento (Supr)" onClick={onDelete} danger><FiTrash2 /></IconButton>
        </div>
      </div>

      {supportsText && (
        <Section title="Contenido">
          <textarea
            value={widget.text || ""}
            onChange={(event) => onPatch({ text: event.target.value }, "widget-text")}
            rows={2}
            placeholder={meta.hint}
            aria-label="Texto del elemento"
            className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
          />
          <p className="text-[10px] leading-4 text-slate-400">Usa saltos de línea para listas, tarjetas y tablas (columnas con «|»).</p>
        </Section>
      )}

      {["input", "textarea", "search", "select"].includes(widget.type) && (
        <Section title="Campo">
          <Input
            value={props.placeholder || ""}
            onChange={(event) => patchProps({ placeholder: event.target.value }, "widget-placeholder")}
            placeholder="Texto de ayuda (placeholder)"
            aria-label="Placeholder"
            className="w-full"
          />
          <Input
            value={typeof props.value === "string" ? props.value : ""}
            onChange={(event) => patchProps({ value: event.target.value }, "widget-value")}
            placeholder="Valor escrito por el usuario"
            aria-label="Valor del campo"
            className="w-full"
          />
        </Section>
      )}

      {["checkbox", "radio", "toggle"].includes(widget.type) && (
        <Section title="Estado">
          <Row label="Activado">
            <Toggle label="Activado" checked={Boolean(props.checked)} onChange={(value) => patchProps({ checked: value }, "widget-checked")} />
          </Row>
        </Section>
      )}

      {widget.type === "slider" && (
        <Section title="Valor">
          <Row label="Porcentaje">
            <Slider value={Number(props.value ?? 50)} min={0} max={100} onChange={(value) => patchProps({ value }, "widget-slider")} suffix="%" />
          </Row>
        </Section>
      )}

      {["progress"].includes(widget.type) && (
        <Section title="Avance">
          <Row label="Porcentaje">
            <Slider value={Number(props.value ?? 60)} min={0} max={100} onChange={(value) => patchProps({ value }, "widget-progress")} suffix="%" />
          </Row>
        </Section>
      )}

      {widget.type === "rating" && (
        <Section title="Valoración">
          <Row label="Estrellas">
            <Slider value={Number(props.value ?? 4)} min={0} max={5} onChange={(value) => patchProps({ value }, "widget-rating")} />
          </Row>
        </Section>
      )}

      {widget.type === "chart" && (
        <Section title="Datos">
          <Input
            value={(props.values || [40, 65, 52, 78, 61]).join(", ")}
            onChange={(event) =>
              patchProps(
                {
                  values: event.target.value
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter((value) => Number.isFinite(value)),
                },
                "widget-values",
              )
            }
            aria-label="Valores de la gráfica"
            className="w-full font-mono"
          />
          <p className="text-[10px] leading-4 text-slate-400">Valores separados por comas (0 a 100).</p>
        </Section>
      )}

      {widget.type === "gallery" && (
        <Section title="Cuadrícula">
          <Row label="Columnas">
            <Slider value={Number(props.columns ?? 3)} min={1} max={6} onChange={(value) => patchProps({ columns: value }, "widget-columns")} />
          </Row>
        </Section>
      )}

      {["image", "avatar", "icon", "icon-button", "fab", "button", "button-secondary"].includes(widget.type) && (
        <Section title="Imagen e icono">
          {["image", "avatar"].includes(widget.type) && (
            <>
              {props.image?.src && (
                <img src={props.image.src} alt={props.image.alt || ""} className="h-24 w-full rounded-lg border border-slate-100 bg-slate-50 object-contain" />
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => imageRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <FiUpload /> {uploading ? "Procesando…" : props.image ? "Reemplazar imagen" : "Agregar imagen"}
              </button>
              <input
                ref={imageRef}
                type="file"
                accept={DIAGRAM_IMAGE_ACCEPT}
                aria-label="Imagen del elemento"
                hidden
                onChange={(event) => {
                  onReplaceImage?.(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {props.image && (
                <Row label="Ajuste">
                  <Input value={props.image.alt || ""} onChange={(event) => patchProps({ image: { ...props.image, alt: event.target.value } }, "widget-image-alt")} placeholder="Texto alternativo" aria-label="Texto alternativo" />
                </Row>
              )}
              <Row label="Recorte">
                <Segmented
                  ariaLabel="Ajuste de la imagen"
                  value={style.imageFit || "cover"}
                  onChange={(value) => patchStyle({ imageFit: value }, "widget-image-fit")}
                  options={[
                    { key: "cover", label: "Rellenar", short: "▣" },
                    { key: "contain", label: "Completa", short: "▢" },
                  ]}
                />
              </Row>
            </>
          )}
          <div className="pt-1">
            <p className="mb-1 text-[11px] font-semibold text-slate-500">Icono</p>
            <IconPicker value={style.icon || ""} allowNone onChange={(key) => patchStyle({ icon: key }, "widget-icon")} />
          </div>
          {style.icon && (
            <Row label="Tamaño del icono">
              <Slider value={Number(style.iconSize || 20)} min={8} max={120} onChange={(value) => patchStyle({ iconSize: value }, "widget-icon-size")} suffix="px" />
            </Row>
          )}
        </Section>
      )}

      <Section title="Color">
        <div className="flex flex-wrap gap-1.5">
          {WIDGET_COLORS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={preset.label}
              aria-label={`Color ${preset.label}`}
              onClick={() => patchStyle({ fill: preset.fill, textColor: preset.textColor, borderColor: preset.borderColor }, `widget-preset-${preset.key}`)}
              className="h-6 w-6 rounded-full border-2 transition hover:scale-110"
              style={{ background: preset.fill === "transparent" ? "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 8px 8px" : preset.fill, borderColor: preset.borderColor === "transparent" ? "#cbd5e1" : preset.borderColor }}
            />
          ))}
        </div>
        <Row label="Relleno">
          <ColorInput label="Relleno del elemento" value={style.fill} onChange={(value) => patchStyle({ fill: value }, "widget-fill")} allowTransparent />
        </Row>
        <Row label="Texto">
          <ColorInput label="Color del texto" value={style.textColor} onChange={(value) => patchStyle({ textColor: value }, "widget-text-color")} />
        </Row>
        <Row label="Borde">
          <ColorInput label="Color del borde" value={style.borderColor} onChange={(value) => patchStyle({ borderColor: value }, "widget-border")} allowTransparent />
        </Row>
        <Row label="Grosor">
          <Slider value={Number(style.borderWidth || 0)} min={0} max={8} onChange={(value) => patchStyle({ borderWidth: value }, "widget-border-width")} suffix="px" />
        </Row>
        <Row label="Esquinas">
          <Slider value={Number(style.radius || 0)} min={0} max={80} onChange={(value) => patchStyle({ radius: value }, "widget-radius")} suffix="px" />
        </Row>
        <Row label="Opacidad">
          <Slider value={Math.round(Number(style.opacity ?? 1) * 100)} min={10} max={100} onChange={(value) => patchStyle({ opacity: value / 100 }, "widget-opacity")} suffix="%" />
        </Row>
        <Row label="Sombra">
          <Toggle label="Sombra" checked={Boolean(style.shadow)} onChange={(value) => patchStyle({ shadow: value }, "widget-shadow")} />
        </Row>
      </Section>

      <Section title="Texto y tipografía" defaultOpen={false}>
        <Row label="Tamaño">
          <Slider value={Number(style.fontSize || 15)} min={6} max={72} onChange={(value) => patchStyle({ fontSize: value }, "widget-font-size")} suffix="px" />
        </Row>
        <Row label="Peso">
          <Slider value={Number(style.fontWeight || 500)} min={100} max={900} step={100} onChange={(value) => patchStyle({ fontWeight: value }, "widget-font-weight")} />
        </Row>
        <Row label="Estilo">
          <IconButton title="Negrita" active={Number(style.fontWeight) >= 700} onClick={() => patchStyle({ fontWeight: Number(style.fontWeight) >= 700 ? 400 : 700 }, "widget-bold")}>
            <FiBold />
          </IconButton>
          <IconButton title="Cursiva" active={style.fontStyle === "italic"} onClick={() => patchStyle({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" }, "widget-italic")}>
            <FiItalic />
          </IconButton>
        </Row>
        <Row label="Alinear">
          <Segmented
            ariaLabel="Alineación horizontal"
            value={style.align || "left"}
            onChange={(value) => patchStyle({ align: value }, "widget-align")}
            options={[
              { key: "left", label: "Izquierda", icon: FiAlignLeft },
              { key: "center", label: "Centro", icon: FiAlignCenter },
              { key: "right", label: "Derecha", icon: FiAlignRight },
            ]}
          />
        </Row>
        <Row label="Vertical">
          <Segmented
            ariaLabel="Alineación vertical"
            value={style.valign || "middle"}
            onChange={(value) => patchStyle({ valign: value }, "widget-valign")}
            options={[
              { key: "top", label: "Arriba", short: "↑" },
              { key: "middle", label: "Centro", short: "↕" },
              { key: "bottom", label: "Abajo", short: "↓" },
            ]}
          />
        </Row>
        <Row label="Relleno interno">
          <Slider value={Number(style.padding || 0)} min={0} max={48} onChange={(value) => patchStyle({ padding: value }, "widget-padding")} suffix="px" />
        </Row>
        <Row label="Interlineado">
          <Slider value={Number(style.lineHeight || 1.35)} min={0.8} max={2.4} step={0.05} onChange={(value) => patchStyle({ lineHeight: value }, "widget-line-height")} />
        </Row>
        <Row label="Rotación">
          <Slider value={Number(style.rotate || 0)} min={-180} max={180} onChange={(value) => patchStyle({ rotate: value }, "widget-rotate")} suffix="°" />
        </Row>
      </Section>

      <Section title="Posición y tamaño" defaultOpen={false}>
        <Row label="Posición">
          <Input type="number" value={Math.round(widget.x)} onChange={(event) => onPatch({ x: Number(event.target.value) }, "widget-x")} className="w-[70px]" aria-label="X del elemento" />
          <Input type="number" value={Math.round(widget.y)} onChange={(event) => onPatch({ y: Number(event.target.value) }, "widget-y")} className="w-[70px]" aria-label="Y del elemento" />
        </Row>
        <Row label="Tamaño">
          <Input type="number" value={Math.round(widget.w)} onChange={(event) => onPatch({ w: Number(event.target.value) }, "widget-w")} className="w-[70px]" aria-label="Ancho del elemento" />
          <Input type="number" value={Math.round(widget.h)} onChange={(event) => onPatch({ h: Number(event.target.value) }, "widget-h")} className="w-[70px]" aria-label="Alto del elemento" />
        </Row>
        <Row label="Capa">
          <IconButton title="Traer al frente" onClick={() => onOrder("front")}><FiArrowUp /></IconButton>
          <IconButton title="Enviar al fondo" onClick={() => onOrder("back")}><FiArrowDown /></IconButton>
        </Row>
      </Section>

      <Section title="Flujo" defaultOpen={false}>
        <p className="text-[11px] leading-4 text-slate-500">
          Arrastra desde el punto azul del elemento hasta otra pantalla para que este botón/campo forme parte del flujo.
          {onConnectHint ? ` ${onConnectHint}` : ""}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-brand-700"><FiLink /> La flecha conserva su etiqueta y estilo.</p>
      </Section>
    </>
  );
};

const ScreenSection = ({ screen, onScreenData, onAddWidget, onPlay, onComment, comments = [] }) => {
  const device = deviceMeta(screen?.data?.device);
  const content = screenSize(device.key);
  const screenComments = comments.filter((comment) => comment.node_id === screen.id);
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">Pantalla</p>
          <p className="truncate text-[11px] text-slate-400">{device.label} · {device.width}×{device.height}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton title="Probar el flujo desde esta pantalla" onClick={onPlay}><FiPlay /></IconButton>
          <IconButton title="Comentarios de la pantalla" onClick={onComment}><FiMessageSquare /></IconButton>
        </div>
      </div>

      <Section title="Pantalla">
        <Input
          value={screen.data?.label || ""}
          onChange={(event) => onScreenData({ label: event.target.value }, "screen-label")}
          placeholder="Nombre de la pantalla"
          aria-label="Nombre de la pantalla"
          className="w-full"
        />
        <Row label="Dispositivo">
          <select
            value={screen.data?.device || device.key}
            onChange={(event) => onScreenData({ device: event.target.value }, "screen-device")}
            aria-label="Dispositivo"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            {DEVICES.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Row>
        <p className="text-[10px] text-slate-400">Área útil: {content.width}×{content.height} px. Al cambiar de dispositivo, el tamaño del marco se ajusta al elegirlo en la paleta.</p>
        <Row label="Barra de estado">
          <Toggle label="Barra de estado" checked={screen.data?.statusBar !== false} onChange={(value) => onScreenData({ statusBar: value }, "screen-status")} />
        </Row>
        <Row label="Pantalla inicial">
          <Toggle label="Pantalla inicial" checked={Boolean(screen.data?.start)} onChange={(value) => onScreenData({ start: value }, "screen-start")} />
        </Row>
        <Row label="Tamaño del marco">
          <Input type="number" value={Math.round(screen.width || device.width)} onChange={(event) => onScreenData({ __width: Number(event.target.value) }, "screen-width")} className="w-[70px]" aria-label="Ancho del marco" />
          <Input type="number" value={Math.round(screen.height || device.height)} onChange={(event) => onScreenData({ __height: Number(event.target.value) }, "screen-height")} className="w-[70px]" aria-label="Alto del marco" />
        </Row>
      </Section>

      <Section title="Fondo">
        <div className="grid grid-cols-4 gap-1.5">
          {SCREEN_BACKGROUNDS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={preset.label}
              aria-label={`Fondo ${preset.label}`}
              onClick={() => onScreenData({ background: preset.value }, "screen-background")}
              className={cx(
                "h-7 rounded-md border transition hover:scale-105",
                screen.data?.background === preset.value ? "border-brand-500 ring-2 ring-brand-500/30" : "border-slate-200",
              )}
              style={{ background: preset.value }}
            />
          ))}
        </div>
        <ColorInput label="Color de fondo" value={screen.data?.background} onChange={(value) => onScreenData({ background: value }, "screen-background-color")} />
        <p className="text-[10px] leading-4 text-slate-400">También se puede escribir un degradado CSS (linear-gradient).</p>
      </Section>

      <Section title="Elementos" action={<span className="text-[10px] text-slate-400">{(screen.data?.widgets || []).length}</span>}>
        <div className="grid grid-cols-2 gap-1.5">
          {WIDGETS.filter((widget) => ["heading", "text", "button", "input", "image", "card", "icon", "list"].includes(widget.key)).map((widget) => (
            <button
              key={widget.key}
              type="button"
              onClick={() => onAddWidget(widget.key)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <FiPlus className="shrink-0 text-slate-400" /> {widget.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-4 text-slate-400">Todos los elementos del catálogo están en la paleta «Elementos».</p>
      </Section>

      <Section title="Revisión" action={<span className="text-[10px] text-slate-400">{screenComments.length}</span>}>
        {!screenComments.length && <p className="text-[11px] leading-4 text-slate-500">Sin comentarios en esta pantalla.</p>}
        {screenComments.slice(0, 4).map((comment) => (
          <div key={comment.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold text-slate-500">{comment.author?.name || "Equipo"}{comment.resolved ? " · resuelto" : ""}</p>
            <p className="line-clamp-3 text-[11px] leading-4 text-slate-700">{comment.text}</p>
          </div>
        ))}
        <button type="button" onClick={onComment} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
          <FiMessageSquare /> Abrir revisión del equipo
        </button>
      </Section>

      <Section title="Imagen de fondo" defaultOpen={false}>
        <p className="text-[11px] leading-4 text-slate-500">Usa un elemento «Imagen» dentro de la pantalla para fotos y capturas; así se puede conectar con otras pantallas.</p>
        <p className="flex items-center gap-1 text-[10px] text-slate-400"><FiImage /> PNG, JPG o WebP hasta 5 MB por imagen.</p>
        <p className="flex items-center gap-1 text-[10px] text-slate-400"><FiVideo /> Los mockups se exportan como PNG/SVG con todo el contenido.</p>
      </Section>
    </>
  );
};

const MockupProperties = ({
  screen,
  widget,
  comments = [],
  onScreenData,
  onPatchWidget,
  onDeleteWidget,
  onDuplicateWidget,
  onOrderWidget,
  onReplaceWidgetImage,
  onAddWidget,
  onPlay,
  onComment,
  uploading,
}) => {
  if (widget) {
    return (
      <WidgetSection
        widget={widget}
        onPatch={onPatchWidget}
        onDelete={onDeleteWidget}
        onDuplicate={onDuplicateWidget}
        onOrder={onOrderWidget}
        onReplaceImage={onReplaceWidgetImage}
        uploading={uploading}
      />
    );
  }
  if (!screen) {
    return <p className="px-3 py-6 text-center text-xs text-slate-400">Selecciona una pantalla o un elemento para editarlo.</p>;
  }
  return (
    <ScreenSection
      screen={screen}
      comments={comments}
      onScreenData={onScreenData}
      onAddWidget={onAddWidget}
      onPlay={onPlay}
      onComment={onComment}
    />
  );
};

export { WidgetSection, ScreenSection };
export default MockupProperties;
