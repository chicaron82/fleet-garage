// The universal scan-router overlay: snap a key tag → read → resolve against the fleet → show
// WHAT the car is + its state → offer only the actions that make sense → route to the module
// pre-filled. One shared flow behind both entry points (My Day card + header icon).
// Thin-hub law: this resolves and ROUTES — every action hands off to the module that owns it.
// The action menu itself is pure + tested (lib/scanRouterActions); this is just its surface.
import { useRef, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { compressImage } from '../../lib/image';
import { resolveKeytagScan, type KeytagScanResult } from '../../lib/resolveKeytagScan';
import { scanRouterActions } from '../../lib/scanRouterActions';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Screen } from '../../types';

interface Props {
  navigate: (screen: Screen) => void;
  onClose: () => void;
}

export function ScanRouterOverlay({ navigate, onClose }: Props) {
  const { readKeytag, status, error } = useKeytagRead();
  const { vehicles, holds } = useVehicleHoldContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<{ read: KeytagRead; result: KeytagScanResult } | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const reading = status === 'reading';

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErrMsg('');
    setScan(null);
    const base64 = await compressImage(file);
    const read = await readKeytag(base64);
    if (!read?.plate) { setErrMsg(error ?? 'Could not read that key tag — try again.'); return; }
    setScan({ read, result: resolveKeytagScan(read, vehicles) });
  };

  const actions = scan ? scanRouterActions(scan.read, scan.result) : [];
  const vehicle = scan?.result.vehicle ?? null;
  const activeHolds = vehicle ? holds.filter(h => h.vehicleId === vehicle.id && h.status === 'ACTIVE').length : 0;

  const go = (screen: Screen) => { navigate(screen); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Scan a key tag">
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">📷 Scan a key tag</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
          />

          {!scan && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Snap the tag — FG will tell you what the car is and what you can do with it.</p>
              <button
                type="button"
                disabled={reading}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 px-4 py-4 text-black font-semibold text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {reading ? 'Reading…' : '📷 Snap the key tag'}
              </button>
            </>
          )}

          {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}

          {scan && (
            <>
              {/* What the car IS + its state — resolve first, so the menu below is smart. */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                {scan.result.wasCorrected && scan.result.rawPlate && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Read <span className="font-mono">{scan.result.rawPlate}</span> → corrected to <span className="font-mono font-semibold">{scan.result.plate}</span>
                  </p>
                )}
                <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {scan.result.plate}{vehicle?.unitNumber ? ` · Unit ${vehicle.unitNumber}` : ''}
                </p>
                {vehicle ? (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}{vehicle.color ? ` · ${vehicle.color}` : ''}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${activeHolds > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {activeHolds > 0 ? `🔧 On hold (${activeHolds})` : '✅ Clear'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Not in the fleet{actions.some(a => a.kind === 'register') ? '' : ' — couldn’t read enough to register it'}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {actions.map(a => (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => go(a.screen)}
                    className="w-full flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-left"
                  >
                    <span className="text-base leading-none">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                    <span className="text-gray-300 dark:text-gray-600">→</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setScan(null); setErrMsg(''); }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                Scan another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
