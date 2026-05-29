import { useState, useEffect } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticMedium, hapticLight } from '../../lib/haptics';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { pushNotification } from '../../lib/garage-uploads';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useUserResolver } from '../../hooks/useUserResolver';

interface Props {
  vehicleId: string;
  onClose: () => void;
}

interface VehicleRow {
  id: string;
  branch_id: string;
  unit_number: string | null;
  license_plate: string;
  edit_suggested_unit: string | null;
  edit_suggested_plate: string;
  edit_suggested_by: string;
  edit_suggestion_note: string | null;
}

export function VehicleEditApprovalSheet({ vehicleId, onClose }: Props) {
  const { user } = useAuth();
  const { applyVehicleIdentity } = useVehicleHoldContext();
  const { getProfile } = useUserResolver();
  useEscapeKey(onClose);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('id, branch_id, unit_number, license_plate, edit_suggested_unit, edit_suggested_plate, edit_suggested_by, edit_suggestion_note')
      .eq('id', vehicleId)
      .single()
      .then(({ data }) => {
        setVehicle(data as VehicleRow | null);
        setLoading(false);
      });
  }, [vehicleId]);

  if (!user || loading || !vehicle) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 flex items-center justify-center min-h-48">
          <p className="text-sm text-gray-400 dark:text-gray-500">{loading ? 'Loading…' : 'Vehicle not found.'}</p>
        </div>
      </>
    );
  }

  const staffUser = getProfile(vehicle.edit_suggested_by);

  const unitChanged = vehicle.edit_suggested_unit !== vehicle.unit_number;
  const plateChanged = vehicle.edit_suggested_plate !== vehicle.license_plate;

  const handleApprove = async () => {
    hapticMedium();
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:      vehicle.edit_suggested_unit,
        license_plate:    vehicle.edit_suggested_plate,
        edit_status:      'approved',
        edit_reviewed_by: user.id,
        edit_reviewed_at: now,
      }).eq('id', vehicleId)
    );

    if (!error) {
      await applyVehicleIdentity(vehicleId, vehicle.edit_suggested_unit, vehicle.edit_suggested_plate);
      await pushNotification(
        vehicle.branch_id,
        [],
        '✅',
        `Your vehicle edit was approved by ${user.name}.`,
        'success',
        undefined,
        vehicle.edit_suggested_by,
      );
      onClose();
    }
    setSubmitting(false);
  };

  const handleDeny = async () => {
    hapticLight();
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        edit_status:      'denied',
        edit_reviewed_by: user.id,
        edit_reviewed_at: now,
      }).eq('id', vehicleId)
    );

    if (!error) {
      await pushNotification(
        vehicle.branch_id,
        [],
        '✕',
        `Your vehicle edit was denied by ${user.name}.`,
        'info',
        undefined,
        vehicle.edit_suggested_by,
      );
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Vehicle Edit Request</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Staff */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Requested by</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {staffUser ? `${staffUser.name} · ${staffUser.employeeId}` : vehicle.edit_suggested_by}
          </p>
        </div>

        {/* Diff */}
        <div className="space-y-3">
          {/* Unit number row */}
          <div className="grid grid-cols-3 items-center text-sm gap-2">
            <span className="text-gray-500 dark:text-gray-400">Unit #</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-center">
              {vehicle.unit_number ?? <span className="text-gray-400 italic text-xs">pending</span>}
            </span>
            <span className={`font-semibold text-right ${unitChanged ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {vehicle.edit_suggested_unit === null
                ? <span className="italic text-xs">— clear —</span>
                : vehicle.edit_suggested_unit}
            </span>
          </div>

          {/* Plate row */}
          <div className="grid grid-cols-3 items-center text-sm gap-2">
            <span className="text-gray-500 dark:text-gray-400">Plate</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-center">{vehicle.license_plate}</span>
            <span className={`font-semibold text-right ${plateChanged ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {vehicle.edit_suggested_plate}
            </span>
          </div>

          <div className="grid grid-cols-3 text-xs text-gray-400 dark:text-gray-500 gap-2 -mt-1">
            <span />
            <span className="text-center">Current</span>
            <span className="text-right">Suggested</span>
          </div>
        </div>

        {/* Staff note */}
        {vehicle.edit_suggestion_note && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Staff note</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{vehicle.edit_suggestion_note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40"
          >
            Approve
          </button>
        </div>

      </div>
    </>
  );
}
