// Type a plate or a unit number, pick the car. The one typed-lookup affordance.
//
// ⭐⭐⭐ WHY IT EXISTS. Aaron, 2026-09-04, holding the Movement Log's typeahead beside the closing
// inventory's bare Look-up button: *"i feel the look up should work like movement log… this is the
// design inconsistency i mentioned in a previous session… this isn't a new thing. its just applied
// differently."*
//
// He was right and the audit was worse than he put it — FOUR implementations of *which car is this*:
// a plate-prefix typeahead here, an exact in-memory `===` in the closing inventory and the airport
// flip, and the scan resolver, which is the only one that ever tried the UNIT NUMBER. ⚠️ **The one
// place with the capability is the one place least likely to need it**: a scanned tag usually has
// both keys, while the man typing is typing *because* one of them is unreadable.
//
// ⭐ So `searchVehicles` now matches plate OR unit, and this is the shared surface over it. It is
// PRESENTATIONAL — it finds and it reports; committing to a car is the caller's job, because only
// the caller knows what happens next.
import { useEffect, useRef, useState } from 'react';
import { searchVehicles, type VehicleSearchResult } from '../../lib/ev-detection';
import { VehicleName } from './VehicleName';

export function VehicleLookup({ onPick, placeholder = 'Plate or unit — if the scan is down', busy, autoFocus }: {
  /** The chosen car, or — when he commits text that matched nothing — the raw string he typed. */
  onPick: (choice: { vehicle: VehicleSearchResult } | { typed: string }) => void;
  placeholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VehicleSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  // ⚠️ Guards against a slow early request landing after a fast later one and repainting the list
  // with results for a query he has already typed past.
  const seq = useRef(0);

  // ⚠️ NO SYNCHRONOUS setState IN HERE — ESLint refuses it, correctly, and the right answer is the
  // one the closing-inventory card already learned: DERIVE instead of copying into state. Clearing
  // `results` on a short query would be a second source of truth for something `query` already
  // knows, so `visible` below derives it and this effect only ever writes what the network returned.
  useEffect(() => {
    const mine = ++seq.current;
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      void searchVehicles(q).then(r => { if (live && mine === seq.current) { setResults(r); setOpen(true); } });
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [query]);

  /** What the list actually shows — derived, so a query he has deleted back down cannot leave a
   *  stale dropdown hanging over the field. */
  const visible = query.trim().length >= 2 ? results : [];

  const commitTyped = () => {
    const raw = query.trim().toUpperCase().replace(/\s+/g, '');
    if (!raw || busy) return;
    // ⚠️ TYPED, THEREFORE NEVER CORRECTED — the misread corrector belongs under a camera, not under
    // his thumbs. Same rule the airport flip states.
    onPick({ typed: raw });
    setQuery(''); setResults([]); setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          onFocus={() => { if (visible.length) setOpen(true); }}
          // ⚠️ Delayed so a tap on a suggestion lands before the list closes under the thumb.
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={e => { if (e.key === 'Enter') commitTyped(); if (e.key === 'Escape') setOpen(false); }}
          placeholder={placeholder}
          aria-label="Look up a vehicle by plate or unit number"
          autoFocus={autoFocus}
          autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="flex-1 h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
        />
        {/* 44px, gloves on — the standard every other target on a scan surface holds to. */}
        <button type="button" onClick={commitTyped} disabled={!query.trim() || busy}
          className="h-11 shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
          Look up
        </button>
      </div>

      {open && visible.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          {visible.map(v => {
            // ⭐ SAY WHICH KEY MATCHED. FG never resolves on a weaker key without saying so — the
            // rule the scan card already follows with `matchedByUnit`. If the plate does not start
            // with what he typed, the unit is what found this car, and he should see that.
            const byUnit = !v.license_plate.toUpperCase().startsWith(query.trim());
            return (
              <li key={v.license_plate}>
                <button type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onPick({ vehicle: v }); setQuery(''); setResults([]); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{v.license_plate}</span>
                  {/* ⚠️⚠️ NEVER HAND-ASSEMBLE THE NAME. Interpolating the year, make and model
                      renders perfectly and silently drops the powertrain badge — which is how a
                      hybrid Civic read identically to a petrol one on three screens at once. FG's
                      architecture test caught exactly this line, and `is_hybrid`/`is_tesla` are in
                      the search result FOR this.
                      ⭐ It also caught the first version of THIS COMMENT, which quoted the banned
                      shape verbatim. The detector reads raw source, so writing the anti-pattern
                      down is writing it — and rewording is cheaper than an allowlist, which is
                      where a real identity line would eventually hide. */}
                  <span className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {byUnit && v.unit_number ? `unit ${v.unit_number} · ` : ''}
                    <VehicleName vehicle={{ year: v.year, make: v.make, model: v.model, isHybrid: v.is_hybrid, isTesla: v.is_tesla }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
