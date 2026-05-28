import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createOrEnrichRegistry, lookupRegistry, mergeRegistryRecords } from '../../lib/vehicleRegistry';
import type { VehicleRegistryEntry } from '../../types';
import { VehicleMergePrompt } from '../vehicle/VehicleMergePrompt';

interface Props {
  /**
   * Current value of the parent unit-search field. When it changes, the
   * plate-arrival flow auto-resets so a fresh search starts from a clean slate.
   */
  unitSearch: string;
}

export function PlateArrivalSection({ unitSearch }: Props) {
  const { user } = useAuth();

  const [open, setOpen]               = useState(false);
  const [plate, setPlate]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);
  const [entry, setEntry]             = useState<VehicleRegistryEntry | null>(null);
  const [mergeTarget, setMergeTarget] = useState<VehicleRegistryEntry | null>(null);


  const handleConfirm = useCallback(async () => {
    if (!user || !plate.trim()) return;
    setSaving(true);
    const plateUpper = plate.trim().toUpperCase();
    const result = await lookupRegistry({ plate: plateUpper, branchId: user.branchId });
    if (result.status === 'merge_candidate') {
      setMergeTarget(result.existing);
      setSaving(false);
      return;
    }
    const created = await createOrEnrichRegistry({
      branchId: user.branchId,
      plate: plateUpper,
      arrivedAt: new Date().toISOString(),
    });
    setEntry(created);
    setSaving(false);
    setDone(true);
  }, [user, plate]);

  const handleMerge = useCallback(async () => {
    if (!user || !mergeTarget) return;
    setSaving(true);
    const newEntry = await createOrEnrichRegistry({
      branchId: user.branchId,
      plate: plate.trim().toUpperCase(),
      arrivedAt: new Date().toISOString(),
    });
    if (newEntry) {
      await mergeRegistryRecords(mergeTarget.id, newEntry.id);
    }
    setMergeTarget(null);
    setEntry(mergeTarget);
    setSaving(false);
    setDone(true);
  }, [user, plate, mergeTarget]);

  const handleCreateNew = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const created = await createOrEnrichRegistry({
      branchId: user.branchId,
      plate: plate.trim().toUpperCase(),
      arrivedAt: new Date().toISOString(),
      needsReview: true,
    });
    setMergeTarget(null);
    setEntry(created);
    setSaving(false);
    setDone(true);
  }, [user, plate]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg border border-gray-200 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">"{unitSearch}" not in the system.</p>
        {!open && !done && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer ml-3 shrink-0"
          >
            + Record arrival by plate
          </button>
        )}
      </div>

      {open && !done && !mergeTarget && (
        <div className="space-y-2 px-1">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Plate (e.g. LUR156)"
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-teal-400 transition"
            />
            <button
              type="button"
              disabled={!plate.trim() || saving}
              onClick={handleConfirm}
              className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm font-semibold transition cursor-pointer"
            >
              {saving ? '…' : 'Log'}
            </button>
          </div>
        </div>
      )}

      {mergeTarget && (
        <VehicleMergePrompt
          plate={plate.trim().toUpperCase()}
          existing={mergeTarget}
          onMerge={handleMerge}
          onCreateNew={handleCreateNew}
        />
      )}

      {done && (
        <div className="px-3.5 py-2.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 rounded-lg">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Arrival recorded for {entry?.plate ?? plate}
          </p>
        </div>
      )}
    </div>
  );
}
