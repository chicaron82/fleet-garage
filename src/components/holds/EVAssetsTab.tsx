import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useUserResolver } from '../../hooks/useUserResolver';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { isTeslaMake } from '../../lib/ev-detection';
import { hapticMedium } from '../../lib/haptics';
import type { EvAssetStatus } from '../../types';

const BOTH_MISSING_DESCRIPTION =
  'Both EV assets missing — Mobile Charge Cable and J1772 Adapter not present. ' +
  'Vehicle should not be dispatched until assets are located or management approves.';

const toStatus = (b: boolean | null): EvAssetStatus | null => b == null ? null : b ? 'present' : 'missing';

export function EVAssetsTab() {
  const { user } = useAuth();
  const { vehicles, updateVehicleEVAssets, addHold } = useVehicleHoldContext();
  const { getName } = useUserResolver();

  const [query, setQuery]           = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cable, setCable]           = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter]       = useState<EvAssetStatus | null>(null);
  const [notes, setNotes]           = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  // Derive from context (not a snapshot) so the footer reflects the latest write.
  const selected   = selectedId ? vehicles.find(v => v.id === selectedId) ?? null : null;
  const isTesla    = !!selected && (selected.isTesla || isTeslaMake(selected.make));
  const bothMissing = cable === 'missing' && adapter === 'missing';

  const matches = query.trim().length >= 2
    ? vehicles
        .filter(v => `${v.unitNumber ?? ''} ${v.licensePlate} ${v.make} ${v.model}`.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const selectVehicle = (id: string) => {
    const v = vehicles.find(x => x.id === id);
    setSelectedId(id);
    setQuery('');
    setCable(toStatus(v?.hasMobileCable ?? null));
    setAdapter(toStatus(v?.hasJ1772Adapter ?? null));
    setNotes('');
    setConfirming(false);
    setSaved(false);
  };

  const doUpdate = async () => {
    if (!selected || !user) return;
    setSaving(true);
    await updateVehicleEVAssets(selected.id, cable === 'present', adapter === 'present', 'vsa_washbay', notes.trim() || undefined);
    if (bothMissing) {
      await addHold(selected.id, BOTH_MISSING_DESCRIPTION, notes.trim(), user.id, [], ['missing_accessories']);
    }
    hapticMedium();
    setSaving(false);
    setConfirming(false);
    setSaved(true);
  };

  const handleSubmit = () => {
    // Both missing grounds the vehicle (not dispatchable) — confirm before it does.
    if (bothMissing && !confirming) { setConfirming(true); return; }
    void doUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search unit #, plate, or make…"
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
        />
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
            {matches.map(v => (
              <button key={v.id} type="button" onClick={() => selectVehicle(v.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex justify-between items-center cursor-pointer">
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.unitNumber ?? v.licensePlate}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}{(v.isTesla || isTeslaMake(v.make)) ? ' ⚡' : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && !isTesla && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-6">
          This vehicle has no EV assets to track.
        </p>
      )}

      {selected && isTesla && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{selected.unitNumber ?? selected.licensePlate} ⚡</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{selected.year} {selected.make} {selected.model} · {selected.licensePlate}</p>
          </div>

          <EVAssetCheck
            cableStatus={cable}
            adapterStatus={adapter}
            onCableChange={s => { setCable(s); setConfirming(false); setSaved(false); }}
            onAdapterChange={s => { setAdapter(s); setConfirming(false); setSaved(false); }}
            lastCheck={selected.evLastUpdatedAt ? {
              cableStatus: toStatus(selected.hasMobileCable),
              adapterStatus: toStatus(selected.hasJ1772Adapter),
              when: selected.evLastUpdatedAt,
              byName: selected.evLastUpdatedBy ? getName(selected.evLastUpdatedBy) : 'Unknown',
            } : null}
          />

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. adapter lent to unit 5424…"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          {confirming ? (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Both assets missing — flag as not dispatchable?</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Creates a hold requiring management approval before this Tesla can be released.</p>
              <div className="flex gap-2 justify-end mt-3">
                <button type="button" onClick={() => setConfirming(false)} disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void doUpdate()} disabled={saving}
                  className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50">
                  {saving ? 'Flagging…' : 'Update & flag'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving || cable == null || adapter == null}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer">
              {saving ? 'Saving…' : saved ? '✓ Assets Updated' : 'Update Assets'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
