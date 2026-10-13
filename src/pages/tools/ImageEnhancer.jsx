/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiImage,
  FiLock,
  FiMaximize2,
  FiRefreshCw,
  FiScissors,
  FiSliders,
  FiUnlock,
  FiZap,
} from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  Dropzone,
  Field,
  Panel,
  downloadBlob,
  formatBytes,
  inputClass,
} from "../../components/tools/ToolUI";
import {
  applyAutoEnhance,
  applyColorAdjustments,
  applyDenoise,
  applySharpen,
  blobToCanvas,
  canvasToBlob,
  compositeOverColor,
  fileToCanvas,
  loadImage,
  refineAlphaEdges,
  removeBackgroundByColor,
  resizeCanvas,
  trimTransparent,
} from "../../tools/imageEnhancer";

const FORMATS = [
  { id: "image/png", ext: "png", label: "PNG" },
  { id: "image/webp", ext: "webp", label: "WebP" },
  { id: "image/jpeg", ext: "jpg", label: "JPG" },
];

const BG_COLORS = ["#ffffff", "#000000", "#002EFD", "#00A3FE", "#f43f5e", "#22c55e", "#f59e0b"];
const MAX_SIDE = 8000;
const MAX_MEGAPIXELS = 60;

/* ------------------------------------------------------------- subcomponentes */
const Seg = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 rounded-full px-3 py-2 text-[13px] font-medium leading-tight transition ${
      active
        ? "bg-[#002EFD] text-white"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    {children}
  </button>
);

