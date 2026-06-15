import { useState } from 'react';
import { exportHoldToHtml } from '../../lib/hold-export';
import type { Hold, Vehicle } from '../../types';

interface Props {
  vehicle: Vehicle;
  holds: Hold[];
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
}

const TRIGGER = 'px-3 py-2 border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium text-sm rounded-lg transition cursor-pointer';
const OPTION  = 'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer';

/**
 * Share a vehicle's hold record as HTML, with a choice of scope. One record →
 * shares straight away (latest and full are the same). Multiple → a small menu:
 * the latest flag (the single most-recent record) or the full history.
 */
export function HoldShareMenu({ vehicle, holds, getName, getEmpId }: Props) {
  const [open, setOpen] = useState(false);
  if (holds.length === 0) return null;

  // Latest flag = the single most-recently flagged record (the one on top).
  const latest = holds.reduce((a, b) =>
    new Date(b.flaggedAt).getTime() > new Date(a.flaggedAt).getTime() ? b : a
  );

  const share = (subset: Hold[]) => {
    exportHoldToHtml({ vehicle, holds: subset, getName, getEmpId });
    setOpen(false);
  };

  const handleTrigger = () => (holds.length === 1 ? share(holds) : setOpen(o => !o));

  return (
    <div className="relative ml-auto">
      <button onClick={handleTrigger} className={TRIGGER}>↗ Share</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-52 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
            <button onClick={() => share([latest])} className={OPTION}>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Latest flag</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">Just the most recent record</span>
            </button>
            <button onClick={() => share(holds)} className={`${OPTION} border-t border-gray-100 dark:border-gray-800`}>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Full history</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">All {holds.length} records</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
