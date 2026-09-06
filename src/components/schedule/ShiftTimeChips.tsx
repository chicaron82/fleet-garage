import { useMemo } from 'react';
import { useShiftTimePresets } from '../../hooks/useShiftTimePresets';
import { rankTimePresets, presetsWorthShowing } from '../../lib/shiftTimePresets';
import type { ShiftType } from '../../types';

// The windows actually worked, one tap each.
//
// ⭐ WHY IT EXISTS. `shiftDefaults.ts` pins ONE time per shift type — `mid` is 10:30–19:00 — and
// "mid" is fifteen different shifts on FG's books. He picked Mid, FG filled 10:30–19:00, the sheet
// wanted 09:30–18:00, and he had to hand-edit both fields. His ask was "a second mid option"; the
// data says a second is still a guess, so these rank themselves off real use and re-sort when the
// branch reshuffles. Nothing new is collected — FG already stored every window it ever scheduled.
//
// ⚠️ Its own component rather than more lines in ShiftForm: wiring it inline took that file to 348,
// past FG's 330-line cap. Thin parent, extracted module — the standing pattern.
export function ShiftTimeChips({ shiftType, startTime, endTime, onPick }: {
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  onPick: (start: string, end: string) => void;
}) {
  const rows = useShiftTimePresets();
  const chips = useMemo(() => rankTimePresets(rows, shiftType), [rows, shiftType]);

  // Hidden when there is nowhere else to go — a single chip is not a choice, and a row of chips
  // that all read the time already in the fields is furniture.
  if (!presetsWorthShowing(chips, { start: startTime, end: endTime })) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(c => {
        const on = c.start === startTime && c.end === endTime;
        return (
          <button
            key={`${c.start}-${c.end}`}
            type="button"
            onClick={() => onPick(c.start, c.end)}
            aria-pressed={on}
            // 36px min target — this sits under a thumb on the lot, not a mouse.
            className={`min-h-[36px] px-2.5 rounded-lg border text-xs tabular-nums transition ${
              on
                ? 'border-fg-yellow bg-fg-yellow/15 text-gray-900 dark:text-gray-100 font-medium'
                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800'
            }`}
          >
            {c.start}–{c.end}
            {/* The count is the reason to trust the order, so it stays on the face. */}
            <span className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}
