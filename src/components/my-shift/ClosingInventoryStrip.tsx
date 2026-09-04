// The three standing numbers above the write-up — `Logged · Available · Carrying`.
//
// ⚠️⚠️ THIS WAS IN THE GREENLIT MOCK AND NEVER GOT WIRED. `useClosingInventory` has computed
// `carriedRow` since pass 2 and **nothing consumed it** — so the surface's central mechanic, the
// thing the whole two-carry design exists for, was invisible. Aaron found the gap by remembering the
// mock across a compaction that had cost me it.
//
// ⚠️ AND `Carrying` IS NOT THE TALLY. He caught that conflation once already: *"I have available
// cars in 3 different rows but only shows the last row I used."* This is what the NEXT car inherits;
// the row chips under the sheet are where the cars actually are. Both are shown, and they are never
// the same statement.
import { rowLabel, STATUS_LABELS, type InventoryStatus } from '../../lib/closingInventory';

export function ClosingInventoryStrip({ logged, available, carriedStatus, carriedRow }: {
  logged: number;
  available: number;
  carriedStatus: InventoryStatus | null;
  carriedRow: string;
}) {
  // ⭐ The mock shows the carried ROW here, because the status carry is already visible on the card
  // whenever a car is in hand — but before the FIRST car there is nothing carrying at all, and
  // saying so is the honest empty state rather than a zero.
  const carrying = [
    carriedStatus ? STATUS_LABELS[carriedStatus] : '',
    carriedStatus === 'A' ? rowLabel(carriedRow) : '',
  ].filter(Boolean).join(' · ');

  return (
    <dl className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
      <Stat label="Logged" value={String(logged)} />
      <Stat label="Available" value={String(available)} />
      <Stat label="Carrying" value={carrying || '—'} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="truncate text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}
