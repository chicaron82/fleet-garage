// The running sheet — what has been written up so far, and where the available cars actually are.
//
// ⭐ Mirrors form 8073-16's own columns and nothing else. `Mileage`, `AM Check` and `Arrived
// Overnight` are blank on both of Aaron's PM sheets because they belong to the morning pass;
// rendering them would be theatre.
import { rowLabel, sheetNote, STATUS_LABELS, type InventoryEntry, type RowTally } from '../../lib/closingInventory';

export function ClosingInventorySheet({ entries, tally, onRemove }: {
  entries: readonly InventoryEntry[];
  tally: readonly RowTally[];
  onRemove: (index: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-gray-500 dark:text-gray-400 italic px-1">
        Nothing written up yet. Scan a key tag to start the sheet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
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
              <th className="py-1 sr-only">Remove</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.plate}-${i}`} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.owningArea ?? '—'}</td>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.unitNumber ?? '—'}</td>
                <td className="py-1 pr-2 font-semibold text-gray-900 dark:text-gray-100">{e.plate}</td>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{e.rentalClass ?? '—'}</td>
                <td className="py-1 pr-2 font-bold text-gray-900 dark:text-gray-100"
                  title={STATUS_LABELS[e.status]}>{e.status}</td>
                <td className="py-1 pr-2 text-gray-600 dark:text-gray-300">{sheetNote(e) || '—'}</td>
                <td className="py-1 text-right">
                  <button type="button" onClick={() => onRemove(i)}
                    aria-label={`Remove ${e.plate}`}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-1 cursor-pointer transition">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        A available · D dirty · B body · M mechanical · F foreign (US plate).
        {' '}Row shown as {rowLabel('5')} for available cars only.
      </p>
    </div>
  );
}
