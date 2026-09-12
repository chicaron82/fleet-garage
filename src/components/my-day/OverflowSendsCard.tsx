import { useState } from 'react';
import { useOverflowSends } from '../../hooks/useOverflowSends';
import type { OverflowDay } from '../../../api/_lib/overflowManifest';
import { shiftDateStr } from '../../lib/shiftDay';

// What went to the overflow spots, newest day first — the slot the "held too long" card used to hold.
//
// ⭐ WHY THE SWAP (Aaron, 2026-09-11). The old card counted vehicles held too long, and he called it
// what it was: *"there's really nothing I can do about it. So it's pretty much just noise."* Those
// cars wait on a shop or a manager — someone else's queue.
//
// ⭐ AND WHY IT SHOWS HISTORY, NOT TODAY. The first build answered "what went out today", which on a
// normal day is nothing: a blank card in the slot he had just cleared of noise. *"Ahh I was thinking
// to show what was last sent there… Showing the latest send. Expand to see more."* So it opens on the
// last day that HAS sends — today when there were any, otherwise the 9th, or whenever it last was.
//
// ⭐ Reads through Effie's own grouping (hooks/useOverflowSends → api/_lib/overflowManifest), so the
// card and "what did we send today?" in chat can never give different answers.
//
// ⚠️ NOT a single tap target any more. It was one big button; an expandable card cannot be, because
// the expand toggle would be a button inside a button. Navigation now lives on "Movement log →".

/** A date the way he'd say it — "Today", "Yesterday", else "September 9". */
function dayHeading(date: string): string {
  if (date === shiftDateStr(0)) return 'Today';
  if (date === shiftDateStr(-1)) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  // ⚠️ Formatted in UTC off the parts. `new Date('2026-09-09')` is midnight UTC, which is still the
  // 8th in Winnipeg — the classic off-by-one that would date every send a day early.
  return new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

function DayBlock({ day }: { day: OverflowDay }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{dayHeading(day.date)}</p>
      {/* Two fixed columns, his layout. A spot with nothing that day keeps its place and shows a
          dash — "nothing went to AV Flight" is an answer, and moving columns around is not. */}
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2">
        {day.groups.map(g => (
          <div key={g.destination} className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {g.destination}
              {g.count > 0 && <span className="tabular-nums text-gray-400 dark:text-gray-500"> · {g.count}</span>}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {g.vehicles.length === 0 ? (
                <li className="text-xs text-gray-400 dark:text-gray-600">—</li>
              ) : (
                g.vehicles.map((v, i) => (
                  <li key={`${g.destination}-${i}`} className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{v}</li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverflowSendsCard({ onOpen }: { onOpen: () => void }) {
  const { days, loading } = useOverflowSends();
  const [showAll, setShowAll] = useState(false);
  if (loading) return null;

  const [latest, ...earlier] = days;

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sent to overflow
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
        >
          Movement log →
        </button>
      </div>

      {!latest ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nothing has gone to AV Flight or FastAir yet.</p>
      ) : (
        <>
          <div className="mt-2 space-y-4">
            <DayBlock day={latest} />
            {showAll && earlier.map(d => <DayBlock key={d.date} day={d} />)}
          </div>
          {earlier.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {showAll ? 'Show less' : `Show ${earlier.length} earlier ${earlier.length === 1 ? 'day' : 'days'}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
