/* eslint-disable react/prop-types */
import { FiChevronDown, FiImage, FiPlay, FiStar, FiWifi } from "react-icons/fi";
import { nodeIcon } from "./icons";
import { BASE_STYLE, widgetMeta } from "../../../utils/mockups";

/**
 * Dibujo de los elementos de una pantalla (sin React Flow, sin edición).
 *
 * Se usa en el lienzo (`MockupNode`), en el reproductor de prototipos y en las
 * previsualizaciones. Todo el aspecto sale de `widget.style`, así que un
 * elemento guardado en la API se ve igual en cualquier equipo.
 */

const surface = (style) => ({
  background: style.fill,
  border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : "none",
  borderRadius: style.radius,
  boxShadow: style.shadow ? "0 14px 30px rgba(15,23,42,.18)" : "none",
  opacity: style.opacity,
  boxSizing: "border-box",
});

const textStyle = (style) => ({
  color: style.textColor,
  fontSize: `${style.fontSize}px`,
  fontWeight: style.fontWeight,
  fontStyle: style.fontStyle,
  lineHeight: style.lineHeight,
  letterSpacing: `${style.letterSpacing}px`,
  textDecoration: style.underline ? "underline" : "none",
  textAlign: style.align,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  margin: 0,
});

const flexAlign = (align) =>
  align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

const flexVAlign = (valign) =>
  valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center";

/** Caja con alineación y relleno comunes a casi todos los elementos. */
const Box = ({ style, children, extra = {} }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: flexVAlign(style.valign),
      alignItems: flexAlign(style.align),
      padding: style.padding,
      gap: 4,
      ...surface(style),
      ...extra,
    }}
  >
    {children}
  </div>
);

const Placeholder = ({ icon: Icon = FiImage, label, style }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      color: style.textColor,
      fontSize: Math.max(10, style.fontSize - 2),
      fontWeight: 500,
    }}
  >
    <Icon style={{ fontSize: 24, opacity: 0.5 }} />
    {label && <span style={{ opacity: 0.6 }}>{label}</span>}
  </div>
);

const Stars = ({ count, style }) => (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[1, 2, 3, 4, 5].map((index) => (
      <FiStar
        key={index}
        style={{
          fontSize: style.fontSize + 6,
          color: index <= count ? "#f59e0b" : "#cbd5e1",
          fill: index <= count ? "#f59e0b" : "transparent",
        }}
      />
    ))}
  </div>
);

const DeviceStatusBar = ({ device, tone = "#0f172a" }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: device.safeArea?.top || 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: device.notch === "classic" ? "12px 22px 0" : "14px 24px 0",
      fontSize: 13,
      fontWeight: 600,
      color: tone,
      pointerEvents: "none",
      zIndex: 6,
    }}
  >
    <span>{device.platform === "android" ? "9:41" : "9:41"}</span>
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10, letterSpacing: 1 }}>▮▮▮</span>
      <FiWifi style={{ fontSize: 12 }} />
      <span style={{ fontSize: 9, border: `1px solid ${tone}`, borderRadius: 3, padding: "1px 3px" }}>100%</span>
    </span>
  </div>
);

/** Cromo del dispositivo: isla, indicador de inicio y barra de navegación. */
const DeviceChrome = ({ device, statusBar }) => {
  return (
    <>
      {device.notch === "island" && (
        <div
          style={{
            position: "absolute",
            top: 11,
            left: "50%",
            transform: "translateX(-50%)",
            width: "31%",
            height: 26,
            borderRadius: 999,
            background: "#0b1220",
            zIndex: 8,
            pointerEvents: "none",
          }}
        />
      )}
      {device.notch === "punch" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 13,
            height: 13,
            borderRadius: 999,
            background: "#0b1220",
            zIndex: 8,
            pointerEvents: "none",
          }}
        />
      )}
      {device.notch === "classic" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 24,
            background: "#0b1220",
            zIndex: 8,
            pointerEvents: "none",
          }}
        />
      )}
      {device.homeIndicator && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: "34%",
            height: 5,
            borderRadius: 999,
            background: "rgba(15,23,42,.45)",
            zIndex: 8,
            pointerEvents: "none",
          }}
        />
      )}
      {device.navBar && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 26,
            zIndex: 8,
            pointerEvents: "none",
          }}
        >
          {["◁", "○", "□"].map((glyph) => (
            <span key={glyph} style={{ fontSize: 11, color: "rgba(15,23,42,.5)" }}>{glyph}</span>
          ))}
        </div>
      )}
      {statusBar && <DeviceStatusBar device={device} />}
    </>
  );
};

