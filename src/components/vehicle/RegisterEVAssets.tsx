import type { EvAssetCheck } from '../../hooks/useEvAssetCheck';

/**
 * Collapsed by default, and collapsed means today's exact behaviour: registers as "Not assessed".
 *
 * The rule this preserves is **never ASSUME present**. That is NOT the same rule as "never RECORD
 * at registration", and the two had been collapsed into one — which is what sent Aaron back to the
 * fleet list to find a car he was standing next to (2026-08-24: *"I need to register then find it
 * again to update its assets"*). A box he ticks at the open trunk isn't an assumption; it's the
 * strongest observation FG collects, and `EvSource`'s own docs say so — a car in hand in the bay
 * beats a glance at check-in.
 *
 * Both assets or neither, deliberately: `updateVehicleEVAssets` takes the pair in ONE call — there
 * is no single-asset write — so all-or-nothing is the data layer's shape rather than a UI
 * shortcut. It also matches the act: they live in the same place in the car, so one look answers
 * both.
 */
export function RegisterEVAssets({ check }: { check: EvAssetCheck }) {
  const { assessed, hasCable, hasAdapter, setAssessed, setHasCable, setHasAdapter, reset } = check;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">⚡ EV Assets</p>
        {assessed && (
          <button
            type="button"
            /* ⚠️ reset(), not setAssessed(false). Withdrawing has to discard the answers too:
               closing the gate alone would leave a stale "Missing" selected, so re-opening later
               would show a verdict he made about an earlier look and let him submit it as a
               fresh one. Withdrawn means withdrawn. */
            onClick={reset}
            className="text-[11px] text-blue-700/70 dark:text-blue-300/70 underline cursor-pointer"
          >
            Didn&apos;t check
          </button>
        )}
      </div>

      {!assessed ? (
        <>
          <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
            Registers as <span className="font-semibold">Not assessed</span> — nothing is assumed. If the charge cable &amp; J1772 adapter are in front of you, log them now instead of coming back for it.
          </p>
          <button
            type="button"
            onClick={() => setAssessed(true)}
            className="w-full min-h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer"
          >
            ✓ I checked them
          </button>
        </>
      ) : (
        <div className="space-y-2">
          {[
            { label: 'Mobile Charge Cable', value: hasCable, set: setHasCable },
            { label: 'J1772 Adapter', value: hasAdapter, set: setHasAdapter },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-blue-900/80 dark:text-blue-200/80">{label}</span>
              {/* 44px tall — tapped with nitrile gloves on, same standard as the key-count row. */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set(true)}
                  aria-pressed={value}
                  className={`h-11 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${value ? 'bg-green-600 border-green-600 text-white' : 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'}`}
                >
                  ✓ Present
                </button>
                <button
                  type="button"
                  onClick={() => set(false)}
                  aria-pressed={!value}
                  className={`h-11 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${!value ? 'bg-red-600 border-red-600 text-white' : 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'}`}
                >
                  ✗ Missing
                </button>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-blue-700/70 dark:text-blue-300/70">
            Logged to the asset history on register, sourced to the washbay.
          </p>
        </div>
      )}
    </div>
  );
}
