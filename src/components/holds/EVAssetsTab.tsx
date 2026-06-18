import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useUserResolver } from '../../hooks/useUserResolver';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { EVAssetHistoryPanel } from '../vehicle/EVAssetHistoryPanel';
import { EvLoanSection } from '../vehicle/EvLoanSection';
import { QuickAddTeslaForm } from './QuickAddTeslaForm';
import { PrimaryAction } from '../shared/PrimaryAction';
import { isTeslaMake } from '../../lib/ev-detection';
import { isAssetLentOut, lentOutBy } from '../../lib/evAssetLoans';
import { hapticMedium } from '../../lib/haptics';
import type { EvAssetStatus, Vehicle } from '../../types';

const BOTH_MISSING_DESCRIPTION =
  'Both EV assets missing — Mobile Charge Cable and J1772 Adapter not present. ' +
  'Vehicle should not be dispatched until assets are located or management approves.';

const toStatus = (b: boolean | null): EvAssetStatus | null => b == null ? null : b ? 'present' : 'missing';
const isTeslaVehicle = (v: Vehicle) => v.isTesla || isTeslaMake(v.make);
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function AssetLine({ label, has }: { label: string; has: boolean | null }) {
  const cls = has === false ? 'text-red-600 dark:text-red-400'
    : has ? 'text-green-600 dark:text-green-400'
    : 'text-gray-400 dark:text-gray-500';
  return <span className={`text-sm font-medium ${cls}`}>{has === false ? '✗' : has ? '✓' : '—'} {label}</span>;
}

