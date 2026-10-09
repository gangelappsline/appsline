/* eslint-disable react/prop-types */
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiCopy, FiDownload, FiUploadCloud, FiX } from "react-icons/fi";

/* ------------------------------------------------------------------ card ---*/
export const Panel = ({ title, hint, children, className = "" }) => (
  <section
    className={`rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8 ${className}`}
  >
    {title && (
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      </header>
    )}
    {children}
  </section>
);

/* ---------------------------------------------------------------- labels ---*/
export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
    {children}
    {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
  </label>
);

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#0060FC] focus:ring-2 focus:ring-[#0060FC]/25";

export const textAreaClass = `${inputClass} min-h-[180px] font-mono leading-6`;

/* --------------------------------------------------------------- buttons ---*/
export const Button = ({ variant = "primary", className = "", ...props }) => {
  const variants = {
    primary:
      "bg-[#002EFD] text-white hover:bg-[#0060FC] disabled:opacity-40 disabled:hover:bg-[#002EFD]",
    ghost:
      "border border-white/15 text-slate-200 hover:border-white/35 hover:text-white disabled:opacity-40",
    subtle: "bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-40",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
};

/* ------------------------------------------------------------ copy button --*/
export const CopyButton = ({ value, className = "" }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
    } catch {
      const area = document.createElement("textarea");
      area.value = String(value ?? "");
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button variant="subtle" onClick={onCopy} disabled={!value} className={className}>
      {copied ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
      {copied ? t("tools.ui.copied") : t("tools.ui.copy")}
    </Button>
  );
};

/* ----------------------------------------------------------- download btn --*/
export const DownloadButton = ({ onClick, children, disabled }) => (
  <Button onClick={onClick} disabled={disabled}>
    <FiDownload /> {children}
  </Button>
);

/* -------------------------------------------------------------- dropzone ---*/
export const Dropzone = ({ accept, multiple = false, onFiles, label, hint, files = [], onClear }) => {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const { t } = useTranslation();

  const handleFiles = useCallback(
    (list) => {
      const arr = Array.from(list || []);
      if (arr.length) onFiles(multiple ? arr : [arr[0]]);
    },
    [multiple, onFiles],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
          over
            ? "border-[#00A3FE] bg-[#0060FC]/10"
            : "border-white/15 bg-white/[.02] hover:border-[#0060FC]/60"
        }`}
      >
        <FiUploadCloud className="text-4xl text-[#00A3FE]" />
        <p className="mt-4 font-semibold text-white">{label || t("tools.ui.dropLabel")}</p>
        <p className="mt-1 text-sm text-slate-400">{hint || t("tools.ui.dropHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3 text-sm"
            >
              <span className="truncate text-slate-200">{file.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatBytes(file.size)}</span>
            </li>
          ))}
          {onClear && (
            <li>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white"
              >
                <FiX /> {t("tools.ui.clear")}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- alerts ---*/
export const Alert = ({ tone = "error", children }) => {
  if (!children) return null;
  const tones = {
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    info: "border-[#0060FC]/30 bg-[#0060FC]/10 text-slate-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>
  );
};

/* --------------------------------------------------------------- helpers ---*/
export const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
