// 🔍 Find in the log (2026-11-10, docs/ticket-bay-log-find-a-car.md): a plate, then every time it came through the bay.
// Shared by Lot Lookout (the whole log; a result opens that day) and the read-only /lot/view (the last 14 days, his
// ruling, and the results are the answer: that page has no day record). Reading only.
import { useState } from 'react';
import { useBayFind } from '../../hooks/useBayFind';
import { bayAppearances, FIND_MIN, READ_ONLY_DAYS, type BayAppearance } from '../../lib/bayFind';
import { shiftDateStr } from '../../lib/shiftDay';

export function BayFind({ readOnly = false, onOpenDay }: { readOnly?: boolean; onOpenDay?: (back: number) => void }) {
  const [typed, setTyped] = useState('');
  const find = useBayFind(typed, readOnly ? READ_ONLY_DAYS : undefined);
  const lines = find.rows ? bayAppearances(find.rows, shiftDateStr(), { readOnly }) : null;
  const short = typed.trim() !== '' && !find.key;
  return (
    <section aria-label="Find in the log" className="space-y-1.5">
      <input type="search" value={typed} onChange={e => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off"
        placeholder={readOnly ? `🔍 Find a plate · last ${READ_ONLY_DAYS} days` : '🔍 Find a plate in the log'}
        aria-label="Find a plate in the bay log"
        className="w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans text-gray-900 dark:text-gray-100" />
      {short && <p className="px-1 text-xs text-gray-500 dark:text-gray-400">Type {FIND_MIN} or more of the plate.</p>}
      {find.key && find.error && <p role="alert" className="px-1 text-xs font-semibold text-red-700 dark:text-red-400">{find.error}</p>}
      {find.key && !find.error && !lines && <p className="px-1 text-xs text-gray-500 dark:text-gray-400">Looking…</p>}
      {lines && lines.length === 0 && (
        <p className="px-1 text-sm text-gray-600 dark:text-gray-300">
          {find.key} hasn't come through the bay{readOnly ? ` in the last ${READ_ONLY_DAYS} days` : ''}.
        </p>
      )}
      {lines && lines.length > 0 && (
        <ol aria-label="Found in the bay log" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {lines.map(l => <li key={l.id}><FoundLine l={l} onOpenDay={onOpenDay} /></li>)}
        </ol>
      )}
    </section>
  );
}

function FoundLine({ l, onOpenDay }: { l: BayAppearance; onOpenDay?: (back: number) => void }) {
  const body = (
    <span className="flex items-center gap-3 px-3 py-2 text-left">
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{l.plate}</span>
        {l.car && <span className="block truncate text-xs text-gray-600 dark:text-gray-300">{l.car}</span>}
        {l.note && <span className="block text-xs text-gray-600 dark:text-gray-300">📝 {l.note}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{l.dayLabel}</span>
        <span className="block text-xs text-gray-600 dark:text-gray-300">{l.label}{l.time ? ` ${l.time}` : ''}</span>
        {l.sentUp && <span className="block text-[11px] font-bold text-sky-700 dark:text-sky-300">✈ sent up</span>}
      </span>
    </span>
  );
  if (!onOpenDay) return body;
  return (
    <button type="button" onClick={() => onOpenDay(l.back)} aria-label={`${l.plate}, ${l.dayLabel}: open that day`}
      className="block w-full cursor-pointer touch-manipulation hover:bg-gray-50 dark:hover:bg-gray-800">
      {body}
    </button>
  );
}
