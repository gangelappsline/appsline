/* eslint-disable react/prop-types */
import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { cx } from "../../../utils/format";

/**
 * Controles compartidos por los paneles de propiedades (diagrama y mockups).
 * Se extrajeron de `PropertiesPanel` para que `MockupProperties` los reutilice
 * sin dependencias circulares.
 */

export const Section = ({ title, children, defaultOpen = true, action }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-100">
      <header className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          <FiChevronDown className={cx("transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {action}
      </header>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </section>
  );
};

export const Row = ({ label, children, hint }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="shrink-0 text-xs text-slate-500" title={hint}>
      {label}
    </span>
    <div className="flex min-w-0 items-center gap-1.5">{children}</div>
  </div>
);

export const Input = ({ className = "", ...props }) => (
  <input
    {...props}
    className={cx(
      "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15",
      className,
    )}
  />
);

export const Select = ({ className = "", children, ...props }) => (
  <select
    {...props}
    className={cx(
      "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15",
      className,
    )}
  >
    {children}
  </select>
);

export const ColorInput = ({ value, onChange, allowTransparent = false, label }) => {
  const transparent = !value || value === "transparent";
  return (
    <div className="flex items-center gap-1">
      <label
        className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200"
        title={label}
        style={{
          background: transparent
            ? "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 8px 8px"
            : value,
        }}
      >
        <input
          type="color"
          value={transparent ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        value={transparent ? "" : value}
        placeholder={transparent ? "ninguno" : "#000000"}
        onChange={(e) => onChange(e.target.value || (allowTransparent ? "transparent" : "#000000"))}
        className="w-[76px] font-mono"
        aria-label={`${label} (hex)`}
      />
      {allowTransparent && (
        <button
          type="button"
          onClick={() => onChange("transparent")}
          title="Sin color"
          className={cx(
            "rounded-md border px-1.5 py-1 text-[10px] font-semibold",
            transparent ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
          )}
        >
          Ø
        </button>
      )}
    </div>
  );
};

export const Segmented = ({ value, options, onChange, ariaLabel }) => (
  <div role="radiogroup" aria-label={ariaLabel} className="flex overflow-hidden rounded-md border border-slate-200">
    {options.map((opt) => {
      const Icon = opt.icon;
      return (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={value === opt.key}
          title={opt.label}
          onClick={() => onChange(opt.key)}
          className={cx(
            "flex h-6 min-w-6 items-center justify-center px-1.5 text-xs transition",
            value === opt.key ? "bg-brand-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50",
          )}
        >
          {Icon ? <Icon /> : opt.short || opt.label}
        </button>
      );
    })}
  </div>
);

export const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cx(
      "relative h-5 w-9 shrink-0 rounded-full transition",
      checked ? "bg-brand-600" : "bg-slate-300",
    )}
  >
    <span
      className={cx(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
        checked ? "left-[18px]" : "left-0.5",
      )}
    />
  </button>
);

export const Slider = ({ value, min, max, step = 1, onChange, suffix = "", label }) => (
  <div className="flex items-center gap-1.5">
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-20 cursor-pointer accent-brand-600"
    />
    <span className="w-9 text-right text-[11px] tabular-nums text-slate-500">
      {value}
      {suffix}
    </span>
  </div>
);

export const IconButton = ({ title, onClick, children, danger = false, active = false, disabled = false }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={cx(
      "flex h-7 w-7 items-center justify-center rounded-md border text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
      danger
        ? "border-red-200 text-red-600 hover:bg-red-50"
        : active
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50",
    )}
  >
    {children}
  </button>
);
