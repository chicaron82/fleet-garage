// The running sheet — what has been written up so far, and where the available cars actually are.
//
// ⭐ Mirrors form 8073-16's own columns and nothing else. `Mileage`, `AM Check` and `Arrived
// Overnight` are blank on both of Aaron's PM sheets because they belong to the morning pass;
// rendering them would be theatre.
import { groupEntries, rowLabel, sheetNote, STATUS_LABELS, type InventoryEntry, type RowTally } from '../../lib/closingInventory';

export function ClosingInventorySheet({ entries, tally, onRemove, onEdit, onUndo }: {
  entries: readonly InventoryEntry[];
  tally: readonly RowTally[];
  /** *"sometimes drivers need a vehicle that i've already written up"* — the world changed. */
  onRemove: (index: number) => void;
  /** ⭐ *"a new damage brought in after i've already recorded all the damages"* — a car's status can
   *  change AFTER it is on the sheet, and re-scanning to fix it is not a workflow. */
  onEdit: (index: number) => void;
  /** A MIS-ENTRY, not a change in the world — takes the last row straight back off. */
  onUndo: () => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-gray-500 dark:text-gray-400 italic px-1">
        Nothing written up yet. Scan a key tag to start the sheet.
      </p>
    );
  }

  /** ⭐ Grouping takes away the one thing scan order gave him for free: the car he just scanned
   *  landing at the BOTTOM where he could see it arrive. So it gets marked instead — otherwise a
   *  sorted sheet answers "what are my piles" while quietly losing "did that last one go in?". */
  const newest = entries.length - 1;

  return (
    <div className="space-y-2">
      {/* ⭐ Undo-last was in the greenlit mock and never got wired. It is NOT the per-row ×: this
          one means "I entered that wrong", the × means a driver took the car. */}
      <div className="flex justify-end">
        <button type="button" onClick={onUndo}
          className="text-[11px] font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer transition">
          ↩ Undo last
        </button>
      </div>
      {/* ⚠️ THIS IS NOT THE CARRIED ROW. Aaron caught the first version showing one row while his
          sheet held available cars in three — the carry is what the NEXT car inherits, this is
          where they are. Conflating them put a label over a value that meant something else. */}
      {tally.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tally.map(t => (
            <span key={t.row}
              className={`text-[11px] px-2 py-0.5 rounded-full tabular-nums border ${
                t.full
                  ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
              {t.label} {t.count}{t.capacity ? `/${t.capacity}` : ''}{t.full ? ' full' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-1 pr-2 font-medium">Own</th>
              <th className="py-1 pr-2 font-medium">Unit</th>
              <th className="py-1 pr-2 font-medium">Licence</th>
              <th className="py-1 pr-2 font-medium">Cls</th>
              <th className="py-1 pr-2 font-medium">St</th>
              <th className="py-1 pr-2 font-medium w-full">Notes</th>
              <th className="py-1 sr-only">Edit or remove</th>
            </tr>
          </thead>
          {/* ⭐⭐ IN PILES, the same ones the copied report prints — `groupEntries` owns the order for
              both. Aaron after his first 24-car sweep: *"I thought it was going to sort both my scans
              AND the version I copy to the email."* It sorted one of them, so the sheet he worked
              from and the text he sent the counter were two different documents.
              ⚠️⚠️ `i` HERE IS THE SHEET INDEX, not the drawn position — `onEdit`/`onRemove` address
              rows by position, and passing the display order would delete a different car than the
              one under his thumb. That is why `groupEntries` returns pairs. */}
          {groupEntries(entries).map(g => (
            <tbody key={g.status}>
              <tr>
                <th colSpan={7} scope="colgroup"
                  className="pt-3 pb-1 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {STATUS_LABELS[g.status]}{' '}
                  <span className="font-medium tabular-nums">({g.rows.length})</span>
                </th>
              </tr>
              {g.rows.map(({ entry: e, index: i }) => (
              <tr key={`${e.plate}-${i}`}
                className={`border-b border-gray-100 dark:border-gray-800 last:border-0${
                  i === newest ? ' bg-gray-50 dark:bg-gray-800/40' : ''}`}>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.owningArea ?? '—'}</td>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.unitNumber ?? '—'}</td>
                <td className="py-1 pr-2 font-semibold text-gray-900 dark:text-gray-100">
                  {e.plate}{i === newest && <span className="sr-only"> — most recently scanned</span>}
                </td>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.rentalClass ?? '—'}</td>
                <td className="py-1 pr-2 font-bold text-gray-900 dark:text-gray-100"
                  title={STATUS_LABELS[e.status]}>{e.status}</td>
                <td className="py-1 pr-2 text-gray-600 dark:text-gray-300">{sheetNote(e) || '—'}</td>
                {/* ⚠️⚠️ 44px EACH, AND HELD APART. Aaron on his phone, 2026-09-04: *"the edit and x
                    are tiny and too closer together. fat finger syndrome will make me accidentally
                    tap something I didn't mean to tap."*
                    ⭐ THIRD INSTANCE OF A DOCUMENTED BUG. `PreferencesContext` already records the
                    header ℹ️ sitting `ml-0.5` from 📷 — *"a thumb reaching for the scanner opened a
                    guide modal instead, on the lot, tag in hand"* — and the fix that worked for the
                    bell was a DIVIDER AND A GAP. FG's own standard is 44px, gloves on; this row was
                    ~16px with 4px between.
                    ⚠️ And the two are NOT equivalent: a mis-tapped ✎ opens an editor he cancels, a
                    mis-tapped × deletes a row he cannot get back — `Undo last` only lifts the LAST
                    one, so row 3 of 40 is gone. The destructive one goes last, alone, past the rule. */}
                <td className="py-1 text-right whitespace-nowrap">
                  <span className="inline-flex items-center">
                    <button type="button" onClick={() => onEdit(i)}
                      aria-label={`Edit ${e.plate}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-base text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 cursor-pointer transition">✎</button>
                    <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
                    <button type="button" onClick={() => onRemove(i)}
                      aria-label={`Remove ${e.plate}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer transition">×</button>
                  </span>
                </td>
              </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        A available · D dirty · B body · M mechanical · F foreign (US plate).
        {' '}Rows written {rowLabel('1')}–{rowLabel('12')}, and shown for available cars only.
      </p>
    </div>
  );
}
