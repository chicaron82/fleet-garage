import type { ExtraBlock } from '../../types';
import { blockCrewSide } from '../../lib/rosterCount';

// The [+] row under Actual Hours: more hours worked the same day, as their own start/end.
//
// ⭐ WHY IT EXISTS. Aaron, 2026-10-26: opened 06:45–15:15, went home, and was asked back for 17:00–21:00
// because the closing VSA called in sick. A day has one shifts row and one actual start/end, so 06:45–21:00
// would have paid the 1h45 he was at home. His fix: *"maybe a [+] line?"* … *"Under log actual hours"*.
//
// ⭐ THE CREW TICK (docs/ticket-plus-block-crew-tick.md). 2026-11-04 the close read "roster shows 1" with him on it.
// His fix: *"an explicit check to the added hours. ✅ If closing"*, then *"make it smart depending on when the hours
// are added"*. The label follows the times: a block before the main hours offers ✅ Opening crew, one after offers
// ✅ Closing crew, and a block with no start yet offers nothing. Unticked by default: the roster counts his word only.
//
// Untouched it is one quiet button, so a normal day is still zero taps. A new block starts blank rather
// than guessing a time; a block left half-typed is dropped on Save (ScheduleContext.logActualHours).
const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition';

const CREW_LABEL = { opening: 'Opening crew', closing: 'Closing crew' } as const;

export function ShiftExtraBlocks({ blocks, onChange, mainStart, mainEnd }: {
  blocks: ExtraBlock[];
  onChange: (blocks: ExtraBlock[]) => void;
  /** The day's main hours as typed above, so the crew tick can say which side a block sits on. */
  mainStart?: string;
  mainEnd?: string;
}) {
  const edit = (i: number, patch: Partial<ExtraBlock>) =>
    onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        const side = blockCrewSide(mainStart, mainEnd, b);
        return (
          <div key={i} className="space-y-1">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">More hours</p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                type="time"
                aria-label={`More hours ${i + 1} start`}
                value={b.start}
                onChange={e => edit(i, { start: e.target.value })}
                className={inputClass}
              />
              <input
                type="time"
                aria-label={`More hours ${i + 1} end`}
                value={b.end}
                onChange={e => edit(i, { end: e.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                aria-label={`Remove more hours ${i + 1}`}
                onClick={() => onChange(blocks.filter((_, j) => j !== i))}
                className="min-h-[36px] px-2.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            {side && (
              <label className="flex items-center gap-2.5 min-h-[36px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={b.crew === side}
                  onChange={e => edit(i, { crew: e.target.checked ? side : undefined })}
                  className="w-4 h-4 rounded accent-yellow-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{CREW_LABEL[side]}</span>
              </label>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...blocks, { start: '', end: '' }])}
        className="min-h-[36px] px-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 transition cursor-pointer"
      >
        + Add hours
      </button>
    </div>
  );
}
