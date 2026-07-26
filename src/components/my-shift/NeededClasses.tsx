import { useState } from 'react';
import { loadOverrides, toggleOverride, CLASS_GROUPS, CLASS_LABELS, ALL_RENTAL_CLASSES } from '../../lib/classOverrides';
import type { RentalClass } from '../../data/manifest';

interface Props {
  /** Rental classes turned around this shift (UPPERCASE), for satisfied-state matching. */
  flippedClasses: Set<string>;
}

// The "needed now" strip on the Airport Flip card — the airport override (DEMAND) surfaced right
// where Aaron works the returns (SUPPLY), so he sees what's needed and watches each class satisfy
// as he flips a match. Reads/writes the same per-day override store the Manifest + trip form use
// (loadOverrides/toggleOverride), so a class marked here also drives the trip form's "Must fulfill".
//
// Ungated on purpose: FG is Aaron's personal tool, sole user (project_fg_scope_boundary, 2026-07-26)
// — he's the one hearing "we need a T", so marking needed lives where he stands. No role check.
// Satisfied = boolean/first-flip: a needed class ticks ✓ the moment ANY flip row carries it.
export function NeededClasses({ flippedClasses }: Props) {
  const [needed, setNeeded] = useState<Set<RentalClass>>(() => loadOverrides());
  const [picking, setPicking] = useState(false);

  const toggle = (cls: RentalClass) => setNeeded(toggleOverride(cls));
  const satisfied = (cls: RentalClass) => flippedClasses.has(cls.toUpperCase());
  const neededList = ALL_RENTAL_CLASSES.filter(c => needed.has(c)); // stable common→specialty order

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
          🚨 Needed
        </span>
        {neededList.length === 0 && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">nothing flagged</span>
        )}
        {neededList.map(cls => {
          const done = satisfied(cls);
          return (
            <button
              key={cls}
              type="button"
              onClick={() => toggle(cls)}
              title={`${CLASS_LABELS[cls] ?? cls}${done ? ' — flipped ✓ (tap to clear)' : ' — needed (tap to clear)'}`}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold border transition cursor-pointer ${
                done
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}
            >
              {done ? '✓ ' : ''}{cls}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPicking(p => !p)}
          aria-label="Mark a class needed"
          className="rounded-md px-1.5 py-0.5 text-[11px] font-bold border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-500 transition cursor-pointer"
        >
          {picking ? '×' : '+'}
        </button>
      </div>

      {picking && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-2 space-y-1.5">
          {CLASS_GROUPS.map(group => (
            <div key={group.label} className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 w-10 shrink-0">{group.label}</span>
              {group.classes.map(cls => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggle(cls)}
                  title={CLASS_LABELS[cls] ?? cls}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold border transition cursor-pointer ${
                    needed.has(cls)
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 text-orange-700 dark:text-orange-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
