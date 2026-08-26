import type { Vehicle } from '../../types';

// The EV kit, settable where he actually checks it — at the car, tag in hand.
//
// Aaron, 2026-08-26: *"when I scan a Tesla, the assets should be treated like a key count. two
// check boxes. checked ✅ present. unchecked, missing."*
//
// ⭐ THE GAP THIS CLOSES. The scan sheet already SHOWED EV status ("last seen missing the cable" —
// see evAssetScanStatus) and gave him no way to record what he found. So the one place he opens the
// trunk was the one place he could not say what was in it; only registration and the EV tab could
// write. He had already told me he checks assets at the scan (2026-08-25: *"if i have a tesla and
// scan it and it turns out it doesn't exist in FG i check its assets"*) — the write just had
// nowhere to land.
//
// ⚠️⚠️ AN UNTOUCHED CONTROL WRITES NOTHING, and that rule is doing real work here. "Two checkboxes,
// unchecked = missing" describes what a box MEANS once he has decided, not what an unvisited row
// claims. If mounting this recorded "both missing", every Tesla he scanned and walked away from
// would silently report its kit gone — the exact trap the register form had, where a control that
// answers itself on mount turns a glance into a false assessment. So the boxes RENDER the stored
// value (like the key count, which shows 2 highlighted rather than asking afresh) and only a tap
// writes.
//
// A null asset — never assessed — renders unchecked but is NOT missing. It becomes an answer the
// moment he taps, and stays silent until then.
export function ScanEvAssets({ vehicle, onSet, saving }: {
  vehicle: Pick<Vehicle, 'hasMobileCable' | 'hasJ1772Adapter'>;
  /** Called with the FULL pair, because the write takes both — see updateVehicleEVAssets. */
  onSet: (hasMobileCable: boolean, hasJ1772Adapter: boolean) => void;
  saving?: boolean;
}) {
  const cable = vehicle.hasMobileCable === true;
  const adapter = vehicle.hasJ1772Adapter === true;

  const box = (label: string, on: boolean, next: () => void) => (
    <button
      type="button"
      onClick={next}
      disabled={saving}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      /* 44px, gloves on — the same standard as the key-count row it sits under. */
      className={`h-11 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer disabled:opacity-40 ${
        on
          ? 'bg-fg-yellow border-fg-yellow text-black'
          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      {on ? '✅' : '⬜'} {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap" data-testid="scan-ev-assets">
      <span className="text-xs text-gray-500 dark:text-gray-400">🔌 EV kit —</span>
      <div className="flex gap-2">
        {box('Cable', cable, () => onSet(!cable, adapter))}
        {box('Adapter', adapter, () => onSet(cable, !adapter))}
      </div>
    </div>
  );
}
