import { useState } from 'react';
import type { Vehicle } from '../../types';

function describeVehicle(v: Vehicle): string {
  const yr = v.year ? `${v.year} ` : '';
  const mm = [v.make, v.model].filter(Boolean).join(' ');
  return `${yr}${mm}${v.licensePlate ? ` · plate ${v.licensePlate}` : ''}`.trim();
}

interface Props {
  conflict: Vehicle;
  armed: boolean;
  onArm: () => void;
  onDisarm: () => void;
}

/**
 * Heads-up + two-step resolve for a unit# that's already on a different vehicle.
 * Step 1: name the conflicting record, ask "same vehicle?". Step 2 (on intent):
 * spell out exactly what the move does before committing. Arming only flags intent
 * — the actual write happens when the form is submitted, so declining (or editing
 * the unit#) leaves the other record untouched.
 */
export function UnitConflictNotice({ conflict, armed, onArm, onDisarm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const unit = conflict.unitNumber ?? '';

  if (armed) {
    return (
      <div className="rounded-lg border border-fg-yellow bg-fg-yellow/10 px-3 py-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          ✓ Unit {unit} will move here. {describeVehicle(conflict)} will be left without a unit#.
        </p>
        <button
          type="button"
          onClick={() => { setConfirming(false); onDisarm(); }}
          className="text-xs font-semibold text-amber-700 dark:text-amber-400 underline shrink-0 cursor-pointer"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 space-y-2">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
        ⚠️ Unit {unit} is already on file for {describeVehicle(conflict)}. Is this the same vehicle?
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline cursor-pointer"
        >
          Same vehicle — move unit # here →
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This moves unit {unit} off {describeVehicle(conflict)} onto the vehicle you're adding.
            That record will be left without a unit# and will need a new one.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { onArm(); setConfirming(false); }}
              className="px-3 py-1.5 rounded-lg bg-fg-yellow text-gray-900 text-xs font-semibold cursor-pointer"
            >
              Yes, move it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
