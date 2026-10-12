/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCodeStyling from "qr-code-styling";
import {
  FiChevronDown,
  FiDownload,
  FiDroplet,
  FiEdit3,
  FiImage,
  FiLink,
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiSliders,
  FiTrash2,
  FiType,
  FiUploadCloud,
  FiUser,
  FiWifi,
} from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import { Alert, Field, inputClass } from "../../components/tools/ToolUI";
import brandLogo from "../../assets/images/new_logo_appsline_transparent.png";

/* ------------------------------------------------------------------------ */
/*  Contenido                                                                */
/* ------------------------------------------------------------------------ */
const PRESETS = [
  { id: "url", icon: FiLink },
  { id: "text", icon: FiType },
  { id: "wifi", icon: FiWifi },
  { id: "email", icon: FiMail },
  { id: "sms", icon: FiMessageSquare },
  { id: "phone", icon: FiPhone },
  { id: "vcard", icon: FiUser },
];

const buildPayload = (preset, values) => {
  const esc = (value = "") => value.replace(/([\\;,:"])/g, "\\$1");
  switch (preset) {
    case "url":
      return values.url ? (/^https?:\/\//i.test(values.url) ? values.url : `https://${values.url}`) : "";
    case "wifi":
      return values.ssid
        ? `WIFI:T:${values.encryption || "WPA"};S:${esc(values.ssid)};P:${esc(values.password || "")};;`
        : "";
    case "email":
      return values.email
        ? `mailto:${values.email}?subject=${encodeURIComponent(values.subject || "")}&body=${encodeURIComponent(values.body || "")}`
        : "";
    case "sms":
      return values.phone ? `SMSTO:${values.phone}:${values.message || ""}` : "";
    case "phone":
      return values.phone ? `tel:${values.phone}` : "";
    case "vcard":
      return values.fullName
        ? [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `N:${esc(values.fullName)}`,
            `FN:${esc(values.fullName)}`,
            values.org ? `ORG:${esc(values.org)}` : "",
            values.phone ? `TEL:${values.phone}` : "",
            values.email ? `EMAIL:${values.email}` : "",
            values.url ? `URL:${values.url}` : "",
            "END:VCARD",
          ]
            .filter(Boolean)
            .join("\n")
        : "";
    default:
      return values.text || "";
  }
};

const FIELDS = {
  text: [["text", "textarea"]],
  url: [["url", "text"]],
  wifi: [
    ["ssid", "text"],
    ["password", "text"],
    ["encryption", "select"],
  ],
  email: [
    ["email", "text"],
    ["subject", "text"],
    ["body", "textarea"],
  ],
  sms: [
    ["phone", "text"],
    ["message", "textarea"],
  ],
  phone: [["phone", "text"]],
  vcard: [
    ["fullName", "text"],
    ["org", "text"],
    ["phone", "text"],
    ["email", "text"],
    ["url", "text"],
  ],
};

/* ------------------------------------------------------------------------ */
/*  Iconos SVG de las formas (estilo QRCode Monkey)                          */
/* ------------------------------------------------------------------------ */
const leafPath = (x, y, s, r1, r2 = 0) =>
  [
    `M ${x + r1} ${y}`,
    `L ${x + s - r2} ${y}`,
    r2 ? `Q ${x + s} ${y} ${x + s} ${y + r2}` : `L ${x + s} ${y}`,
    `L ${x + s} ${y + s - r1}`,
    `Q ${x + s} ${y + s} ${x + s - r1} ${y + s}`,
    `L ${x + r2} ${y + s}`,
    r2 ? `Q ${x} ${y + s} ${x} ${y + s - r2}` : `L ${x} ${y + s}`,
    `L ${x} ${y + r1}`,
    `Q ${x} ${y} ${x + r1} ${y}`,
    "Z",
  ].join(" ");

const bodyModule = (type, x, y) => {
  const s = 7;
  switch (type) {
    case "dots":
      return <circle key={`${x}-${y}`} cx={x + s / 2} cy={y + s / 2} r={s / 2} />;
    case "rounded":
      return <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} rx="2" />;
    case "extra-rounded":
      return <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} rx="3.2" />;
    case "classy":
      return <path key={`${x}-${y}`} d={leafPath(x, y, s, 3.5)} />;
    case "classy-rounded":
      return <path key={`${x}-${y}`} d={leafPath(x, y, s, 3.5, 1.6)} />;
    default:
      return <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} />;
  }
};

const BodyIcon = ({ type }) => (
  <svg viewBox="0 0 23 23" className="h-8 w-8 fill-current" aria-hidden>
    {[
      [0, 0],
      [16, 0],
      [8, 8],
      [0, 16],
      [16, 16],
    ].map(([x, y]) => bodyModule(type, x, y))}
  </svg>
);

const EyeFrameIcon = ({ type }) => {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 3.6 };
  let shape;
  switch (type) {
    case "dot":
      shape = <circle cx="12" cy="12" r="9" {...common} />;
      break;
    case "rounded":
      shape = <rect x="3" y="3" width="18" height="18" rx="5" {...common} />;
      break;
    case "extra-rounded":
      shape = <rect x="3" y="3" width="18" height="18" rx="8" {...common} />;
      break;
    case "classy":
      shape = <path d={leafPath(3, 3, 18, 8)} {...common} />;
      break;
    case "classy-rounded":
      shape = <path d={leafPath(3, 3, 18, 8, 3)} {...common} />;
      break;
    case "dots":
      shape = (
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          {...common}
          strokeWidth="3.2"
          strokeDasharray="0.1 5.9"
          strokeLinecap="round"
        />
      );
      break;
    default:
      shape = <rect x="3" y="3" width="18" height="18" {...common} />;
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
      {shape}
    </svg>
  );
};

