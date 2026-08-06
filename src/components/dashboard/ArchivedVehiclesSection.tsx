import { useState, useEffect } from 'react';
import type { Vehicle } from '../../types';
import { hapticLight } from '../../lib/haptics';

interface Props {
  archivedVehicles: Vehicle[];
  onRestore: (vehicleId: string) => void | Promise<void>;
  /** Live plate/unit search from the dashboard. A match surfaces the archived car here —
   *  auto-expanding this collapsed section — the way the Issue Log surfaces a cleared issue,
   *  instead of the search dead-ending at "not in the system". Mirrors ExceptionReturnSection. */
  search?: string;
}

/** Collapsible "Archived" list at the foot of the holds dashboard (management). */
export function ArchivedVehiclesSection({ archivedVehicles, onRestore, search = '' }: Props) {
  const [open, setOpen] = useState(false);

  const visible = search.trim()
    ? archivedVehicles.filter(v => {
        const q = search.toUpperCase();
        return (v.unitNumber?.toUpperCase() ?? '').includes(q) ||
          v.licensePlate.toUpperCase().includes(q) ||
          v.make.toUpperCase().includes(q) ||
          v.model.toUpperCase().includes(q);
      })
    : archivedVehicles;

  // Auto-expand when a search matches an archived vehicle (mirrors ExceptionReturnSection).
  useEffect(() => {
    if (!search.trim()) return;
    const q = search.toUpperCase();
    const hasMatch = archivedVehicles.some(v =>
      (v.unitNumber?.toUpperCase() ?? '').includes(q) ||
      v.licensePlate.toUpperCase().includes(q) ||
      v.make.toUpperCase().includes(q) ||
      v.model.toUpperCase().includes(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasMatch) setOpen(true);
  }, [search, archivedVehicles]);

  if (archivedVehicles.length === 0) return null;
  // Searching but nothing archived matches — don't distract from the vehicle list.
  if (search.trim() && visible.length === 0) return null;

  return (
    <section className="mt-6 px-4 pb-2">
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest cursor-pointer"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>Archived · {visible.length}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {visible.map(v => (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
            >
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {v.unitNumber}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {v.year} {v.make} {v.model} · {v.licensePlate}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Archived {v.archivedAt
                    ? new Date(v.archivedAt).toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => { hapticLight(); await onRestore(v.id); }}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer shrink-0 ml-3"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
