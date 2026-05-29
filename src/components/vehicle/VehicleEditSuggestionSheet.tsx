import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { pushNotification } from '../../lib/garage-uploads';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import type { Vehicle } from '../../types';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

export function VehicleEditSuggestionSheet({ vehicle, onClose }: Props) {
  useEscapeKey(onClose);
  const { user } = useAuth();
  const { markVehicleEditPending } = useVehicleHoldContext();

  const [clearUnit, setClearUnit] = useState(false);
  const [newUnit, setNewUnit] = useState(vehicle.unitNumber ?? '');
  const [newPlate, setNewPlate] = useState(vehicle.licensePlate);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedUnit = clearUnit ? null : newUnit.trim() || (vehicle.unitNumber ?? null);
  const suggestedPlate = newPlate.trim() || vehicle.licensePlate;

  const unitChanged = clearUnit
    ? vehicle.unitNumber !== null
    : newUnit.trim() !== (vehicle.unitNumber ?? '');
  const plateChanged = newPlate.trim() !== vehicle.licensePlate;
  const hasChange = unitChanged || plateChanged;

  const canSubmit = hasChange && note.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user) { setError('Session error — please refresh and try again.'); return; }
    hapticMedium();
    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const { error: dbError } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        edit_suggested_unit:  suggestedUnit,
        edit_suggested_plate: suggestedPlate,
        edit_suggested_by:    user.id,
        edit_suggested_at:    now,
        edit_suggestion_note: note.trim(),
        edit_status:          'pending',
      }).eq('id', vehicle.id)
    );

    if (dbError) {
      setError('Failed to submit — please try again.');
      setSubmitting(false);
      return;
    }

    await pushNotification(
      vehicle.branchId,
      ['Branch Manager', 'Operations Manager', 'City Manager'],
      '✏️',
      `${user.name} suggested an edit to vehicle ${vehicle.licensePlate} — ${note.trim()}`,
      'info',
      { type: 'vehicle_edit_request', vehicleId: vehicle.id },
    );

    markVehicleEditPending(vehicle.id, {
      unit: suggestedUnit,
      plate: suggestedPlate,
      by: user.id,
      at: now,
      note: note.trim(),
    });

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Suggest Identity Edit</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Unit number */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Unit Number</label>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">Current</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {vehicle.unitNumber ?? <span className="text-gray-400 italic">Unit # pending</span>}
            </span>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={clearUnit}
              onChange={e => { hapticLight(); setClearUnit(e.target.checked); }}
              className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Clear — correct unit unknown</span>
          </label>
          {!clearUnit && (
            <input
              type="text"
              value={newUnit}
              onChange={e => setNewUnit(e.target.value.toUpperCase())}
              placeholder="New unit number"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
        </div>

        {/* License plate */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">License Plate</label>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">Current</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{vehicle.licensePlate}</span>
          </div>
          <input
            type="text"
            value={newPlate}
            onChange={e => setNewPlate(e.target.value.toUpperCase())}
            placeholder="New license plate"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Reason <span className="text-red-400 ml-0.5">*</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why does this need to be corrected?"
            rows={2}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>

        {!hasChange && note.trim().length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">No changes detected — modify at least one field.</p>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suggest Edit
        </button>

      </div>
    </>
  );
}
