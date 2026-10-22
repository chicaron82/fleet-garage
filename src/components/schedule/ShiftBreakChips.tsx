import { useState } from 'react';

// How long the unpaid break really was, one tap each.
//
// ⭐ WHY IT EXISTS. Aaron, 2026-10-22, after a solo opening that ran to 16:36: *"0630-1636 with a shortened
// break of 15m instead of 30m"*. FG took a fixed 30 off every worked span past 5h, so that day read 9h36m
// against a true 9h51m and the OT came up short. Untouched, it stays null and the standard rule applies,
// so a normal day is still zero taps.
//
// Tapping the chip that is already on goes back to the standard: the value is "what I logged", and
// un-logging it must be possible without an extra control.
const PRESETS = [0, 15, 30, 45, 60];

const chipClass = (on: boolean) =>
  `min-h-[36px] px-2.5 rounded-lg border text-xs tabular-nums transition ${
    on
      ? 'border-fg-yellow bg-fg-yellow/15 text-gray-900 dark:text-gray-100 font-medium'
      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800'
  }`;

export function ShiftBreakChips({ breakMinutes, onChange }: {
  breakMinutes: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const custom = breakMinutes != null && !PRESETS.includes(breakMinutes);
  const [otherOpen, setOtherOpen] = useState(custom);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
        Break
        {breakMinutes == null && <span className="ml-1 text-gray-400 dark:text-gray-500">· standard 30m</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(m => {
          const on = breakMinutes === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => { setOtherOpen(false); onChange(on ? null : m); }}
              className={chipClass(on)}
            >
              {m === 0 ? 'None' : `${m}m`}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={otherOpen || custom}
          onClick={() => setOtherOpen(o => !o)}
          className={chipClass(otherOpen || custom)}
        >
          Other
        </button>
      </div>
      {(otherOpen || custom) && (
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            aria-label="Break minutes"
            value={breakMinutes ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? null : Math.round(Number(e.target.value));
              onChange(v == null || Number.isNaN(v) ? null : Math.min(240, Math.max(0, v)));
            }}
            className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
          />
          minutes
        </label>
      )}
    </div>
  );
}
