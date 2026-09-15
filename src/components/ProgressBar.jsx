import React from "react";

/**
 * ProgressBar
 * Props:
 *  - on_time: number (tasks delivered on time)
 *  - late: number (tasks delivered late)
 *  - total: number (total tasks) - if 0/undefined it's derived from on_time + late
 *  - height: px height of the bar (default 12)
 *  - showLabels: boolean (show counts/percentages legend)
 */
export default function ProgressBar({ on_time = 0, late = 0, total = 0, height = 12, showLabels = true }) {
  const on = Number(on_time) || 0;
  const l = Number(late) || 0;
  const derivedTotal = Number(total) || (on + l);
  const t = Math.max(derivedTotal, 0);

  const onPct = t > 0 ? Math.round((on / t) * 100) : 0;
  const latePct = t > 0 ? Math.round((l / t) * 100) : 0;
  const rem = Math.max(t - on - l, 0);
  const remPct = t > 0 ? Math.max(0, 100 - onPct - latePct) : 0;

  const leftOn = 0;
  const leftLate = `${onPct}%`;

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-full" style={{ height }}>
        {/* background for remaining */}
        <div className="absolute inset-0 bg-slate-200" />
        {/* on-time segment */}
        {onPct > 0 && (
          <div
            className="absolute left-0 top-0 h-full bg-emerald-500"
            style={{ width: `${onPct}%` }}
            title={`A tiempo: ${on} (${onPct}%)`}
          ></div>
        )}
        {/* late segment */}
        {latePct > 0 && (
          <div
            className="absolute top-0"
            style={{ left: leftLate, width: `${latePct}%`, height }}
            title={`Tarde: ${l} (${latePct}%)`}
          >
            <div className="h-full bg-red-500" />
          </div>
        )}
      </div>

      {showLabels && (
        <div className="mt-2 flex gap-3 justify-start items-start text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            <span>A tiempo: <strong className="ml-1 text-slate-800">{on}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
            <span>Tarde: <strong className="ml-1 text-slate-800">{l}</strong></span>
          </div>
          <div className="text-slate-500">Total: <strong className="ml-1 text-slate-800">{t}</strong></div>
        </div>
      )}
    </div>
  );
}