const Slider = ({ label, value, display, min, max, step = 1, onChange, disabled }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      <span className="text-xs tabular-nums text-slate-500">{display ?? value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#0060FC] disabled:opacity-40"
    />
  </div>
);

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 accent-[#0060FC]"
    />
    <span>
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      {hint && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>}
    </span>
  </label>
);

const CHECKER =
  "repeating-conic-gradient(#1c222f 0% 25%, #11151d 0% 50%) 0 0 / 16px 16px";

/* ------------------------------------------------------------------ página -- */
const ImageEnhancer = () => {
  const { t } = useTranslation();

  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [meta, setMeta] = useState(null); // { width, height }

  // Fondo
  const [bgMode, setBgMode] = useState("keep"); // keep | ai | color
  const [aiModel, setAiModel] = useState("isnet_quint8"); // rápido | calidad
  const [replacement, setReplacement] = useState("transparent"); // transparent | color
  const [bgColor, setBgColor] = useState("#ffffff");
  const [tolerance, setTolerance] = useState(35);
  const [edgeFeather, setEdgeFeather] = useState(1);
  const [trim, setTrim] = useState(false);

  // Mejora
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [sharpness, setSharpness] = useState(45);
  const [denoise, setDenoise] = useState(15);

  // Escala
  const [targetWidth, setTargetWidth] = useState("");
  const [targetHeight, setTargetHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [activeScale, setActiveScale] = useState(1);

  // Salida
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.92);

  // Proceso / resultado
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(null); // 0..100 | null (indeterminado)
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [compare, setCompare] = useState(50);
  const resultUrlRef = useRef("");

  /* ---------------------------------------------------------- ciclo de vida */
  useEffect(() => {
    if (!file) {
      setOriginalUrl("");
      setMeta(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    let cancelled = false;
    loadImage(file)
      .then((img) => {
        if (cancelled) return;
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        setMeta({ width, height });
        setTargetWidth(String(width));
        setTargetHeight(String(height));
        setActiveScale(1);
      })
      .catch(() => !cancelled && setError(t("tools.imageEnhancer.errors.read")));
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(
    () => () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    },
    [],
  );

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = "";
    setResult(null);
  };

  /* --------------------------------------------------------------- acciones */
  const setSize = (width, height) => {
    setTargetWidth(String(Math.max(1, Math.round(width))));
    setTargetHeight(String(Math.max(1, Math.round(height))));
  };

  const applyScale = (factor) => {
    if (!meta) return;
    setActiveScale(factor);
    setSize(meta.width * factor, meta.height * factor);
  };

  const applyPresetWidth = (width) => {
    if (!meta) return;
    setActiveScale(0);
    setSize(width, (width * meta.height) / meta.width);
  };

  const onWidthChange = (value) => {
    setActiveScale(0);
    setTargetWidth(value);
    const width = Number(value);
    if (lockAspect && meta && width > 0) {
      setTargetHeight(String(Math.round((width * meta.height) / meta.width)));
    }
  };

  const onHeightChange = (value) => {
    setActiveScale(0);
    setTargetHeight(value);
    const height = Number(value);
    if (lockAspect && meta && height > 0) {
      setTargetWidth(String(Math.round((height * meta.width) / meta.height)));
    }
  };

  const resetEnhance = () => {
    setAutoEnhance(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setSharpness(0);
    setDenoise(0);
  };

  const applyPreset = (preset) => {
    clearResult();
    if (preset === "auto") {
      setBgMode("keep");
      setAutoEnhance(true);
      setBrightness(0);
      setContrast(5);
      setSaturation(5);
      setSharpness(55);
      setDenoise(20);
      if (meta) applyScale(1);
    }
    if (preset === "product") {
      setBgMode("ai");
      setAiModel("isnet_quint8");
      setReplacement("transparent");
      setTrim(true);
      setAutoEnhance(true);
      setSharpness(50);
      setDenoise(10);
      if (meta) applyScale(2);
      setFormat("image/png");
    }
    if (preset === "web") {
      setBgMode("keep");
      setAutoEnhance(true);
      setSharpness(40);
      setDenoise(10);
      if (meta) applyPresetWidth(Math.min(1920, meta.width));
      setFormat("image/webp");
      setQuality(0.85);
    }
  };

  /* --------------------------------------------------------------- procesar */
  const processImage = async () => {
    if (!file || !meta || busy) return;

    const outW = Number(targetWidth);
    const outH = Number(targetHeight);
    if (!outW || !outH || outW < 1 || outH < 1) {
      setError(t("tools.imageEnhancer.errors.size"));
      return;
    }
    if (outW > MAX_SIDE || outH > MAX_SIDE || (outW * outH) / 1e6 > MAX_MEGAPIXELS) {
      setError(t("tools.imageEnhancer.errors.tooLarge", { max: MAX_SIDE }));
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError(t("tools.imageEnhancer.errors.fileTooLarge"));
      return;
    }

    setBusy(true);
    setError("");
    clearResult();
    setProgress(null);
    setStep("preparing");

    try {
      let working;

      /* ----- 1. Quitar fondo ----- */
      if (bgMode === "ai") {
        setStep("downloading");
        const { removeBackground } = await import("@imgly/background-removal");
        const config = {
          model: aiModel,
          device: "cpu",
          output: { format: "image/png", quality: 1 },
          progress: (_key, current, total) => {
            if (total > 0) setProgress(Math.min(99, Math.round((current / total) * 100)));
          },
        };
        setStep("removing");
        let blob;
        try {
          blob = await removeBackground(file, config);
        } catch (firstError) {
          // Segundo intento con el modelo ligero si el elegido falló (red/GPU).
          if (aiModel === "isnet_quint8") throw firstError;
          blob = await removeBackground(file, { ...config, model: "isnet_quint8" });
        }
        setProgress(null);
        working = await blobToCanvas(blob);
      } else {
        working = await fileToCanvas(file);
        if (bgMode === "color") {
          setStep("removing");
          working = removeBackgroundByColor(working, {
            tolerance,
            feather: 8 + edgeFeather * 6,
          });
        }
      }

      if (bgMode !== "keep") {
        if (edgeFeather > 0) working = refineAlphaEdges(working, edgeFeather);
        if (trim) working = trimTransparent(working, 10);
      }

      /* ----- 2. Mejora de calidad ----- */
      setStep("enhancing");
      // Deja respirar a la UI para pintar el paso antes del trabajo pesado.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (denoise > 0) working = applyDenoise(working, denoise);
      if (autoEnhance) working = applyAutoEnhance(working);
      working = applyColorAdjustments(working, {
        brightness,
        contrast,
        saturation: saturation + (autoEnhance ? 8 : 0),
      });

      /* ----- 3. Escala ----- */
      setStep("scaling");
      await new Promise((resolve) => setTimeout(resolve, 30));
      // Si se recortó el vacío, el destino se ajusta a la nueva proporción
      // (cada eje con su propia proporción, respetando el tamaño indicado).
      const cropped = trim && bgMode !== "keep";
      const ratioW = cropped ? working.width / meta.width : 1;
      const ratioH = cropped ? working.height / meta.height : 1;
      const effectiveW = Math.max(1, Math.round(outW * ratioW));
      const effectiveH = Math.max(1, Math.round(outH * ratioH));
      working = resizeCanvas(working, effectiveW, effectiveH);

      // La nitidez se aplica al tamaño final: es donde realmente se nota.
      if (sharpness > 0) working = applySharpen(working, sharpness);

      /* ----- 4. Fondo nuevo y exportación ----- */
      setStep("exporting");
      if (format === "image/jpeg") {
        const fill =
          bgMode !== "keep" && replacement === "color" ? bgColor : "#ffffff";
        working = compositeOverColor(working, fill);
      } else if (bgMode !== "keep" && replacement === "color") {
        working = compositeOverColor(working, bgColor);
      }

      const blob = await canvasToBlob(working, format, Number(quality));
      const ext = FORMATS.find((item) => item.id === format).ext;
      const name = `${file.name.replace(/\.[^.]+$/, "") || "imagen"}-mejorada.${ext}`;
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({
        url,
        blob,
        name,
        width: working.width,
        height: working.height,
        size: blob.size,
      });
      setCompare(50);
      setStep("done");
    } catch (err) {
      console.error("ImageEnhancer:", err);
      setError(
        bgMode === "ai"
          ? t("tools.imageEnhancer.errors.ai")
          : err?.message === "export"
            ? t("tools.imageEnhancer.errors.export")
            : t("tools.ui.genericError"),
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  /* ----------------------------------------------------------------- vista */
  const outputMp = meta
    ? ((Number(targetWidth) || 0) * (Number(targetHeight) || 0)) / 1e6
    : 0;
  const showJpegNote =
    bgMode !== "keep" && replacement === "transparent" && format === "image/jpeg";

  return (
    <ToolPage slug="mejorar-imagen">
      <div className="space-y-6">
        {/* ---------------------------------------------------------- subida */}
        <Panel
          title={t("tools.imageEnhancer.uploadTitle")}
          hint={t("tools.imageEnhancer.uploadHint")}
        >
          <Dropzone
            accept="image/*"
            files={file ? [file] : []}
            onFiles={(list) => {
              setFile(list[0]);
              setError("");
              clearResult();
            }}
            onClear={() => {
              setFile(null);
              setError("");
              clearResult();
            }}
            label={t("tools.imageEnhancer.drop")}
            hint="PNG · JPG · WebP · AVIF — máx. 30 MB"
          />
          {meta && file && (
            <p className="mt-4 text-sm text-slate-400">
              {t("tools.imageEnhancer.originalSize")}:{" "}
              <span className="text-white">
                {meta.width}×{meta.height}
              </span>{" "}
              · {formatBytes(file.size)}
            </p>
          )}
        </Panel>

        {!file && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [FiZap, "enhanceTitle", "enhanceText"],
              [FiScissors, "backgroundTitle", "backgroundText"],
              [FiMaximize2, "scaleTitle", "scaleText"],
            ].map(([Icon, titleKey, textKey]) => (
              <div
                key={titleKey}
                className="rounded-3xl border border-white/10 bg-white/[.025] p-6"
              >
                <Icon className="text-2xl text-[#00A3FE]" />
                <h3 className="mt-4 font-semibold text-white">
                  {t(`tools.imageEnhancer.features.${titleKey}`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {t(`tools.imageEnhancer.features.${textKey}`)}
                </p>
              </div>
            ))}
          </div>
        )}

        {file && (
          <>
            {/* ---------------------------------------------------- recetas */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-400">
                {t("tools.imageEnhancer.presetsTitle")}:
              </span>
              {["auto", "product", "web"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-slate-300 transition hover:border-[#0060FC]/60 hover:text-white"
                >
                  {t(`tools.imageEnhancer.presets.${preset}`)}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
              {/* ---------------------------------------------- controles */}
              <div className="space-y-6">
                {/* Fondo */}
                <Panel
                  title={t("tools.imageEnhancer.backgroundTitle")}
                  hint={t("tools.imageEnhancer.backgroundHint")}
                >
                  <div className="flex gap-1 rounded-full border border-white/10 bg-[#0d1017] p-1">
                    <Seg active={bgMode === "keep"} onClick={() => setBgMode("keep")}>
                      {t("tools.imageEnhancer.bgModes.keep")}
                    </Seg>
                    <Seg active={bgMode === "ai"} onClick={() => setBgMode("ai")}>
                      {t("tools.imageEnhancer.bgModes.ai")}
                    </Seg>
                    <Seg active={bgMode === "color"} onClick={() => setBgMode("color")}>
                      {t("tools.imageEnhancer.bgModes.color")}
                    </Seg>
                  </div>

                  {bgMode === "ai" && (
                    <div className="mt-5 space-y-4">
                      <Field label={t("tools.imageEnhancer.aiModel")}>
                        <select
                          className={inputClass}
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                        >
                          <option value="isnet_quint8">
                            {t("tools.imageEnhancer.aiModels.fast")}
                          </option>
                          <option value="isnet_fp16">
                            {t("tools.imageEnhancer.aiModels.quality")}
                          </option>
                        </select>
                      </Field>
                      <Alert tone="info">{t("tools.imageEnhancer.aiNote")}</Alert>
                    </div>
                  )}

                  {bgMode === "color" && (
                    <div className="mt-5 space-y-5">
                      <Slider
                        label={t("tools.imageEnhancer.tolerance")}
                        value={tolerance}
                        display={`${tolerance}`}
                        min={1}
                        max={90}
                        onChange={setTolerance}
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        {t("tools.imageEnhancer.colorNote")}
                      </p>
                    </div>
                  )}

                  {bgMode !== "keep" && (
                    <div className="mt-5 space-y-5">
                      <Field label={t("tools.imageEnhancer.replacement")}>
                        <div className="flex gap-1 rounded-full border border-white/10 bg-[#0d1017] p-1">
                          <Seg
                            active={replacement === "transparent"}
                            onClick={() => setReplacement("transparent")}
                          >
                            {t("tools.imageEnhancer.replacements.transparent")}
                          </Seg>
                          <Seg
                            active={replacement === "color"}
                            onClick={() => setReplacement("color")}
                          >
                            {t("tools.imageEnhancer.replacements.color")}
                          </Seg>
                        </div>
                      </Field>

                      {replacement === "color" && (
                        <Field label={t("tools.imageEnhancer.bgColor")}>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                              className="h-11 w-14 cursor-pointer rounded-xl border border-white/10 bg-[#0d1017] p-1"
                            />
                            <input
                              className={inputClass}
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                            />
                          </div>
                          <div className="mt-3 flex gap-2">
                            {BG_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                aria-label={color}
                                onClick={() => setBgColor(color)}
                                className={`h-7 w-7 rounded-full border-2 transition ${
                                  bgColor === color ? "border-[#00A3FE]" : "border-white/20"
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </Field>
                      )}

                      <Slider
                        label={t("tools.imageEnhancer.edgeFeather")}
                        value={edgeFeather}
                        display={`${edgeFeather}px`}
                        min={0}
                        max={3}
                        step={0.5}
                        onChange={setEdgeFeather}
                      />
                      <Toggle
                        checked={trim}
                        onChange={setTrim}
                        label={t("tools.imageEnhancer.trim")}
                        hint={t("tools.imageEnhancer.trimHint")}
                      />
                    </div>
                  )}
                </Panel>

                {/* Mejora */}
                <Panel
                  title={t("tools.imageEnhancer.enhanceTitle")}
                  hint={t("tools.imageEnhancer.enhanceHint")}
                >
                  <div className="space-y-5">
                    <Toggle
                      checked={autoEnhance}
                      onChange={setAutoEnhance}
                      label={t("tools.imageEnhancer.auto")}
                      hint={t("tools.imageEnhancer.autoHint")}
                    />
                    <Slider
                      label={t("tools.imageEnhancer.brightness")}
                      value={brightness}
                      display={`${brightness > 0 ? "+" : ""}${brightness}`}
                      min={-50}
                      max={50}
                      onChange={setBrightness}
                    />
                    <Slider
                      label={t("tools.imageEnhancer.contrast")}
                      value={contrast}
                      display={`${contrast > 0 ? "+" : ""}${contrast}`}
                      min={-50}
                      max={50}
                      onChange={setContrast}
                    />
                    <Slider
                      label={t("tools.imageEnhancer.saturation")}
                      value={saturation}
                      display={`${saturation > 0 ? "+" : ""}${saturation}`}
                      min={-100}
                      max={100}
                      onChange={setSaturation}
                    />
                    <Slider
                      label={t("tools.imageEnhancer.sharpness")}
                      value={sharpness}
                      display={`${sharpness}%`}
                      min={0}
                      max={100}
                      onChange={setSharpness}
                    />
                    <Slider
                      label={t("tools.imageEnhancer.denoise")}
                      value={denoise}
                      display={`${denoise}%`}
                      min={0}
                      max={100}
                      onChange={setDenoise}
                    />
                    <Button variant="subtle" onClick={resetEnhance}>
                      <FiRefreshCw /> {t("tools.imageEnhancer.reset")}
                    </Button>
                  </div>
                </Panel>

                {/* Escala */}
                <Panel
                  title={t("tools.imageEnhancer.scaleTitle")}
                  hint={t("tools.imageEnhancer.scaleHint")}
                >
                  <Field label={t("tools.imageEnhancer.scaleFactor")}>
                    <div className="flex gap-1 rounded-full border border-white/10 bg-[#0d1017] p-1">
                      {[1, 2, 3, 4].map((factor) => (
                        <Seg
                          key={factor}
                          active={activeScale === factor}
                          onClick={() => applyScale(factor)}
                        >
                          {factor}×
                        </Seg>
                      ))}
                    </div>
                  </Field>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <Field label={t("tools.imageEnhancer.width")}>
                      <input
                        type="number"
                        min="1"
                        max={MAX_SIDE}
                        className={inputClass}
                        value={targetWidth}
                        onChange={(e) => onWidthChange(e.target.value)}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => setLockAspect((value) => !value)}
                      aria-label={t("tools.imageEnhancer.lockAspect")}
                      title={t("tools.imageEnhancer.lockAspect")}
                      className={`mb-1 flex h-11 w-11 items-center justify-center rounded-full border transition ${
                        lockAspect
                          ? "border-[#0060FC]/60 text-[#00A3FE]"
                          : "border-white/10 text-slate-500 hover:text-white"
                      }`}
                    >
                      {lockAspect ? <FiLock /> : <FiUnlock />}
                    </button>
                    <Field label={t("tools.imageEnhancer.height")}>
                      <input
                        type="number"
                        min="1"
                        max={MAX_SIDE}
                        className={inputClass}
                        value={targetHeight}
                        onChange={(e) => onHeightChange(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[1080, 1920, 2560, 3840].map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => applyPresetWidth(width)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 transition hover:border-[#0060FC]/60 hover:text-white"
                      >
                        {width} px
                      </button>
                    ))}
                  </div>

                  {outputMp > 25 && (
                    <p className="mt-4 text-xs leading-5 text-amber-300/90">
                      {t("tools.imageEnhancer.bigOutput", {
                        mp: outputMp.toFixed(1),
                      })}
                    </p>
                  )}
                </Panel>

                {/* Salida */}
                <Panel title={t("tools.imageEnhancer.outputTitle")}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t("tools.imageEnhancer.format")}>
                      <select
                        className={inputClass}
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                      >
                        {FORMATS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Slider
                      label={t("tools.imageEnhancer.quality")}
                      value={Math.round(quality * 100)}
                      display={`${Math.round(quality * 100)}%`}
                      min={10}
                      max={100}
                      onChange={(value) => setQuality(value / 100)}
                    />
                  </div>
                  {showJpegNote && (
                    <div className="mt-4">
                      <Alert tone="warning">{t("tools.imageEnhancer.jpegNote")}</Alert>
                    </div>
                  )}
                  <Button
                    onClick={processImage}
                    disabled={!file || busy}
                    className="mt-6 w-full !py-3.5 text-base"
                  >
                    <FiSliders />
                    {busy
                      ? t("tools.imageEnhancer.processing")
                      : t("tools.imageEnhancer.action")}
                  </Button>

                  {busy && (
                    <div className="mt-4">
                      <p className="text-sm text-slate-300">
                        {t(`tools.imageEnhancer.steps.${step || "preparing"}`)}
                        {progress !== null && step === "downloading"
                          ? ` · ${progress}%`
                          : ""}
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        {progress !== null && step === "downloading" ? (
                          <div
                            className="h-full rounded-full bg-[#0060FC] transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        ) : (
                          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#0060FC]" />
                        )}
                      </div>
                    </div>
                  )}
                </Panel>
              </div>

              {/* ------------------------------------------- vista previa */}
              <Panel
                title={t("tools.imageEnhancer.previewTitle")}
                hint={t("tools.imageEnhancer.previewHint")}
                className="lg:sticky lg:top-24"
              >
                <div
                  className="relative overflow-hidden rounded-2xl border border-white/10"
                  style={{ background: CHECKER }}
                >
                  {/* Original (abajo) */}
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt={t("tools.imageEnhancer.original")}
                      className="block max-h-[560px] w-full object-contain"
                      draggable={false}
                    />
                  )}
                  {/* Resultado (arriba, recortado por el comparador) */}
                  {result && (
                    <img
                      src={result.url}
                      alt={t("tools.imageEnhancer.resultLabel")}
                      className="absolute inset-0 h-full max-h-[560px] w-full object-contain"
                      style={{
                        clipPath: `inset(0 ${100 - compare}% 0 0)`,
                      }}
                      draggable={false}
                    />
                  )}
                  {result && (
                    <>
                      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                        {t("tools.imageEnhancer.resultLabel")}
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                        {t("tools.imageEnhancer.original")}
                      </span>
                      <div
                        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow"
                        style={{ left: `${compare}%` }}
                      />
                    </>
                  )}
                </div>

                {result ? (
                  <>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-300">
                          {t("tools.imageEnhancer.compare")}
                        </span>
                        <span className="text-xs text-slate-500">
                          {compare}% · {100 - compare}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={compare}
                        onChange={(e) => setCompare(Number(e.target.value))}
                        className="w-full accent-[#0060FC]"
                      />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-[#0d1017] p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {t("tools.imageEnhancer.original")}
                        </p>
                        <p className="mt-1.5 text-white">
                          {meta?.width}×{meta?.height} · {formatBytes(file.size)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-400/80">
                          {t("tools.imageEnhancer.resultLabel")}
                        </p>
                        <p className="mt-1.5 text-white">
                          {result.width}×{result.height} · {formatBytes(result.size)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Alert tone="success">{t("tools.imageEnhancer.resultReady")}</Alert>
                    </div>
                    <Button
                      className="mt-4 w-full !py-3.5 text-base"
                      onClick={() => downloadBlob(result.blob, result.name)}
                    >
                      <FiDownload /> {t("tools.ui.download")} · {result.name}
                    </Button>
                  </>
                ) : (
                  <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <FiImage className="shrink-0 text-[#00A3FE]" />
                    {t("tools.imageEnhancer.emptyPreview")}
                  </p>
                )}
              </Panel>
            </div>
          </>
        )}

        {error && <Alert>{error}</Alert>}
      </div>
    </ToolPage>
  );
};

export default ImageEnhancer;
