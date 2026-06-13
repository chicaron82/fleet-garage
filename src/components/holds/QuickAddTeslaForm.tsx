import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { hapticMedium } from '../../lib/haptics';
import { UnitNumberInput, PlateInput } from '../shared/VehicleFields';
import type { EvAssetStatus } from '../../types';

// Mirrors EVAssetsTab — a Tesla with neither accessory is held from dispatch.
const BOTH_MISSING_DESCRIPTION =
  'Both EV assets missing — Mobile Charge Cable and J1772 Adapter not present. ' +
  'Vehicle should not be dispatched until assets are located or management approves.';

const FIELD = 'w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';

export function QuickAddTeslaForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { addVehicle, updateVehicleEVAssets, addHold } = useVehicleHoldContext();

  const [unitNumber, setUnitNumber] = useState('');
  const [plate, setPlate]           = useState('');
  const [cable, setCable]           = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter]       = useState<EvAssetStatus | null>(null);
  const [notes, setNotes]           = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const bothMissing = cable === 'missing' && adapter === 'missing';
  const canSubmit   = unitNumber.trim() !== '' && plate.trim() !== '' && cable != null && adapter != null;

  const doCreate = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    setError('');
    try {
      // Transfer Teslas land CLEAR — in circulation, just (maybe) missing an accessory.
      // make/model/year/color are NOT NULL, so placeholder them; fleet fills in later.
      const id = await addVehicle({
        unitNumber:      unitNumber.trim(),
        licensePlate:    plate.trim().toUpperCase(),
        make: 'Tesla', model: 'Unknown', year: 0, color: 'Unknown',
        status:          'CLEAR',
        isTesla:         true,
        hasMobileCable:  cable === 'present',
        hasJ1772Adapter: adapter === 'present',
      });
      // Attribution + the unified EV timeline row (source: vsa_washbay).
      await updateVehicleEVAssets(id, cable === 'present', adapter === 'present', 'vsa_washbay', notes.trim() || undefined);
      if (bothMissing) {
        await addHold(id, BOTH_MISSING_DESCRIPTION, notes.trim(), user.id, [], ['missing_accessories']);
      }
      hapticMedium();
      onDone();
    } catch {
      setError('Could not register the Tesla — please try again.');
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (bothMissing && !confirming) { setConfirming(true); return; }
    void doCreate();
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onDone}
        className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer">
        ← All Teslas
      </button>

      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Register Tesla ⚡</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Quick-add a transfer Tesla and log its assets — fleet fills in make/model later.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Unit #</label>
          <UnitNumberInput value={unitNumber} onValueChange={setUnitNumber} placeholder="e.g. 5421" className={FIELD} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License plate</label>
          <PlateInput value={plate} onValueChange={setPlate} placeholder="e.g. HFE 872" className={FIELD} />
        </div>
      </div>

      <EVAssetCheck
        cableStatus={cable} adapterStatus={adapter}
        onCableChange={s => { setCable(s); setConfirming(false); }}
        onAdapterChange={s => { setAdapter(s); setConfirming(false); }}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. transfer from YYC, adapter only" className={FIELD} />
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {confirming ? (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Both assets missing — flag as not dispatchable?</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Registers the Tesla and creates a hold requiring management approval before release.</p>
          <div className="flex gap-2 justify-end mt-3">
            <button type="button" onClick={() => setConfirming(false)} disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void doCreate()} disabled={saving}
              className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50">
              {saving ? 'Registering…' : 'Register & flag'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={handleSubmit} disabled={saving || !canSubmit}
          className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer">
          {saving ? 'Registering…' : 'Register Tesla'}
        </button>
      )}
    </div>
  );
}