export function EVAssetsTab() {
  const { user } = useAuth();
  const { vehicles, updateVehicleEVAssets, addHold, evAssetLoans, createEvAssetLoan, returnEvAssetLoan } = useVehicleHoldContext();
  const { getName } = useUserResolver();

  const [query, setQuery]           = useState('');
  const [adding, setAdding]         = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cable, setCable]           = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter]       = useState<EvAssetStatus | null>(null);
  const [cableLentUnit, setCableLentUnit]     = useState('');
  const [adapterLentUnit, setAdapterLentUnit] = useState('');
  const [notes, setNotes]           = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving]         = useState(false);

  // Derive from context (not a snapshot) so the roster + footer reflect the latest write.
  const selected    = selectedId ? vehicles.find(v => v.id === selectedId) ?? null : null;
  const bothMissing = cable === 'missing' && adapter === 'missing';

  // The whole Tesla roster — few enough to show at a glance. Most recently
  // interacted (last EV-asset check) floats to the top, like the holds list;
  // never-logged sink to the bottom; tiebreak by unit.
  const q = query.trim().toLowerCase();
  const teslas = vehicles
    .filter(isTeslaVehicle)
    .filter(v => !q || `${v.unitNumber ?? ''} ${v.licensePlate} ${v.make} ${v.model}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const at = a.evLastUpdatedAt ? new Date(a.evLastUpdatedAt).getTime() : 0;
      const bt = b.evLastUpdatedAt ? new Date(b.evLastUpdatedAt).getTime() : 0;
      return bt - at || (a.unitNumber ?? a.licensePlate).localeCompare(b.unitNumber ?? b.licensePlate);
    });

  const selectVehicle = (v: Vehicle) => {
    setSelectedId(v.id);
    setCable(toStatus(v.hasMobileCable));
    setAdapter(toStatus(v.hasJ1772Adapter));
    setCableLentUnit('');
    setAdapterLentUnit('');
    setNotes('');
    setConfirming(false);
  };

  const doUpdate = async () => {
    if (!selected || !user) return;
    setSaving(true);
    await updateVehicleEVAssets(selected.id, cable === 'present', adapter === 'present', 'vsa_washbay', notes.trim() || undefined);
    // Marking an asset missing-because-lent records a structured loan, not a note.
    if (cable === 'missing' && cableLentUnit.trim() && !isAssetLentOut(evAssetLoans, selected.id, 'cable')) {
      await createEvAssetLoan(selected.id, 'cable', cableLentUnit, notes.trim() || null);
    }
    if (adapter === 'missing' && adapterLentUnit.trim() && !isAssetLentOut(evAssetLoans, selected.id, 'adapter')) {
      await createEvAssetLoan(selected.id, 'adapter', adapterLentUnit, notes.trim() || null);
    }
    // Marking a lent asset present here means it came back — close its loan so the
    // card can't read "✓ Present" and "out → unit X" at the same time.
    for (const [asset, status] of [['cable', cable], ['adapter', adapter]] as const) {
      if (status !== 'present') continue;
      const open = lentOutBy(evAssetLoans, selected.id).find(l => l.assetType === asset);
      if (open) await returnEvAssetLoan(open);
    }
    if (bothMissing) {
      await addHold(selected.id, BOTH_MISSING_DESCRIPTION, notes.trim(), user.id, [], ['missing_accessories']);
    }
    hapticMedium();
    setSaving(false);
    setSelectedId(null); // back to the roster, now showing the fresh status
  };

  const handleSubmit = () => {
    if (bothMissing && !confirming) { setConfirming(true); return; }
    void doUpdate();
  };

  // ── Edit view ────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setSelectedId(null)}
          className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer">
          ← All Teslas
        </button>

        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{selected.unitNumber ?? selected.licensePlate} ⚡</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{selected.year} {selected.make} {selected.model} · {selected.licensePlate}</p>
        </div>

        <EVAssetCheck
          cableStatus={cable} adapterStatus={adapter}
          onCableChange={s => { setCable(s); setConfirming(false); }}
          onAdapterChange={s => { setAdapter(s); setConfirming(false); }}
          lastCheck={selected.evLastUpdatedAt ? {
            cableStatus: toStatus(selected.hasMobileCable),
            adapterStatus: toStatus(selected.hasJ1772Adapter),
            when: selected.evLastUpdatedAt,
            byName: selected.evLastUpdatedBy ? getName(selected.evLastUpdatedBy) : 'Unknown',
          } : null}
        />

        {((cable === 'missing' && !isAssetLentOut(evAssetLoans, selected.id, 'cable')) ||
          (adapter === 'missing' && !isAssetLentOut(evAssetLoans, selected.id, 'adapter'))) && (
          <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Lent to another unit? (optional)</p>
            {cable === 'missing' && !isAssetLentOut(evAssetLoans, selected.id, 'cable') && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 w-32 shrink-0">🔌 Charge cable →</span>
                <input value={cableLentUnit} onChange={e => setCableLentUnit(e.target.value.toUpperCase())} placeholder="unit #"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition uppercase" />
              </div>
            )}
            {adapter === 'missing' && !isAssetLentOut(evAssetLoans, selected.id, 'adapter') && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 w-32 shrink-0">🔗 J1772 adapter →</span>
                <input value={adapterLentUnit} onChange={e => setAdapterLentUnit(e.target.value.toUpperCase())} placeholder="unit #"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition uppercase" />
              </div>
            )}
          </div>
        )}

        <EvLoanSection vehicle={selected} />

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. found in trunk, scratched casing…"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition" />
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
            className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer">
            {saving ? 'Saving…' : 'Update Assets'}
          </button>
        )}

        <EVAssetHistoryPanel vehicleId={selected.id} />
      </div>
    );
  }

  // ── Quick-add view ───────────────────────────────────────────────────────────
  if (adding) return <QuickAddTeslaForm prefill={query} onDone={() => setAdding(false)} />;

  // ── Roster view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Tesla roster</p>
      <div className="flex gap-2">
        <input type="text" value={query} onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="Filter Teslas…"
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition uppercase" />
        <PrimaryAction label="Register" aria-label="Register a Tesla" onClick={() => setAdding(true)} />
      </div>

      {teslas.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">No Teslas in the fleet.</p>
      ) : teslas.map(v => {
        const missing = v.hasMobileCable === false || v.hasJ1772Adapter === false;
        return (
          <button key={v.id} type="button" onClick={() => selectVehicle(v)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition cursor-pointer ${
              missing
                ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.unitNumber ?? v.licensePlate} ⚡</p>
              {missing && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">needs assets</span>}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model} · {v.licensePlate}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {v.evLastUpdatedAt ? `as of ${fmtWhen(v.evLastUpdatedAt)}${v.evLastUpdatedBy ? ` · ${getName(v.evLastUpdatedBy)}` : ''}` : 'not yet logged'}
            </p>
            <div className="flex gap-4 mt-1.5">
              <AssetLine label="Charge cable" has={v.hasMobileCable} />
              <AssetLine label="Adapter" has={v.hasJ1772Adapter} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
