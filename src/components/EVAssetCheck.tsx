import { useEffect } from 'react';
import { hapticLight } from '../lib/haptics';
import type { EvAssetStatus } from '../types';

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
}: EVAssetCheckProps) {
  // Default both to present on mount — normal case requires zero taps
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
          const val       = statuses[key];
          const set       = handlers[key];
          const isPresent = val !== 'missing';
          return (
            <label key={key} className="flex items-center gap-3 cursor-pointer py-2">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                isPresent
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
              }`}>
                {isPresent && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isPresent}
                onChange={() => { hapticLight(); set(isPresent ? 'missing' : 'present'); }}
              />
              <span className={`text-sm font-medium transition-colors ${
                isPresent
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {label}
              </span>
              {val === 'missing' && (
                <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold ml-auto">Missing</span>
              )}
            </label>
          );
        })}
      </div>

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
