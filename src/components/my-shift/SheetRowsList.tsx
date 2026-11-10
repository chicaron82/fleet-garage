// What each past-sheet row did, newest on top, with its Undo (and a doesn't-fit row's Save anyway).
import { km, sheetRowWords } from '../../lib/sheetDay';
import type { SheetRow } from '../../hooks/usePastGasSheet';

const TONE = {
  ok:   'text-green-700 dark:text-green-400',
  note: 'text-gray-500 dark:text-gray-400',
  warn: 'text-amber-700 dark:text-amber-400',
} as const;
const BTN = 'shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer';

export function SheetRowsList({ rows, onUndo, onSaveAnyway, onRetry }: {
  rows: SheetRow[];
  onUndo: (r: SheetRow) => void;
  onSaveAnyway: (r: SheetRow) => void;
  onRetry: (r: SheetRow) => void;
}) {
  if (!rows.length) return null;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {rows.map(r => {
        const words = r.result ? sheetRowWords(r.result, r.odo, r.day) : null;
        const conflict = r.state === 'done' && r.result?.status === 'conflict';
        const saved = r.state === 'done' && r.result?.status === 'saved';
        return (
          <li key={r.key} className="px-3 py-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${r.state === 'undone' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {r.car.licensePlate} <span className="font-mono tabular-nums">{km(r.odo)}</span>
              </p>
              <p className={`text-xs ${r.state === 'failed' ? 'text-red-600 dark:text-red-400' : words ? TONE[words.tone] : 'text-gray-400'}`}
                role={conflict || r.state === 'failed' ? 'alert' : undefined}>
                {r.state === 'saving' ? 'Saving…'
                  : r.state === 'undone' ? 'Taken back'
                  : r.state === 'failed' ? "Didn't save. No signal?"
                  : words?.text}
              </p>
            </div>
            {saved && <button type="button" onClick={() => onUndo(r)} className={`${BTN} text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800`}>Undo</button>}
            {conflict && (
              <>
                <button type="button" onClick={() => onSaveAnyway(r)} className={`${BTN} bg-amber-500 text-white`}>Save anyway</button>
                <button type="button" onClick={() => onUndo(r)} className={`${BTN} text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800`}>Drop</button>
              </>
            )}
            {r.state === 'failed' && <button type="button" onClick={() => onRetry(r)} className={`${BTN} bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900`}>Try again</button>}
          </li>
        );
      })}
    </ul>
  );
}
