import { useState } from 'react';
import { flipRowLine, flipClassSummary } from '../../lib/airportFlip';
import type { FlipRow } from '../../lib/airportFlip';
import type { AirportFlip } from '../../hooks/useAirportFlip';

// The flip's row list — what's been turned around this shift, and the counter copy-out.
//
// Split out of AirportFlipSection, which had grown to two lines under the 330 cap with two
// distinct jobs inside it: CAPTURE one returning car, and LIST the shift's rows. This is the
// second. It takes the flip hook itself rather than a dozen unpacked fields, which is what keeps
// the seam from becoming a props explosion (FG's >10-props rule) — the hook IS the interface.
//
// `sentExpanded` lives here, not in the parent: it's local view state about this list's own
// presentation, and nothing above it can act on it.

/** One row, reused for the always-open unsent list and the collapsed sent group. */
function Row({ r, flip }: { r: FlipRow; flip: AirportFlip }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${r.sent ? 'border-gray-100 dark:border-gray-800 opacity-55' : 'border-gray-200 dark:border-gray-700'}`}>
      {r.sent ? (
        <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 shrink-0 w-12">✓ Sent</span>
      ) : (
        <input type="checkbox" checked={r.checked} onChange={() => flip.toggleChecked(r.id)} className="w-4 h-4 accent-fg-yellow cursor-pointer shrink-0" />
      )}
      {r.rentalClass && (
        <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 dark:text-indigo-300 shrink-0">{r.rentalClass}</span>
      )}
      <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{flipRowLine(r)}</span>
      {!r.sent && <button type="button" aria-label="Remove" onClick={() => flip.remove(r.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xs shrink-0 cursor-pointer">✕</button>}
    </div>
  );
}

/** Aaron's own shift tally, by class. Deliberately NOT in the counter copy-out — they search by plate. */
function ClassTally({ rows }: { rows: FlipRow[] }) {
  const { byClass, unclassed } = flipClassSummary(rows);
  if (byClass.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
      <span className="font-medium">Turned around:</span>
      {byClass.map(c => (
        <span key={c.rentalClass} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-semibold text-gray-700 dark:text-gray-300">
          {c.rentalClass} ×{c.count}
        </span>
      ))}
      {unclassed > 0 && <span className="text-gray-400 dark:text-gray-500">· {unclassed} unclassed</span>}
    </div>
  );
}

export function FlipRowsList({ flip, onCopy }: { flip: AirportFlip; onCopy: () => void }) {
  // Sent rows collapse by default: once a car's dispatched it's done, and a shift of them buries
  // the scan button and the still-to-send rows under dead scroll (Aaron, live 2026-07-28).
  const [sentExpanded, setSentExpanded] = useState(false);

  if (flip.rows.length === 0) return null;

  const unsentRows = flip.rows.filter(r => !r.sent);
  const sentRows = flip.rows.filter(r => r.sent);

  return (
    <div className="space-y-1.5">
      {/* Still-to-send rows stay open — the ones that still need a decision + drive the scan/copy flow. */}
      {unsentRows.map(r => <Row key={r.id} r={r} flip={flip} />)}

      {sentRows.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setSentExpanded(v => !v)}
            className="w-full flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition"
          >
            <span>✓ {sentRows.length} sent</span>
            <span className="text-gray-400 dark:text-gray-500">{sentExpanded ? 'collapse ▲' : 'tap to expand ▼'}</span>
          </button>
          {sentExpanded && <div className="space-y-1.5 mt-1.5">{sentRows.map(r => <Row key={r.id} r={r} flip={flip} />)}</div>}
        </div>
      )}

      <ClassTally rows={flip.rows} />

      <button
        type="button"
        onClick={onCopy}
        disabled={flip.checkedUnsentCount === 0}
        className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
      >
        📋 Copy {flip.checkedUnsentCount} for the counter
      </button>
    </div>
  );
}
