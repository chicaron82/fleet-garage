import { useState } from 'react';

// The way out when the camera can't help — type the plate instead.
//
// Aaron, 2026-08-25, standing at a car with a dead scanner (my doing — a backfill had drained the
// API credits): *"how bout a fall back to enter plate if the scanner goes down too and it would
// count it as being seen."*
//
// The airport flip has had exactly this since July. The HEADER scanner — the surface he reaches
// for most — had none, so a vision outage turned it into a dead end. "Degrade, never dead-end" was
// already the rule in scanRouterActions; this is that rule applied one level up, to the read itself.
//
// Deliberately QUIET and always present, not an error-state rescue: a fallback that only appears
// after a failure is one he has to fail first to discover, and on a slow read he would sit waiting
// instead of typing. It costs one muted line of screen and removes a whole failure mode.
export function ScanManualPlate({ onSubmit, busy }: {
  onSubmit: (plate: string) => void;
  busy?: boolean;
}) {
  const [plate, setPlate] = useState('');

  const submit = () => {
    if (!plate.trim() || busy) return;
    onSubmit(plate);
    setPlate('');
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        value={plate}
        onChange={e => setPlate(e.target.value.toUpperCase())}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="or type a plate — if the scan's down"
        aria-label="Enter a plate manually"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!plate.trim() || busy}
        /* 44px, gloves on — the same standard as every other target on this overlay. */
        className="h-11 shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
      >
        Look up
      </button>
    </div>
  );
}
