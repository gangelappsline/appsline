/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

/**
 * Pestañas del panel (estilo "pill" o subrayado).
 * @example <Tabs tabs={[{key:'all',label:'Todas',count:12}]} active="all" onChange={setTab} />
 */
const Tabs = ({ tabs = [], active, onChange, variant = "pill", className = "" }) => {
  if (variant === "underline") {
    return (
      <div className={cx("flex gap-1 overflow-x-auto border-b border-slate-200", className)}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange?.(t.key)}
              className={cx(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
                isActive
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              )}
            >
              {Icon && <Icon />}
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={cx(
                    "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    isActive ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cx("flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1", className)}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange?.(t.key)}
            className={cx(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              isActive ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {Icon && <Icon />}
            {t.label}
            {typeof t.count === "number" && (
              <span className={cx("text-xs tabular-nums", isActive ? "text-slate-500" : "text-slate-400")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