/** Barra de navegador de los marcos web. */
const BrowserBar = ({ text = "app.appsline.com.mx", height = 44 }) => (
  <div
    style={{
      height,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 14px",
      background: "#f1f5f9",
      borderBottom: "1px solid #e2e8f0",
    }}
  >
    {["#f87171", "#fbbf24", "#34d399"].map((dot) => (
      <span key={dot} style={{ width: 9, height: 9, borderRadius: 999, background: dot }} />
    ))}
    <div
      style={{
        flex: 1,
        height: 24,
        borderRadius: 999,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: "#64748b",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  </div>
);

/** Cuerpo del elemento: un `switch` por tipo del catálogo. */
export const WidgetBody = ({ widget }) => {
  // Siempre con estilo y props: un elemento antiguo o de otra integración puede
  // llegar sin ellos y no debe romper la pantalla.
  const meta = widgetMeta(widget?.type);
  const style = { ...BASE_STYLE, ...(meta.style || {}), ...(widget?.style || {}) };
  const props = widget?.props || {};
  const Icon = nodeIcon(style.icon);
  const text = widget?.text || "";
  const image = props.image;

  switch (widget.type) {
    case "heading":
    case "text":
    case "link":
      return <Box style={style}><p style={textStyle(style)}>{text}</p></Box>;

    case "badge":
      return (
        <Box style={style}>
          <p style={{ ...textStyle(style), fontSize: style.fontSize }}>{text}</p>
        </Box>
      );

    case "rating":
      return (
        <Box style={{ ...style, padding: Math.min(style.padding, 4) }}>
          <Stars count={Number(props.value ?? 4)} style={style} />
        </Box>
      );

    case "button":
    case "button-secondary":
      return (
        <Box style={style}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            {Icon && <Icon style={{ fontSize: style.iconSize, flexShrink: 0 }} />}
            {text && <span style={{ ...textStyle(style), textAlign: "center" }}>{text}</span>}
          </span>
        </Box>
      );

    case "icon-button":
    case "fab":
    case "icon":
      return (
        <Box style={style}>
          {image ? (
            <img src={image.src} alt={image.alt || ""} style={{ width: "100%", height: "100%", objectFit: style.imageFit }} draggable={false} />
          ) : Icon ? (
            <Icon style={{ fontSize: style.iconSize, color: style.textColor }} />
          ) : (
            <Placeholder icon={FiImage} style={style} />
          )}
        </Box>
      );

    case "input":
    case "textarea":
      return (
        <Box style={{ ...style, alignItems: "stretch", justifyContent: widget.type === "textarea" ? "flex-start" : "center" }}>
          <span
            style={{
              ...textStyle({ ...style, align: "left" }),
              color: props.value ? "#0f172a" : style.textColor,
              opacity: props.value ? 1 : 0.85,
            }}
          >
            {props.value || text || props.placeholder || "Escribe aquí…"}
          </span>
        </Box>
      );

    case "search":
      return (
        <Box style={{ ...style, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 }}>
          {Icon && <Icon style={{ fontSize: style.iconSize, flexShrink: 0, color: style.textColor }} />}
          <span style={{ ...textStyle({ ...style, align: "left" }), opacity: 0.85 }}>
            {props.value || text || props.placeholder || "Buscar"}
          </span>
        </Box>
      );

    case "select":
      return (
        <Box style={{ ...style, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ ...textStyle({ ...style, align: "left" }), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {text || props.placeholder || "Selecciona…"}
          </span>
          <FiChevronDown style={{ fontSize: style.fontSize + 4, flexShrink: 0, color: style.textColor }} />
        </Box>
      );

    case "checkbox":
    case "radio":
      return (
        <Box style={{ ...style, flexDirection: "row", alignItems: "center", justifyContent: flexAlign(style.align), gap: 8, padding: Math.min(style.padding, 4) }}>
          <span
            style={{
              width: 18,
              height: 18,
              flexShrink: 0,
              borderRadius: widget.type === "radio" ? 999 : 5,
              border: `1.5px solid ${props.checked ? "#0060fc" : "#94a3b8"}`,
              background: props.checked ? "#0060fc" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            {props.checked ? (widget.type === "radio" ? "•" : "✓") : ""}
          </span>
          <span style={textStyle({ ...style, align: "left" })}>{text}</span>
        </Box>
      );

    case "toggle":
      return (
        <Box style={{ ...style, flexDirection: "row", alignItems: "center", justifyContent: flexAlign(style.align), gap: 10, padding: Math.min(style.padding, 4) }}>
          <span
            style={{
              width: 40,
              height: 23,
              flexShrink: 0,
              borderRadius: 999,
              background: props.checked ? "#16a34a" : "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: props.checked ? "flex-end" : "flex-start",
              padding: 2,
              boxSizing: "border-box",
            }}
          >
            <span style={{ width: 19, height: 19, borderRadius: 999, background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
          </span>
          <span style={textStyle({ ...style, align: "left" })}>{text}</span>
        </Box>
      );

    case "slider": {
      const value = Math.max(0, Math.min(100, Number(props.value ?? 50)));
      return (
        <Box style={{ ...style, justifyContent: "center" }}>
          <div style={{ position: "relative", width: "100%", height: 6, borderRadius: 999, background: "#e2e8f0" }}>
            <div style={{ width: `${value}%`, height: "100%", borderRadius: 999, background: "#0060fc" }} />
            <span
              style={{
                position: "absolute",
                left: `calc(${value}% - 9px)`,
                top: -6,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#ffffff",
                border: "2px solid #0060fc",
                boxSizing: "border-box",
              }}
            />
          </div>
        </Box>
      );
    }

    case "progress": {
      const value = Math.max(0, Math.min(100, Number(props.value ?? 60)));
      return (
        <div style={{ width: "100%", height: "100%", borderRadius: style.radius, background: style.fill, overflow: "hidden" }}>
          <div style={{ width: `${value}%`, height: "100%", background: style.textColor, borderRadius: style.radius }} />
        </div>
      );
    }

    case "image":
      return (
        <div style={surface(style)}>
          {image ? (
            <img
              src={image.src}
              alt={image.alt || image.name || ""}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: style.imageFit, borderRadius: style.radius, display: "block" }}
            />
          ) : (
            <Placeholder icon={FiImage} label="Imagen" style={style} />
          )}
        </div>
      );

    case "avatar":
      return (
        <div
          style={{
            ...surface(style),
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderRadius: style.radius,
          }}
        >
          {image ? (
            <img src={image.src} alt={image.alt || ""} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ ...textStyle({ ...style, align: "center" }), fontSize: style.fontSize }}>
              {(text || "AL").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      );

    case "video":
      return (
        <div style={{ ...surface(style), width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              background: "rgba(255,255,255,.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
            }}
          >
            <FiPlay />
          </span>
        </div>
      );

    case "card": {
      const [title, ...rest] = text.split("\n");
      return (
        <Box style={style}>
          <p style={{ ...textStyle(style), fontSize: style.fontSize }}>{title}</p>
          {rest.length > 0 && (
            <p style={{ ...textStyle({ ...style, fontWeight: 400 }), fontSize: Math.max(10, style.fontSize - 4), opacity: 0.7 }}>
              {rest.join("\n")}
            </p>
          )}
        </Box>
      );
    }

    case "list": {
      const rows = text.split("\n").filter(Boolean);
      return (
        <div style={{ ...surface(style), width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {rows.length === 0 && <Placeholder icon={FiPlay} label="Lista" style={style} />}
          {rows.map((row, index) => (
            <div
              key={`${row}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: `0 ${Math.max(10, style.padding)}px`,
                minHeight: 44,
                borderBottom: index < rows.length - 1 ? `1px solid ${style.borderColor}` : "none",
                ...textStyle({ ...style, align: "left" }),
                overflow: "hidden",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#cbd5e1", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row}</span>
            </div>
          ))}
        </div>
      );
    }

    case "table": {
      const rows = text.split("\n").filter(Boolean).map((row) => row.split("|").map((cell) => cell.trim()));
      return (
        <div style={{ ...surface(style), width: "100%", height: "100%", overflow: "hidden", padding: style.padding }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...textStyle({ ...style, align: "left" }) }}>
            <tbody>
              {rows.map((cells, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: `1px solid ${style.borderColor}` }}>
                  {cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        padding: "7px 6px",
                        fontWeight: rowIndex === 0 ? 700 : style.fontWeight,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 160,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "chart": {
      const values = props.values?.length ? widget.props.values : [40, 65, 52, 78, 61];
      const max = Math.max(1, ...values);
      return (
        <Box style={style}>
          {text && <p style={{ ...textStyle(style), fontSize: style.fontSize }}>{text}</p>}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, width: "100%", height: "100%", minHeight: 20 }}>
            {values.map((value, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: `${Math.max(6, (value / max) * 100)}%`,
                  background: index === values.length - 1 ? "#0060fc" : "#93c5fd",
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
        </Box>
      );
    }

    case "map":
      return (
        <div
          style={{
            ...surface(style),
            width: "100%",
            height: "100%",
            position: "relative",
            backgroundImage:
              "linear-gradient(rgba(148,163,184,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.25) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 26, color: "#dc2626" }}>◆</span>
        </div>
      );

    case "gallery": {
      const columns = Math.max(1, Math.min(6, Number(props.columns || 3)));
      return (
        <div
          style={{
            ...surface(style),
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 6,
            padding: style.padding,
          }}
        >
          {Array.from({ length: columns * 2 }).map((_, index) => (
            <div key={index} style={{ background: "#ffffff", borderRadius: Math.max(2, style.radius - 6), minHeight: 20 }} />
          ))}
        </div>
      );
    }

    case "appbar":
      return (
        <Box style={{ ...style, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ ...textStyle({ ...style, align: "left" }), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</p>
          <span style={{ display: "flex", gap: 6, alignItems: "center", color: style.textColor }}>
            <span style={{ fontSize: 15 }}>☰</span>
          </span>
        </Box>
      );

    case "tabbar": {
      const items = text.split("|").map((item) => item.trim()).filter(Boolean);
      return (
        <div
          style={{
            ...surface(style),
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: style.padding,
          }}
        >
          {items.map((item, index) => (
            <div key={`${item}-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: index === 0 ? "#0060fc" : style.textColor }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid currentColor`, opacity: 0.8 }} />
              <span style={{ ...textStyle({ ...style, align: "center" }), fontSize: Math.max(8, style.fontSize) }}>{item}</span>
            </div>
          ))}
        </div>
      );
    }

    case "divider":
      return <div style={{ width: "100%", height: "100%", background: style.fill, borderRadius: style.radius }} />;

    case "modal":
      return (
        <Box style={{ ...style, justifyContent: "flex-start", alignItems: style.align === "left" ? "flex-start" : "center" }}>
          <p style={{ ...textStyle(style), textAlign: style.align }}>{text}</p>
          <p style={{ ...textStyle({ ...style, fontWeight: 400 }), fontSize: Math.max(10, style.fontSize - 5), opacity: 0.65, textAlign: style.align }}>
            Este diálogo se puede conectar con otra pantalla del flujo.
          </p>
        </Box>
      );

    case "keyboard": {
      const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
      return (
        <div style={{ ...surface(style), width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 5, justifyContent: "center", padding: style.padding }}>
          {rows.map((row) => (
            <div key={row} style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {row.split("").map((letter) => (
                <span
                  key={letter}
                  style={{
                    flex: 1,
                    maxWidth: 34,
                    height: 26,
                    borderRadius: 5,
                    background: "#ffffff",
                    boxShadow: "0 1px 0 rgba(15,23,42,.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#334155",
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <span style={{ flex: 1, height: 26, borderRadius: 5, background: "#ffffff", maxWidth: 220 }} />
          </div>
        </div>
      );
    }

    case "browser-bar":
      return (
        <div
          style={{
            ...surface(style),
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: style.padding,
            borderBottom: `1px solid ${style.borderColor}`,
          }}
        >
          {["#f87171", "#fbbf24", "#34d399"].map((dot) => (
            <span key={dot} style={{ width: 10, height: 10, borderRadius: 999, background: dot }} />
          ))}
          <div
            style={{
              flex: 1,
              height: "70%",
              borderRadius: 999,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              ...textStyle({ ...style, align: "left" }),
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
        </div>
      );

    default:
      return <Box style={style}><p style={textStyle(style)}>{text || meta.label}</p></Box>;
  }
};

export { DeviceChrome, BrowserBar, DeviceStatusBar };
export default WidgetBody;
