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

      <div className="p-3 space-y-2">
        {ASSETS.map(({ key, label }) => {
          const val = statuses[key];
          const set = handlers[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { hapticLight(); set(val === 'present' ? null : 'present'); }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                  val === 'present'
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400'
                    : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'
                }`}
              >
                ✓ Present
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); set(val === 'missing' ? null : 'missing'); }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                  val === 'missing'
                    ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400'
                    : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
              >
                ✗ Missing
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-36 shrink-0">{label}</span>
            </div>
          );
        })}
      </div>

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
