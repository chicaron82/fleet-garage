import { useState } from 'react';
import { attachPlan, type AttachForm } from '../../lib/attachUnit';
import type { Vehicle } from '../../types';
import type { VehicleIdentityEdit } from '../../context/vehicleIdentityWrite';

interface Props {
  existing: Vehicle;
  form: AttachForm;
  directEditVehicleIdentity: (vehicleId: string, unit: string | null, plate: string, identity?: VehicleIdentityEdit) => Promise<boolean>;
  onDone: (vehicleId: string) => void;
}

/** The plate he typed is already on file with no unit number: offer to put THIS unit on THAT
 *  record rather than register a second car (see lib/attachUnit). */
export function AttachUnitNotice({ existing, form, directEditVehicleIdentity, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const plan = attachPlan(existing, form);

  const attach = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await directEditVehicleIdentity(existing.id, plan.unit, existing.licensePlate, plan.identity).catch(() => false);
    if (ok) { onDone(existing.id); return; }
    setFailed(true);
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20 px-3 py-2 space-y-2">
      <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
        {existing.licensePlate} is already on file with no unit number. Add unit {plan.unit} to that record instead of registering a second car.
        {plan.identity ? ' The make, model, year and colour above go with it.' : ''}
      </p>
      <button type="button" onClick={attach} disabled={busy}
        className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white cursor-pointer disabled:cursor-not-allowed">
        {busy ? 'Adding…' : `Add unit ${plan.unit} to ${existing.licensePlate}`}
      </button>
      {failed && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">Didn't save — check the signal and tap again.</p>
      )}
    </div>
  );
}
