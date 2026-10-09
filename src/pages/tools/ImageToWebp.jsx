import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

const FORMATS = [
  { id: "image/webp", ext: "webp", label: "WebP" },
  { id: "image/png", ext: "png", label: "PNG" },
  { id: "image/jpeg", ext: "jpg", label: "JPG" },
];

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });

const ImageToWebp = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState(0.82);
  const [maxWidth, setMaxWidth] = useState("");
  const [format, setFormat] = useState("image/webp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const resultsRef = useRef([]);

  useEffect(() => {
    resultsRef.current = results;
    return () => {
      resultsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [results]);

  const convert = async () => {
    if (!files.length) return;
    setBusy(true);
    setError("");
    setResults([]);
    const output = [];

    try {
      for (const file of files) {
        const img = await loadImage(file);
        const limit = Number(maxWidth) || 0;
        const scale = limit && img.width > limit ? limit / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (format === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, format, Number(quality)),
        );
        if (!blob) throw new Error(t("tools.imageToWebp.unsupported"));

        const ext = FORMATS.find((item) => item.id === format).ext;
        output.push({
          name: `${file.name.replace(/\.[^.]+$/, "")}.${ext}`,
          url: URL.createObjectURL(blob),
          blob,
          originalSize: file.size,
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
        });
      }
      setResults(output);
    } catch (err) {
      setError(err?.message || t("tools.ui.genericError"));
    } finally {
      setBusy(false);
    }
  };

  const totalOriginal = results.reduce((sum, item) => sum + item.originalSize, 0);
  const totalNew = results.reduce((sum, item) => sum + item.size, 0);
  const saved = totalOriginal ? Math.round((1 - totalNew / totalOriginal) * 100) : 0;

  return (
    <ToolPage slug="imagen-a-webp">
      <div className="space-y-6">
        <Panel title={t("tools.imageToWebp.uploadTitle")} hint={t("tools.imageToWebp.uploadHint")}>
          <Dropzone
            accept="image/*"
            multiple
            files={files}
            onFiles={(list) => {
              setFiles(list);
              setResults([]);
            }}
            onClear={() => {
              setFiles([]);
              setResults([]);
            }}
            label={t("tools.imageToWebp.drop")}
            hint="PNG · JPG · GIF · BMP · AVIF · SVG"
          />

          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            <Field label={t("tools.imageToWebp.format")}>
              <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`${t("tools.imageToWebp.quality")}: ${Math.round(quality * 100)}%`}>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.01"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="mt-3 w-full accent-[#0060FC]"
                disabled={format === "image/png"}
              />
            </Field>
            <Field label={t("tools.imageToWebp.maxWidth")} hint={t("tools.imageToWebp.maxWidthHint")}>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={maxWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
                placeholder="1920"
              />
            </Field>
          </div>

          <div className="mt-6">
            <Button onClick={convert} disabled={!files.length || busy}>
              {busy ? t("tools.ui.processing") : t("tools.imageToWebp.action")}
            </Button>
          </div>
        </Panel>

        {error && <Alert>{error}</Alert>}

        {results.length > 0 && (
          <Panel
            title={t("tools.ui.result")}
            hint={t("tools.imageToWebp.saved", {
              percent: saved,
              before: formatBytes(totalOriginal),
              after: formatBytes(totalNew),
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((item) => (
                <div
                  key={item.name}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1017]"
                >
                  <div className="flex h-40 items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:12px_12px]">
                    <img src={item.url} alt={item.name} className="max-h-36 max-w-full object-contain" />
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.width}×{item.height} · {formatBytes(item.originalSize)} →{" "}
                      <span className="text-emerald-400">{formatBytes(item.size)}</span>
                    </p>
                    <Button
                      variant="subtle"
                      className="mt-3 w-full"
                      onClick={() => downloadBlob(item.blob, item.name)}
                    >
                      {t("tools.ui.download")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {results.length > 1 && (
              <Button
                className="mt-6"
                onClick={() =>
                  results.forEach((item, index) =>
                    setTimeout(() => downloadBlob(item.blob, item.name), index * 350),
                  )
                }
              >
                {t("tools.imageToWebp.downloadAll")}
              </Button>
            )}
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default ImageToWebp;
