import { useEffect } from 'react';
import { hapticLight } from '../../lib/haptics';
import type { EvAssetStatus } from '../../types';

export interface EvLastCheck {
  cableStatus: EvAssetStatus | null;
  adapterStatus: EvAssetStatus | null;
  when: string;
  byName: string;
}

interface EVAssetCheckProps {
  cableStatus: EvAssetStatus | null;
  adapterStatus: EvAssetStatus | null;
  onCableChange: (s: EvAssetStatus | null) => void;
  onAdapterChange: (s: EvAssetStatus | null) => void;
  lastCheck?: EvLastCheck | null;
  /**
   * Offer "Didn't check" — a way back to **null**, meaning *not assessed*, distinct from *present*.
   *
   * Off everywhere by default, because the other five surfaces (trip start, driver live, the flip,
   * the EV Assets tab, quick-add) are all "you are holding this car right now" moments where not
   * looking isn't a state worth modelling. REGISTRATION is the exception: a car can be registered
   * off a tag at the desk, and recording "present" for a trunk nobody opened is the assumption this
   * whole feature exists to refuse.
   *
   * ⚠️ Deliberately an ESCAPE, not a gate. Registration used to make him tap "✓ I checked them"
   * BEFORE he could answer — Aaron, 2026-08-25: *"tap to check is redundant. I've already checked.
   * I want to register it with the knowledge I have on it."* He was right, and the tap arithmetic
   * proves it: opting IN costs a tap on the common case (both present, every time) to protect the
   * rare one. Inverted, the common case is FREE and only "I didn't look" costs a tap — which is the
   * honest shape, because not looking is the exception, not the default.
   */
  allowNotChecked?: boolean;
}

const ASSETS: { key: 'cable' | 'adapter'; label: string }[] = [
  { key: 'cable',   label: 'Mobile Charge Cable' },
  { key: 'adapter', label: 'J1772 Adapter' },
];

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0)   return `${h}h ago`;
  return `${m}m ago`;
}

function statusIcon(s: EvAssetStatus | null): string {
  if (s === 'present') return '✓';
  if (s === 'missing') return '✗';
  return '—';
}

export function EVAssetCheck({
  cableStatus,
  adapterStatus,
  onCableChange,
  onAdapterChange,
  lastCheck,
  allowNotChecked = false,
}: EVAssetCheckProps) {
  // Default both to present on mount — the normal case requires zero taps.
  //
  // MOUNT ONLY, and that's what makes `allowNotChecked` work: once he clears to null the effect is
  // long done, so "not assessed" sticks instead of being helpfully re-filled underneath him.
  useEffect(() => {
    if (cableStatus === null)   onCableChange('present');
    if (adapterStatus === null) onAdapterChange('present');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses: Record<'cable' | 'adapter', EvAssetStatus | null> = {
    cable:   cableStatus,
    adapter: adapterStatus,
  };
  const handlers: Record<'cable' | 'adapter', (s: EvAssetStatus | null) => void> = {
    cable:   onCableChange,
    adapter: onAdapterChange,
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-900/10 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-blue-200 dark:border-blue-800/50 flex items-center gap-2">
        <span className="text-sm">⚡</span>
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
          EV Asset Check
        </p>
      </div>

      <div className="p-3 space-y-1">
        {ASSETS.map(({ key, label }) => {
          const val = statuses[key];
          const set = handlers[key];
          // THREE states, not two — but `unset` is only ever reachable when `allowNotChecked` put
          // it there. Everywhere else `val` is non-null from mount, so this collapses to the
          // present/missing checkbox it has always been.
          const state: 'present' | 'missing' | 'unset' = val ?? 'unset';
          const isPresent = state === 'present';
          return (
            <label key={key} className="flex items-center gap-3 cursor-pointer py-2">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                state === 'present' ? 'bg-blue-500 border-blue-500 text-white'
                : state === 'missing' ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
                // Not assessed reads as neither: a dashed, empty box. It must NOT look like an
                // unticked "missing" box, because "nobody looked" and "it isn't there" are opposite
                // claims and only one of them is evidence.
                : 'border-dashed border-gray-300 dark:border-gray-600 bg-transparent'
              }`}>
                {isPresent && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isPresent}
                // From `unset`, a tap means "I'm looking at it and it's here" — the reason he'd
                // reach for a box he'd previously cleared.
                onChange={() => { hapticLight(); set(isPresent ? 'missing' : 'present'); }}
              />
              <span className={`text-sm font-medium transition-colors ${
                state === 'present' ? 'text-gray-700 dark:text-gray-300'
                : state === 'missing' ? 'text-red-600 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
              }`}>
                {label}
              </span>
              {state === 'missing' && (
                <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold ml-auto">Missing</span>
              )}
              {state === 'unset' && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold ml-auto">Not checked</span>
              )}
            </label>
          );
        })}
      </div>

      {/* The escape hatch, and it only exists where "not assessed" is a real answer (registration).
          Hidden once used — with both already cleared there is nothing left to withdraw, and a live
          button that no-ops is worse than no button. */}
      {allowNotChecked && (cableStatus !== null || adapterStatus !== null) && (
        <div className="px-4 pb-3 -mt-1">
          <button
            type="button"
            onClick={() => { hapticLight(); onCableChange(null); onAdapterChange(null); }}
            className="text-[11px] text-blue-700/70 dark:text-blue-300/70 underline cursor-pointer"
          >
            Didn&apos;t check — register as not assessed
          </button>
        </div>
      )}

      {cableStatus === 'missing' && adapterStatus === 'missing' && (
        <div className="mx-3 mb-3 rounded-lg bg-red-600 dark:bg-red-700 px-4 py-3 text-center">
          <p className="text-xs font-black text-white uppercase tracking-widest">🚨 Hold Vehicle · Do Not Rent</p>
          <p className="text-[10px] text-red-200 mt-0.5">Both EV assets missing — flag before dispatch</p>
        </div>
      )}

      {lastCheck && (
        <div className="px-4 py-2 border-t border-blue-200 dark:border-blue-800/50">
          <p className="text-[10px] text-blue-600 dark:text-blue-500">
            Last checked: Cable {statusIcon(lastCheck.cableStatus)} · Adapter {statusIcon(lastCheck.adapterStatus)} · {fmtAgo(lastCheck.when)} by {lastCheck.byName}
          </p>
        </div>
      )}
    </div>
  );
}
