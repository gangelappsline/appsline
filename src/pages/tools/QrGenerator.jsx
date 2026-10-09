import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  DownloadButton,
  Field,
  Panel,
  downloadBlob,
  inputClass,
} from "../../components/tools/ToolUI";

const PRESETS = ["text", "url", "wifi", "email", "phone", "vcard"];

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

const QrGenerator = () => {
  const { t } = useTranslation();
  const [preset, setPreset] = useState("text");
  const [values, setValues] = useState({ text: "https://appsline.com.mx" });
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [dark, setDark] = useState("#080a0f");
  const [light, setLight] = useState("#ffffff");
  const [level, setLevel] = useState("M");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  const payload = useMemo(() => buildPayload(preset, values), [preset, values]);
  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setDataUrl("");
      return undefined;
    }
    QRCode.toDataURL(payload, {
      width: Number(size),
      margin: Number(margin),
      errorCorrectionLevel: level,
      color: { dark, light },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [payload, size, margin, dark, light, level]);

  const downloadPng = () => {
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => downloadBlob(blob, "appsline-qr.png"));
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(payload, {
      type: "svg",
      margin: Number(margin),
      errorCorrectionLevel: level,
      color: { dark, light },
    });
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "appsline-qr.svg");
  };

  const fields = {
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
    phone: [["phone", "text"]],
    vcard: [
      ["fullName", "text"],
      ["org", "text"],
      ["phone", "text"],
      ["email", "text"],
      ["url", "text"],
    ],
  }[preset];

  return (
    <ToolPage slug="generador-de-qr">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <Panel title={t("tools.qr.contentTitle")}>
            <div className="mb-6 flex flex-wrap gap-2">
              {PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPreset(item)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    preset === item
                      ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                      : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {t(`tools.qr.presets.${item}`)}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {fields.map(([name, type]) => (
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
          </Panel>

          <Panel title={t("tools.qr.styleTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t("tools.qr.size")}: ${size}px`}>
                <input
                  type="range"
                  min="128"
                  max="1024"
                  step="32"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full accent-[#0060FC]"
                />
              </Field>
              <Field label={`${t("tools.qr.margin")}: ${margin}`}>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="w-full accent-[#0060FC]"
                />
              </Field>
              <Field label={t("tools.qr.foreground")}>
                <input
                  type="color"
                  value={dark}
                  onChange={(e) => setDark(e.target.value)}
                  className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#0d1017] p-1"
                />
              </Field>
              <Field label={t("tools.qr.background")}>
                <input
                  type="color"
                  value={light}
                  onChange={(e) => setLight(e.target.value)}
                  className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#0d1017] p-1"
                />
              </Field>
              <Field label={t("tools.qr.level")} hint={t("tools.qr.levelHint")}>
                <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="L">L — 7%</option>
                  <option value="M">M — 15%</option>
                  <option value="Q">Q — 25%</option>
                  <option value="H">H — 30%</option>
                </select>
              </Field>
            </div>
          </Panel>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <Panel title={t("tools.ui.preview")}>
            {error && <Alert>{error}</Alert>}
            {dataUrl ? (
              <>
                <div className="flex items-center justify-center rounded-2xl bg-white p-4">
                  <img src={dataUrl} alt="QR" className="h-auto w-full max-w-[280px]" />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <DownloadButton onClick={downloadPng}>PNG</DownloadButton>
                  <Button variant="ghost" onClick={downloadSvg}>
                    SVG
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">{t("tools.qr.empty")}</p>
            )}
          </Panel>
        </div>
      </div>
    </ToolPage>
  );
};

export default QrGenerator;
