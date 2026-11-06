// On break (2026-11-05, migration 166, docs/ticket-lot-bay-on-break.md). Aaron: *"what do you think of a "on break"
// button for me ... since i'm off the floor the count would be inaccurate. a heads up on the read-only side?"*.
// Off a break it is one quiet button beside Erin St's heading; on one, a strip that says what the read-only page shows,
// with Back. Any tap on the count or the bay log ends a break by itself (src/lib/countKept.ts), so Back is optional.

export function BayBreakButton({ onBreak }: { onBreak: () => void }) {
  return (
    <button type="button" onClick={onBreak}
      className="rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
      On break
    </button>
  );
}

export function BayBreakStrip({ onBack }: { onBack: () => void }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 px-4 py-2.5">
      <p className="text-sm text-sky-900 dark:text-sky-100">
        <span className="font-bold">On break.</span> The read-only page says the count is paused. Any tap ends it.
      </p>
      <button type="button" onClick={onBack}
        className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 cursor-pointer">
        Back
      </button>
    </div>
  );
}
