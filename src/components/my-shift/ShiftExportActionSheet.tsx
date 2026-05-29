import { ShiftReportExport } from '../analytics/ShiftReportExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { formatDateStr } from '../../lib/buildShiftReport';

interface Props {
  date: string;
  onClose: () => void;
}

export function ShiftExportActionSheet({ date, onClose }: Props) {
  useEscapeKey(onClose);
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-4 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Export Shift Report</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatDateStr(date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <ShiftReportExport date={date} />
      </div>
    </>
  );
}
