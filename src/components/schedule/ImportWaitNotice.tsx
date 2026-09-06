import { useEffect, useState } from 'react';

// What he sees while the sheet is being read.
//
// ⭐ WHY THE COUNTER. The old state was a pulsing "Reading the schedule…". It was never blank — but a
// pulse LOOPS, and anything that loops is indistinguishable from stuck after about ten seconds.
// Aaron, 2026-09-05: *"after maybe 10 seconds i left it to do its own thing and continued watching
// some dramas in another tab."* ⭐⭐ **Ten seconds is his walk-away point**, so this UI's job is not
// to hold his attention — it is to be readable at a glance from a tab he has come BACK to. A number
// that counts up cannot look frozen.
//
// ⚠️ NO PROGRESS BAR, DELIBERATELY. `startParse` fires one fetch and awaits the whole thing; the
// client cannot see how far along the vision model is. A bar that advances on a timer is a lie that
// gets caught on the one import that fails. **Duration is real; progress is not.**
//
// ⚠️ The API can fall back to a BACKUP vision model (the `degraded` flag on the response), which
// roughly doubles the wait — so past 25s the copy says so rather than insisting all is well.
const STAGES: readonly { after: number; text: string }[] = [
  { after: 0,  text: 'Reading the schedule…' },
  { after: 10, text: 'Still reading — a full sheet takes a moment.' },
  { after: 25, text: 'Taking longer than usual. It may be on a second read.' },
  { after: 60, text: 'Still going. It has not given up, and neither has it failed.' },
];

export function ImportWaitNotice({ startedAt }: { startedAt: number | null }) {
  const [secs, setSecs] = useState(() => (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0));

  useEffect(() => {
    if (startedAt == null) return;
    // Re-derived from the clock each tick rather than incremented, so a backgrounded tab that
    // throttles timers comes back showing the TRUE elapsed time instead of a count that fell behind.
    const tick = () => setSecs(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) return null;
  const stage = [...STAGES].reverse().find(s => secs >= s.after) ?? STAGES[0];
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-baseline justify-center gap-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">{stage.text}</p>
      <span
        className="text-sm tabular-nums text-gray-400 dark:text-gray-500"
        // Read out on its own, so a screen reader gets the elapsed time without the prose repeating.
        aria-label={`${secs} seconds elapsed`}
      >
        {mmss}
      </span>
    </div>
  );
}
