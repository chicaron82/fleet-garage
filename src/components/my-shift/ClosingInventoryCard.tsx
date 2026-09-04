// The car that was just scanned, waiting to go on the sheet.
//
// ⭐ Four of the five columns are already filled from the tag — owning area, unit, licence, class.
// The ONLY thing he decides is the status, and for an available car, the row.
//
// His shape, from six rounds on the mock (2026-09-02): *"chips for status, free text for reasons"*
// and *"for available I'd put a tapable Row: [1][2][3][4][5] more.. — more expands to show the
// overflow 6-12 and other."*
import { useState } from 'react';
import {
  ROW_CAPACITY, STATUS_LABELS, rowLabel, suggestBand,
  type InventoryEntry, type InventoryStatus,
} from '../../lib/closingInventory';

const STATUSES: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

/** ⭐ His words: *"how bout just 'skip - no need to record (sale/TB/BB)'"* — one line, not a lecture. */
export function ClosingInventoryExclusion({ plate, reason, onSkip, onAnyway }: {
  plate: string; reason: string; onSkip: () => void; onAnyway: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 space-y-2">
      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{plate} — {reason}</p>
      <p className="text-[11px] text-amber-700 dark:text-amber-400">Skip — no need to record (sale / TB / BB).</p>
      <div className="flex gap-2">
        <button type="button" onClick={onSkip}
          className="flex-1 rounded-lg bg-amber-600 text-white text-xs font-semibold py-2 cursor-pointer hover:bg-amber-700 transition">Skip it</button>
        <button type="button" onClick={onAnyway}
          className="flex-1 rounded-lg border border-amber-300 dark:border-amber-800 text-xs font-semibold py-2 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition">Add anyway</button>
      </div>
    </div>
  );
}

export function ClosingInventoryCard({
  entry, why, suggestedRow, onChange, onAdd, onSkip,
  addLabel = 'Add to sheet', skipLabel = 'Skip',
}: {
  entry: InventoryEntry;
  /** Why FG picked this status, or that it simply carried. Shown, never silent. */
  why: string | null;
  suggestedRow: string | null;
  onChange: (patch: Partial<InventoryEntry>) => void;
  onAdd: () => void;
  onSkip: () => void;
  /** ⭐ So the SAME card can edit a row already on the sheet — *"a new damage brought in after i've
   *  already recorded all the damages"*. One editor, not a second one that can drift from it. */
  addLabel?: string;
  skipLabel?: string;
}) {
  const [moreRows, setMoreRows] = useState(false);
  const band = suggestBand(entry.rentalClass);
  const overflow = Object.keys(ROW_CAPACITY).filter(r => !['1', '2', '3', '4', '5'].includes(r));

  const rowChip = (value: string, label: string) => {
    const on = entry.row === value;
    const suggested = !on && value === suggestedRow;
    return (
      <button key={value} type="button" onClick={() => onChange({ row: value })} aria-pressed={on}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition ${
          on ? 'bg-gray-900 border-gray-900 text-white dark:bg-gray-100 dark:border-gray-100 dark:text-gray-900'
            : suggested ? 'border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
        }`}>{label}</button>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 space-y-3">
      <div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{entry.plate}</span>
        <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
          {[entry.owningArea, entry.unitNumber, entry.rentalClass].filter(Boolean).join(' · ') || 'not in the fleet'}
        </span>
      </div>

      <div>
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
          Status{why && <span className="ml-1 font-normal italic">— {why}</span>}
        </p>
        <div className="flex gap-1.5">
          {STATUSES.map(s => (
            <button key={s} type="button" onClick={() => onChange({ status: s })} aria-pressed={entry.status === s}
              title={STATUS_LABELS[s]}
              className={`flex-1 py-2 rounded-lg text-sm font-bold border cursor-pointer transition ${
                entry.status === s ? 'bg-gray-900 border-gray-900 text-white dark:bg-gray-100 dark:border-gray-100 dark:text-gray-900'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* ⭐ THE ROW ONLY EXISTS FOR AN AVAILABLE CAR. For a B or an M the note is a reason, not a
          place, so showing a row picker would invite him to record a lie. */}
      {entry.status === 'A' && (
        <div>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
            Row{band && <span className="ml-1 font-normal italic">— class {entry.rentalClass} sits in {band.map(r => rowLabel(r)).join('/')}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['1', '2', '3', '4', '5'].map(r => rowChip(r, rowLabel(r)))}
            {!moreRows && (
              <button type="button" onClick={() => setMoreRows(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 cursor-pointer">more…</button>
            )}
            {moreRows && overflow.map(r => rowChip(r, rowLabel(r)))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
        <input type="text" value={entry.note} onChange={e => onChange({ note: e.target.value })}
          placeholder={entry.status === 'B' ? 'chip? dent?' : entry.status === 'M' ? 'PM? low tire? check engine?' : 'optional'}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-xs text-gray-900 dark:text-gray-100" />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onSkip}
          className="rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">{skipLabel}</button>
        <button type="button" onClick={onAdd} disabled={!entry.row && entry.status === 'A'}
          className="flex-1 rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs font-semibold py-2 cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {addLabel}
        </button>
      </div>
    </div>
  );
}
