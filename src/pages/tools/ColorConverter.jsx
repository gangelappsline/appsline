import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ToolPage from "../../components/tools/ToolPage";
import { Alert, CopyButton, Field, Panel, inputClass } from "../../components/tools/ToolUI";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseColor = (input) => {
  const value = input.trim().toLowerCase();

  const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split("").map((char) => char + char).join("");
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
      a: raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3)
      return {
        r: clamp(parts[0], 0, 255),
        g: clamp(parts[1], 0, 255),
        b: clamp(parts[2], 0, 255),
        a: parts[3] ?? 1,
      };
  }

  const hsl = value.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const parts = hsl[1].split(/[,/\s]+/).filter(Boolean);
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r1, g1, b1] =
      h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
      a,
    };
  }

  return null;
};

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

const toHsl = ({ r, g, b }) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
};

const toCmyk = ({ r, g, b }) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
};

const luminance = ({ r, g, b }) =>
  [r, g, b]
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, value, index) => acc + value * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const ColorConverter = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("#0060FC");

  const color = useMemo(() => parseColor(input), [input]);
  const hsl = color ? toHsl(color) : null;
  const cmyk = color ? toCmyk(color) : null;

  const shades = useMemo(() => {
    if (!hsl) return [];
    return [90, 80, 70, 60, 50, 40, 30, 20, 10].map((lightness) => ({
      lightness,
      css: `hsl(${hsl.h} ${hsl.s}% ${lightness}%)`,
    }));
  }, [hsl]);

  const onWhite = color ? contrast(color, { r: 255, g: 255, b: 255 }) : 0;
  const onBlack = color ? contrast(color, { r: 8, g: 10, b: 15 }) : 0;

  const formats = color
    ? [
        ["HEX", toHex(color).toUpperCase()],
        ["RGB", `rgb(${color.r}, ${color.g}, ${color.b})`],
        ["RGBA", `rgba(${color.r}, ${color.g}, ${color.b}, ${Number(color.a.toFixed(2))})`],
        ["HSL", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
        ["CMYK", `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
        ["CSS var", `--color: ${toHex(color)};`],
      ]
    : [];

  return (
    <ToolPage slug="conversor-de-color">
      <div className="space-y-6">
        <Panel title={t("tools.color.inputTitle")} hint={t("tools.color.inputHint")}>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <Field label={t("tools.color.value")}>
              <input
                className={inputClass}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="#0060FC · rgb(0,96,252) · hsl(217,100%,49%)"
              />
            </Field>
            <Field label={t("tools.color.picker")}>
              <input
                type="color"
                value={color ? toHex(color) : "#000000"}
                onChange={(e) => setInput(e.target.value)}
                className="h-11 w-24 cursor-pointer rounded-xl border border-white/10 bg-[#0d1017] p-1"
              />
            </Field>
          </div>
          {!color && input.trim() && (
            <div className="mt-4">
              <Alert>{t("tools.color.invalid")}</Alert>
            </div>
          )}
        </Panel>

        {color && (
          <>
            <div
              className="h-32 rounded-3xl border border-white/10"
              style={{ background: toHex(color) }}
            />

            <Panel title={t("tools.color.formats")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {formats.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="truncate font-mono text-sm text-slate-200">{value}</p>
                    </div>
                    <CopyButton value={value} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={t("tools.color.scale")}>
              <div className="flex overflow-hidden rounded-2xl">
                {shades.map((shade) => (
                  <div
                    key={shade.lightness}
                    title={shade.css}
                    className="h-20 flex-1"
                    style={{ background: shade.css }}
                  />
                ))}
              </div>
            </Panel>

            <Panel title={t("tools.color.contrast")}>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  [t("tools.color.onWhite"), onWhite, "#ffffff"],
                  [t("tools.color.onDark"), onBlack, "#080a0f"],
                ].map(([label, ratio, background]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 p-5"
                    style={{ background }}
                  >
                    <p className="text-2xl font-semibold" style={{ color: toHex(color) }}>
                      {label}
                    </p>
                    <p className="mt-3 text-sm" style={{ color: toHex(color) }}>
                      {ratio.toFixed(2)}:1 ·{" "}
                      {ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "✗"}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </ToolPage>
  );
};

export default ColorConverter;
