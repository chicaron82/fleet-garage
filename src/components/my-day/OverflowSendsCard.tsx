import { useOverflowSends } from '../../hooks/useOverflowSends';

// What went to the overflow spots today — the slot the "held too long" card used to occupy.
//
// ⭐ WHY THE SWAP (Aaron, 2026-09-11). The old card counted vehicles held too long, and he called it
// what it was: *"there's really nothing I can do about it. So it's pretty much just noise."* Those
// cars wait on a shop or a manager — someone else's queue. He asked for the slot to carry something
// he acts on instead: *"What was sent to AV Flight/FastAir and when"*.
//
// ⭐ Reads through Effie's own grouping (hooks/useOverflowSends → api/_lib/overflowManifest), so the
// card and "what did we send today?" in chat can never give different answers.
//
// ⚠️ NOT silent when empty. Most FG cards hide themselves with nothing to say; this one reports the
// quiet day out loud, because "nothing went to overflow today" is itself the answer he'd otherwise
// go to the Movement Log to confirm.
export function OverflowSendsCard({ onOpen }: { onOpen: () => void }) {
  const { groups, total, loading } = useOverflowSends();
  if (loading) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 text-left transition-colors hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sent to overflow today
        </p>
        <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">Movement log →</span>
      </div>

      {total === 0 ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nothing sent to AV Flight or FastAir today.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {groups.map(g => (
            <div key={g.destination}>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {g.destination} <span className="tabular-nums text-gray-400 dark:text-gray-500">· {g.count}</span>
              </p>
              {/* Plate then time, the way the manifest reads — one line per SEND, so a car sent
                  twice shows twice rather than collapsing into a single misleading row. */}
              <ul className="mt-0.5 space-y-0.5">
                {g.vehicles.map((v, i) => (
                  <li key={`${g.destination}-${i}`} className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{v}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