const EyeBallIcon = ({ type }) => {
  let shape;
  switch (type) {
    case "dot":
      shape = <circle cx="12" cy="12" r="7.5" />;
      break;
    case "rounded":
      shape = <rect x="4.5" y="4.5" width="15" height="15" rx="4" />;
      break;
    case "extra-rounded":
      shape = <rect x="4.5" y="4.5" width="15" height="15" rx="7" />;
      break;
    case "classy":
      shape = <path d={leafPath(4.5, 4.5, 15, 7)} />;
      break;
    case "classy-rounded":
      shape = <path d={leafPath(4.5, 4.5, 15, 7, 2.6)} />;
      break;
    case "dots":
      shape = (
        <>
          {[7, 12, 17].map((cx) =>
            [7, 12, 17].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.1" />),
          )}
        </>
      );
      break;
    default:
      shape = <rect x="4.5" y="4.5" width="15" height="15" />;
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden>
      {shape}
    </svg>
  );
};

const BODY_TYPES = ["square", "rounded", "extra-rounded", "dots", "classy", "classy-rounded"];
const EYE_FRAME_TYPES = ["square", "rounded", "extra-rounded", "dot", "classy", "classy-rounded", "dots"];
const EYE_BALL_TYPES = ["square", "rounded", "extra-rounded", "dot", "classy", "classy-rounded", "dots"];

