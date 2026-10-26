/* eslint-disable react/prop-types */
import WidgetBody, { BrowserBar, DeviceChrome } from "./MockupWidget";
import { deviceMeta } from "../../../utils/mockups";

/**
 * Pantalla renderizada a escala, sin interacción: prototipo navegable,
 * previsualizaciones y miniaturas grandes.
 */
const MockupPreview = ({ node, scale = 1, highlightWidgetId = null, onWidgetClick = null }) => {
  const data = node?.data || {};
  const device = deviceMeta(data.device);
  const width = node?.width || device.width;
  const height = node?.height || device.height;
  const bezel = device.bezel || 0;
  const innerRadius = Math.max(0, (device.radius || 0) - bezel);
  const browserBar = device.browserBar ? 44 : 0;
  const contentWidth = Math.max(1, width - bezel * 2);
  const contentHeight = Math.max(1, height - bezel * 2 - browserBar);

  return (
    <div
      style={{
        width: width * scale,
        height: height * scale,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          borderRadius: device.radius,
          padding: bezel,
          boxSizing: "border-box",
          background: device.platform === "web" ? "#e2e8f0" : "#0b1220",
          boxShadow: "0 24px 60px rgba(15,23,42,.28)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: innerRadius,
            overflow: "hidden",
            background: data.background,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {device.browserBar && <BrowserBar text={data.url || "app.appsline.com.mx"} />}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: browserBar,
              width: contentWidth,
              height: contentHeight,
              overflow: "hidden",
            }}
          >
            {(data.widgets || []).map((widget, index) => (
              <div
                key={widget.id}
                role={onWidgetClick ? "button" : undefined}
                tabIndex={onWidgetClick ? 0 : undefined}
                onClick={onWidgetClick ? () => onWidgetClick(widget) : undefined}
                style={{
                  position: "absolute",
                  left: widget.x,
                  top: widget.y,
                  width: widget.w,
                  height: widget.h,
                  zIndex: index + 1,
                  cursor: onWidgetClick ? "pointer" : "default",
                  transform: widget.style?.rotate ? `rotate(${widget.style.rotate}deg)` : undefined,
                  outline: highlightWidgetId === widget.id ? "2px dashed #0060fc" : "none",
                  outlineOffset: 2,
                }}
              >
                <WidgetBody widget={widget} />
              </div>
            ))}
          </div>
          <DeviceChrome device={device} statusBar={data.statusBar !== false} />
        </div>
      </div>
    </div>
  );
};

export default MockupPreview;
