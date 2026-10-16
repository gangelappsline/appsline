/* eslint-disable react/prop-types */

/** `stroke-dasharray` para cada estilo de línea. */
export const dashArray = (dash, width = 2) => {
  if (dash === "dashed") return `${width * 4} ${width * 3}`;
  if (dash === "dotted") return `${width} ${width * 2.5}`;
  return undefined;
};

/**
 * Geometría de cada forma en coordenadas reales (no se escala el SVG para
 * que el grosor del borde se mantenga). Devuelve uno o varios elementos.
 */
const geometry = (shape, w, h, i, radius) => {
  const x0 = i;
  const y0 = i;
  const x1 = w - i;
  const y1 = h - i;
  const cx = w / 2;
  const cy = h / 2;

  switch (shape) {
    case "terminal":
      return [{ el: "rect", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: (y1 - y0) / 2 }];
    case "decision":
      return [{ el: "polygon", points: `${cx},${y0} ${x1},${cy} ${cx},${y1} ${x0},${cy}` }];
    case "io": {
      const skew = Math.min(26, (x1 - x0) * 0.16);
      return [{ el: "polygon", points: `${x0 + skew},${y0} ${x1},${y0} ${x1 - skew},${y1} ${x0},${y1}` }];
    }
    case "subprocess": {
      const inset = Math.min(14, (x1 - x0) * 0.1);
      return [
        { el: "rect", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: Math.min(radius, 6) },
        { el: "line", x1: x0 + inset, y1: y0, x2: x0 + inset, y2: y1, fill: "none" },
        { el: "line", x1: x1 - inset, y1: y0, x2: x1 - inset, y2: y1, fill: "none" },
      ];
    }
    case "document": {
      const wave = Math.min(18, (y1 - y0) * 0.22);
      const yb = y1 - wave;
      return [
        {
          el: "path",
          d: `M ${x0} ${y0} H ${x1} V ${yb} C ${x1 - (x1 - x0) * 0.25} ${yb - wave * 1.4}, ${x0 + (x1 - x0) * 0.25} ${yb + wave * 1.4}, ${x0} ${yb} Z`,
        },
      ];
    }
    case "database": {
      const ry = Math.min(14, (y1 - y0) * 0.16);
      const rx = (x1 - x0) / 2;
      return [
        {
          el: "path",
          d: `M ${x0} ${y0 + ry} A ${rx} ${ry} 0 0 1 ${x1} ${y0 + ry} V ${y1 - ry} A ${rx} ${ry} 0 0 1 ${x0} ${y1 - ry} Z`,
        },
        { el: "path", d: `M ${x0} ${y0 + ry} A ${rx} ${ry} 0 0 0 ${x1} ${y0 + ry}`, fill: "none" },
      ];
    }
    case "manual": {
      const slant = Math.min(18, (y1 - y0) * 0.25);
      return [{ el: "polygon", points: `${x0},${y0 + slant} ${x1},${y0} ${x1},${y1} ${x0},${y1}` }];
    }
    case "preparation": {
      const c = Math.min((y1 - y0) / 2, 28);
      return [
        {
          el: "polygon",
          points: `${x0 + c},${y0} ${x1 - c},${y0} ${x1},${cy} ${x1 - c},${y1} ${x0 + c},${y1} ${x0},${cy}`,
        },
      ];
    }
    case "delay": {
      const r = (y1 - y0) / 2;
      return [{ el: "path", d: `M ${x0} ${y0} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} H ${x0} Z` }];
    }
    case "connector":
      return [{ el: "ellipse", cx, cy, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 }];
    case "offpage": {
      const tip = Math.min(22, (y1 - y0) * 0.3);
      return [{ el: "polygon", points: `${x0},${y0} ${x1},${y0} ${x1},${y1 - tip} ${cx},${y1} ${x0},${y1 - tip}` }];
    }
    case "note": {
      const fold = Math.min(18, (x1 - x0) * 0.15);
      return [
        { el: "path", d: `M ${x0} ${y0} H ${x1 - fold} L ${x1} ${y0 + fold} V ${y1} H ${x0} Z` },
        { el: "path", d: `M ${x1 - fold} ${y0} V ${y0 + fold} H ${x1}`, fill: "rgba(0,0,0,0.08)" },
      ];
    }
    case "swimlane":
      return [
        { el: "rect", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: radius },
        { el: "line", x1: x0, y1: y0 + 36, x2: x1, y2: y0 + 36, fill: "none" },
      ];
    case "text":
      return [];
    case "process":
    default:
      return [{ el: "rect", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: radius }];
  }
};

/**
 * Fondo SVG de un nodo del diagrama. Se dibuja al tamaño real del nodo.
 */
const ShapeSvg = ({ shape, width, height, style = {}, className = "" }) => {
  const strokeWidth = Number(style.strokeWidth ?? 2);
  const inset = strokeWidth / 2 + 1;
  const parts = geometry(shape, width, height, inset, Number(style.radius ?? 10));
  const dash = dashArray(style.dash, strokeWidth);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {style.shadow && shape !== "text" && (
        <defs>
          <filter id={`shadow-${shape}`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
        </defs>
      )}
      {parts.map(({ el: El, fill, ...attrs }, index) => (
        <El
          key={index}
          {...attrs}
          fill={fill ?? style.fill ?? "#fff"}
          stroke={style.stroke ?? "#0f172a"}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinejoin="round"
          filter={index === 0 && style.shadow && shape !== "text" ? `url(#shadow-${shape})` : undefined}
        />
      ))}
    </svg>
  );
};

export default ShapeSvg;