/* ------------------------------------------------------------------------ */
/*  UI auxiliares                                                            */
/* ------------------------------------------------------------------------ */
const Section = ({ icon: Icon, title, open, onToggle, children }) => (
  <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-white/[.03] sm:px-8"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-lg text-[#00A3FE]">
          <Icon />
        </span>
        <span className="text-base font-semibold text-white">{title}</span>
      </span>
      <FiChevronDown
        className={`shrink-0 text-xl text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
    {open && <div className="border-t border-white/10 px-6 py-6 sm:px-8">{children}</div>}
  </section>
);

const ShapeButton = ({ active, onClick, children, label }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`flex items-center justify-center rounded-xl border p-2.5 transition ${
      active
        ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
        : "border-white/10 text-slate-500 hover:border-white/30 hover:text-slate-200"
    }`}
  >
    {children}
  </button>
);

const ColorInput = ({ value, onChange, disabled }) => (
  <div
    className={`flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1017] px-3 py-2 ${
      disabled ? "opacity-40" : ""
    }`}
  >
    <input
      type="color"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
    />
    <input
      type="text"
      value={value.toUpperCase()}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
      }}
      className="w-full bg-transparent font-mono text-sm text-white outline-none"
    />
  </div>
);

const SWATCHES = ["#080A0F", "#002EFD", "#0060FC", "#00A3FE", "#001C8F", "#11141C"];

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex cursor-pointer items-center gap-3">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-[#0060FC]" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
    <span className="text-sm text-slate-300">{label}</span>
  </label>
);

/* ------------------------------------------------------------------------ */
/*  Página                                                                   */
/* ------------------------------------------------------------------------ */
const QrGenerator = () => {
  const { t } = useTranslation();

  /* contenido */
  const [preset, setPreset] = useState("url");
  const [values, setValues] = useState({ url: "https://appsline.com.mx" });

  /* colores */
  const [colorMode, setColorMode] = useState("single");
  const [color1, setColor1] = useState("#080A0F");
  const [color2, setColor2] = useState("#0060FC");
  const [gradientType, setGradientType] = useState("linear");
  const [rotation, setRotation] = useState(45);
  const [background, setBackground] = useState("#FFFFFF");
  const [transparentBg, setTransparentBg] = useState(false);
  const [customEyes, setCustomEyes] = useState(false);
  const [eyeFrameColor, setEyeFrameColor] = useState("#002EFD");
  const [eyeBallColor, setEyeBallColor] = useState("#00A3FE");

  /* logo */
  const [logo, setLogo] = useState(""); // dataURL o ruta
  const [logoSize, setLogoSize] = useState(0.35);
  const [logoMargin, setLogoMargin] = useState(4);
  const [hideBgDots, setHideBgDots] = useState(true);

  /* diseño */
  const [dotType, setDotType] = useState("square");
  const [eyeFrameType, setEyeFrameType] = useState("square");
  const [eyeBallType, setEyeBallType] = useState("square");
  const [level, setLevel] = useState("M");
  const [margin, setMargin] = useState(16);

  /* salida */
  const [size, setSize] = useState(1024);
  const [error, setError] = useState("");

  /* secciones abiertas */
  const [open, setOpen] = useState({ content: true, colors: false, logo: false, design: false });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const payload = useMemo(() => buildPayload(preset, values), [preset, values]);
  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const foreground = useMemo(
    () =>
      colorMode === "gradient"
        ? {
            gradient: {
              type: gradientType,
              rotation: (rotation * Math.PI) / 180,
              colorStops: [
                { offset: 0, color: color1 },
                { offset: 1, color: color2 },
              ],
            },
          }
        : { color: color1 },
    [colorMode, gradientType, rotation, color1, color2],
  );

  const options = useMemo(
    () => ({
      width: Number(size),
      height: Number(size),
      type: "canvas",
      data: payload || " ",
      image: logo || undefined,
      margin: Number(margin),
      qrOptions: { errorCorrectionLevel: level },
      imageOptions: {
        crossOrigin: "anonymous",
        hideBackgroundDots: hideBgDots,
        imageSize: Number(logoSize),
        margin: Number(logoMargin),
      },
      dotsOptions: { type: dotType, ...foreground },
      cornersSquareOptions: {
        type: eyeFrameType,
        ...(customEyes ? { color: eyeFrameColor } : foreground),
      },
      cornersDotOptions: {
        type: eyeBallType,
        ...(customEyes ? { color: eyeBallColor } : foreground),
      },
      backgroundOptions: { color: transparentBg ? "rgba(255,255,255,0)" : background },
    }),
    [
      size,
      payload,
      logo,
      margin,
      level,
      hideBgDots,
      logoSize,
      logoMargin,
      dotType,
      foreground,
      eyeFrameType,
      eyeBallType,
      customEyes,
      eyeFrameColor,
      eyeBallColor,
      transparentBg,
      background,
    ],
  );

  const containerRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    try {
      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(options);
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          qrRef.current.append(containerRef.current);
        }
      } else {
        qrRef.current.update(options);
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [options]);

  const download = (extension) => {
    if (!payload) return;
    qrRef.current?.download({ name: "appsline-qr", extension });
  };

  const onLogoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(reader.result);
      setLevel("H"); // con logo conviene corrección alta
    };
    reader.readAsDataURL(file);
  };

  const fileInputRef = useRef(null);

  return (
    <ToolPage slug="generador-de-qr">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        {/* ------------------------------------------------ columna izquierda */}
        <div className="space-y-4">
          {/* Tabs de tipo de contenido */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {PRESETS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition ${
                  preset === id
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                <Icon className={`text-lg ${preset === id ? "text-[#00A3FE]" : ""}`} />
                {t(`tools.qr.presets.${id}`)}
              </button>
            ))}
          </div>

          {/* 1 · Contenido */}
          <Section
            icon={FiEdit3}
            title={t("tools.qr.sections.content")}
            open={open.content}
            onToggle={() => toggle("content")}
          >
            <div className="space-y-4">
              {FIELDS[preset].map(([name, type]) => (
                <Field key={name} label={t(`tools.qr.fields.${name}`)}>
                  {type === "textarea" ? (
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={values[name] || ""}
                      onChange={set(name)}
                      placeholder={t(`tools.qr.fields.${name}`)}
                    />
                  ) : type === "select" ? (
                    <select className={inputClass} value={values[name] || "WPA"} onChange={set(name)}>
                      <option value="WPA">WPA / WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">{t("tools.qr.noPassword")}</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputClass}
                      value={values[name] || ""}
                      onChange={set(name)}
                      placeholder={t(`tools.qr.fields.${name}`)}
                    />
                  )}
                </Field>
              ))}
            </div>
          </Section>

          {/* 2 · Colores */}
          <Section
            icon={FiDroplet}
            title={t("tools.qr.sections.colors")}
            open={open.colors}
            onToggle={() => toggle("colors")}
          >
            <div className="space-y-6">
              {/* modo de color */}
              <div className="flex flex-wrap gap-2">
                {["single", "gradient"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setColorMode(mode)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      colorMode === mode
                        ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                        : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {t(`tools.qr.colorMode.${mode}`)}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={
                    colorMode === "gradient"
                      ? t("tools.qr.gradientStart")
                      : t("tools.qr.foreground")
                  }
                >
                  <ColorInput value={color1} onChange={setColor1} />
                </Field>
                {colorMode === "gradient" && (
                  <Field label={t("tools.qr.gradientEnd")}>
                    <ColorInput value={color2} onChange={setColor2} />
                  </Field>
                )}
                {colorMode === "gradient" && (
                  <Field label={t("tools.qr.gradientType")}>
                    <select
                      className={inputClass}
                      value={gradientType}
                      onChange={(e) => setGradientType(e.target.value)}
                    >
                      <option value="linear">{t("tools.qr.gradientLinear")}</option>
                      <option value="radial">{t("tools.qr.gradientRadial")}</option>
                    </select>
                  </Field>
                )}
                {colorMode === "gradient" && gradientType === "linear" && (
                  <Field label={`${t("tools.qr.rotation")}: ${rotation}°`}>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="mt-3 w-full accent-[#0060FC]"
                    />
                  </Field>
                )}
              </div>

              {/* swatches de marca */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-300">
                  {t("tools.qr.brandColors")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor1(swatch)}
                      title={swatch}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        color1.toUpperCase() === swatch
                          ? "border-[#00A3FE] scale-110"
                          : "border-white/15 hover:border-white/40"
                      }`}
                      style={{ background: swatch }}
                    />
                  ))}
                </div>
              </div>

              {/* fondo */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("tools.qr.background")}>
                  <ColorInput value={background} onChange={setBackground} disabled={transparentBg} />
                </Field>
                <div className="flex items-end pb-2">
                  <Toggle
                    checked={transparentBg}
                    onChange={setTransparentBg}
                    label={t("tools.qr.transparentBg")}
                  />
                </div>
              </div>

              {/* ojos personalizados */}
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <Toggle
                  checked={customEyes}
                  onChange={setCustomEyes}
                  label={t("tools.qr.customEyes")}
                />
                {customEyes && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("tools.qr.eyeFrameColor")}>
                      <ColorInput value={eyeFrameColor} onChange={setEyeFrameColor} />
                    </Field>
                    <Field label={t("tools.qr.eyeBallColor")}>
                      <ColorInput value={eyeBallColor} onChange={setEyeBallColor} />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* 3 · Logo */}
          <Section
            icon={FiImage}
            title={t("tools.qr.sections.logo")}
            open={open.logo}
            onToggle={() => toggle("logo")}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                {/* sin logo */}
                <button
                  type="button"
                  onClick={() => setLogo("")}
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-xs transition ${
                    !logo
                      ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                      : "border-white/10 text-slate-500 hover:border-white/30"
                  }`}
                >
                  {t("tools.qr.logoNone")}
                </button>
                {/* logo appsline */}
                <button
                  type="button"
                  onClick={() => {
                    setLogo(brandLogo);
                    setLevel("H");
                  }}
                  title="Appsline"
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border bg-white p-2 transition ${
                    logo === brandLogo
                      ? "border-[#0060FC] ring-2 ring-[#0060FC]/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={brandLogo} alt="Appsline" className="max-h-full max-w-full object-contain" />
                </button>
                {/* logo subido */}
                {logo && logo !== brandLogo && (
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0060FC] bg-white p-2 ring-2 ring-[#0060FC]/40">
                    <img src={logo} alt="logo" className="max-h-full max-w-full object-contain" />
                  </span>
                )}
                {/* subir */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-16 items-center gap-2 rounded-2xl border border-dashed border-white/20 px-5 text-sm text-slate-300 transition hover:border-[#0060FC]/60 hover:text-white"
                >
                  <FiUploadCloud className="text-lg text-[#00A3FE]" />
                  {t("tools.qr.logoUpload")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    onLogoFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo("")}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-red-300"
                  >
                    <FiTrash2 /> {t("tools.qr.logoRemove")}
                  </button>
                )}
              </div>

              {logo && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={`${t("tools.qr.logoSize")}: ${Math.round(logoSize * 100)}%`}>
                      <input
                        type="range"
                        min="0.2"
                        max="0.5"
                        step="0.05"
                        value={logoSize}
                        onChange={(e) => setLogoSize(Number(e.target.value))}
                        className="mt-3 w-full accent-[#0060FC]"
                      />
                    </Field>
                    <Field label={`${t("tools.qr.logoMargin")}: ${logoMargin}px`}>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="2"
                        value={logoMargin}
                        onChange={(e) => setLogoMargin(Number(e.target.value))}
                        className="mt-3 w-full accent-[#0060FC]"
                      />
                    </Field>
                  </div>
                  <Toggle
                    checked={hideBgDots}
                    onChange={setHideBgDots}
                    label={t("tools.qr.hideBgDots")}
                  />
                  <Alert tone="info">{t("tools.qr.logoHint")}</Alert>
                </>
              )}
            </div>
          </Section>

          {/* 4 · Diseño */}
          <Section
            icon={FiSliders}
            title={t("tools.qr.sections.design")}
            open={open.design}
            onToggle={() => toggle("design")}
          >
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-medium text-slate-300">{t("tools.qr.bodyShape")}</p>
                <div className="flex flex-wrap gap-2">
                  {BODY_TYPES.map((type) => (
                    <ShapeButton
                      key={type}
                      active={dotType === type}
                      onClick={() => setDotType(type)}
                      label={type}
                    >
                      <BodyIcon type={type} />
                    </ShapeButton>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-slate-300">
                  {t("tools.qr.eyeFrameShape")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {EYE_FRAME_TYPES.map((type) => (
                    <ShapeButton
                      key={type}
                      active={eyeFrameType === type}
                      onClick={() => setEyeFrameType(type)}
                      label={type}
                    >
                      <EyeFrameIcon type={type} />
                    </ShapeButton>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-slate-300">
                  {t("tools.qr.eyeBallShape")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {EYE_BALL_TYPES.map((type) => (
                    <ShapeButton
                      key={type}
                      active={eyeBallType === type}
                      onClick={() => setEyeBallType(type)}
                      label={type}
                    >
                      <EyeBallIcon type={type} />
                    </ShapeButton>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("tools.qr.level")} hint={t("tools.qr.levelHint")}>
                  <select
                    className={inputClass}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="L">L — 7%</option>
                    <option value="M">M — 15%</option>
                    <option value="Q">Q — 25%</option>
                    <option value="H">H — 30%</option>
                  </select>
                </Field>
                <Field label={`${t("tools.qr.margin")}: ${margin}px`}>
                  <input
                    type="range"
                    min="0"
                    max="48"
                    step="4"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="mt-3 w-full accent-[#0060FC]"
                  />
                </Field>
              </div>
            </div>
          </Section>
        </div>

        {/* ------------------------------------------------- columna derecha */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <section className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-white">{t("tools.ui.preview")}</h2>
            {error && <Alert>{error}</Alert>}

            <div
              className={`relative flex items-center justify-center overflow-hidden rounded-2xl p-4 ${
                transparentBg
                  ? "bg-[conic-gradient(at_25%_25%,#e2e8f0_90deg,#f8fafc_90deg_180deg,#e2e8f0_180deg_270deg,#f8fafc_270deg)] bg-[length:24px_24px]"
                  : ""
              }`}
              style={transparentBg ? undefined : { background }}
            >
              <div
                ref={containerRef}
                className={`[&>canvas]:h-auto [&>canvas]:w-full [&>canvas]:max-w-[300px] ${
                  payload ? "" : "opacity-0"
                }`}
              />
              {!payload && (
                <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-slate-500">
                  {t("tools.qr.empty")}
                </p>
              )}
            </div>

            {/* calidad */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-300">{t("tools.qr.quality")}</span>
                <span className="font-mono text-xs text-slate-400">
                  {size} × {size} px
                </span>
              </div>
              <input
                type="range"
                min="256"
                max="2048"
                step="128"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="mt-2 w-full accent-[#0060FC]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>{t("tools.qr.qualityLow")}</span>
                <span>{t("tools.qr.qualityHigh")}</span>
              </div>
            </div>

            {/* descargas */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!payload}
                onClick={() => download("png")}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#002EFD] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0060FC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiDownload /> {t("tools.qr.downloadPng")}
              </button>
              {["svg", "jpeg", "webp"].map((ext) => (
                <button
                  key={ext}
                  type="button"
                  disabled={!payload}
                  onClick={() => download(ext)}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
                    ext === "webp" ? "col-span-2" : ""
                  }`}
                >
                  <FiDownload /> {ext.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </ToolPage>
  );
};

export default QrGenerator;
