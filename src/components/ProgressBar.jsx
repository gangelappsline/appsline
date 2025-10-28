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
      <div className="relative w-full rounded-md overflow-hidden" style={{ height }}>
        {/* background for remaining */}
        <div className="absolute inset-0 bg-gray-800" />
        {/* on-time segment */}
        {onPct > 0 && (
          <div
            className="absolute top-0 text-center py-2  text-white left-0 bg-green-500"
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
        <div className="mt-2 flex gap-3 justify-start items-start text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
            <span>A tiempo: <strong className="text-white ml-1">{on}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
            <span>Tarde: <strong className="text-white ml-1">{l}</strong></span>
          </div>
          <div className=" text-gray-400">Total: <strong className="text-white ml-1">{t}</strong></div>
        </div>
      )}
    </div>
  );
}