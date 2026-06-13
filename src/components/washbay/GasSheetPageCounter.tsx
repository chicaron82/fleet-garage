import { hapticLight, hapticMedium } from '../../lib/haptics';
import { carsFromPageCounter } from '../../lib/gas-sheet';

interface Props {
  totalPages: number;
  entriesOnCurrentPage: number;
  onChange: (totalPages: number, entriesOnCurrentPage: number) => void;
}

const BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';

export function GasSheetPageCounter({ totalPages, entriesOnCurrentPage, onChange }: Props) {
  const onEntryInc = () => {
    if (entriesOnCurrentPage === 19) { onChange(totalPages + 1, 0); hapticMedium(); }
    else { onChange(totalPages, entriesOnCurrentPage + 1); hapticLight(); }
  };
  const onEntryDec = () => {
    if (entriesOnCurrentPage === 0 && totalPages > 0) { onChange(totalPages - 1, 19); hapticMedium(); }
    else if (entriesOnCurrentPage > 0) { onChange(totalPages, entriesOnCurrentPage - 1); hapticLight(); }
  };
  const onPageInc = () => { onChange(totalPages + 1, 19); hapticLight(); };
  const onPageDec = () => { onChange(Math.max(0, totalPages - 1), entriesOnCurrentPage); hapticLight(); };

  const carsIn = carsFromPageCounter(totalPages, entriesOnCurrentPage);

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gas Sheet Pages</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Pages</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onPageDec} className={BTN}>−</button>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{totalPages}</span>
            <button type="button" onClick={onPageInc} className={BTN}>+</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">
            {totalPages > 0 ? `Entries on page ${totalPages}` : 'Entries'}
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onEntryDec} className={BTN}>−</button>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{entriesOnCurrentPage}</span>
            <button type="button" onClick={onEntryInc} className={BTN}>+</button>
          </div>
        </div>
      </div>
      {carsIn > 0 && (
        <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">= {carsIn} cars in ✓</p>
      )}
    </div>
  );
}
