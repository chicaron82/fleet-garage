// "Today so far" as big tiles, for the read-only link on a desktop (docs/ticket-lot-view-desktop-layout.md).
//
// Aaron, 2026-11-19, on the first desktop mock: *"The left column feels bare with all that negative space especially the
// deeper the day goes and the list growing"*. The fill is what was already there: the bay log's own chips, grown into
// tiles on the left so the list gets the right side to itself. Same counts, same filters, same read-only words.
//
// ⚠️ Counts only, never a pace. A cars-per-hour view would fill the space too, but its dips would show exactly when he
// was on break, on a link his manager reads (the no-break-times rule, LotViewPage.tsx).
import type { ReactNode } from 'react';
import { baySummary, type BayLogRow } from '../../lib/lotBayLog';
import type { BayFilter } from '../../lib/bayListView';

const TILE = 'flex flex-col justify-start rounded-2xl border px-4 py-5 text-left';

export function BayTodayTiles({ rows, filter, onFilter }: {
  rows: BayLogRow[]; filter: BayFilter | null; onFilter: (f: BayFilter | null) => void;
}) {
  const s = baySummary(rows);
  if (s.total === 0) return null;
  // A filter whose last car was undone falls away with its tile, the same rule as the chips (BayLogList).
  const on = filter && s[filter] > 0 ? filter : null;
  const toggle = (f: BayFilter) => onFilter(on === f ? null : f);
  return (
    <section aria-label="Today so far" className="space-y-1">
      <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Today so far</h2>
      <div className="grid grid-cols-3 gap-2">
        {/* The total is the list's "show all", like its chip. */}
        <Tile n={s.total} what="through the bay" onTap={() => onFilter(null)} pressed={false}
          tone="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <Tile n={s.clean} what="clean" tone="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300" />
        {s.erin > 0 && <Tile n={s.erin} what="for Erin St" onTap={() => toggle('erin')} pressed={on === 'erin'}
          tone="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300" />}
        {s.bhold > 0 && <Tile n={s.bhold} what="held, damage" onTap={() => toggle('bhold')} pressed={on === 'bhold'}
          tone="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300" />}
        {s.mhold > 0 && <Tile n={s.mhold} what="held, mechanical" onTap={() => toggle('mhold')} pressed={on === 'mhold'}
          tone="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" />}
        {s.stillToDo > 0 && <Tile n={s.stillToDo} what="still to do"
          tone="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300" />}
      </div>
    </section>
  );
}

function Tile({ n, what, tone, onTap, pressed }: { n: number; what: string; tone: string; onTap?: () => void; pressed?: boolean }) {
  const body: ReactNode = (
    <>
      <b className="block text-5xl font-extrabold leading-none tabular-nums">{n}</b>
      <span className="mt-2 block text-base font-semibold opacity-80">{what}</span>
    </>
  );
  if (!onTap) return <div className={`${TILE} ${tone}`}>{body}</div>;
  return (
    <button type="button" onClick={onTap} aria-pressed={pressed}
      className={`${TILE} ${tone} cursor-pointer hover:brightness-95 dark:hover:brightness-110 ${pressed ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100 dark:ring-offset-gray-950' : ''}`}>
      {body}
    </button>
  );
}
