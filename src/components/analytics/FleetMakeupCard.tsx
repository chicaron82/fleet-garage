import { useMemo, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { fleetMakeup } from '../../lib/fleetMakeup';

// What the fleet is made of — models per make, inside "What FG has recorded".
//
// ⭐ Aaron, 2026-09-19: *"how much of each model we have for the makes we have in the fleet"*, and
// *"inside what FG has recorded"*. The rules live in src/lib/fleetMakeup.ts; the design trail in
// docs/September/ticket-what-the-fleet-is-made-of.md.
//
// ⭐⭐ THE CLASS COLUMN IS THE POINT. A model list alone is a census; the class beside it is what he
// reasons with — the Kicks straddles B4/B5, the Sportage E6/Q4, the Model 3 four. Sixteen makes and
// sixty model rows is a long thumb-drag at 412px, so the makes collapse and the models hide inside.

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4';

export function FleetMakeupCard({ vehicles }: {
  vehicles: readonly { make?: string | null; model?: string | null; rentalClass?: string | null }[];
}) {
  const makes = useMemo(() => fleetMakeup(vehicles), [vehicles]);
  const [open, setOpen] = useState<string | null>(null);

  if (makes.length === 0) return null;

  const total = makes.reduce((t, m) => t + m.count, 0);
  const biggest = makes[0].count;

  return (
    <div className={CARD}>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">What the fleet is made of</p>
      {/* ⚠️ "holds", not "has available" — this counts the record, not the lot. */}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        {total} cars · {makes.length} makes · {makes.reduce((t, m) => t + m.models.length, 0)} models.
        What the branch <b>holds</b> — not what is on the lot right now. Tap a make for its models.
      </p>

      <div className="mt-3 space-y-1">
        {makes.map(m => {
          const expanded = open === m.make;
          return (
            <div key={m.make}>
              <button
                type="button"
                onClick={() => { hapticLight(); setOpen(o => (o === m.make ? null : m.make)); }}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2 text-[11px] py-0.5 cursor-pointer"
              >
                <span className="w-3 text-gray-400 dark:text-gray-500">{expanded ? '▾' : '▸'}</span>
                <span className="w-20 text-left font-semibold text-gray-900 dark:text-gray-100 truncate">{m.make}</span>
                {/* Share of the BIGGEST make, not of the fleet — at 24% every bar would be a stub. */}
                <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <span className="block h-full rounded-full bg-fg-yellow" style={{ width: `${Math.round((m.count / biggest) * 100)}%` }} />
                </span>
                <span className="tabular-nums w-8 text-right text-gray-600 dark:text-gray-300">{m.count}</span>
                <span className="tabular-nums w-12 text-right text-gray-400 dark:text-gray-500">
                  {m.models.length} mdl
                </span>
              </button>

              {expanded && (
                <div className="ml-5 mb-1.5 space-y-0.5">
                  {m.models.map(md => (
                    <div key={md.model} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 text-gray-600 dark:text-gray-300 truncate">{md.model}</span>
                      {/* ⭐ The classes this model rents as. Two chips mean a real split — a model-year
                          move (Kicks B4/B5) or a hybrid twin (Sportage E6/Q4), never noise. */}
                      <span className="flex gap-1">
                        {md.classes.map(c => (
                          <span key={c} className="font-mono text-[10px] px-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                            {c}
                          </span>
                        ))}
                      </span>
                      <span className="tabular-nums w-8 text-right text-gray-500 dark:text-gray-400">{md.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
