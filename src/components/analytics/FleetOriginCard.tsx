import { useMemo, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { fleetOrigin, type OriginVehicle } from '../../lib/fleetOrigin';
import { vehicleNameText } from '../../lib/vehicleName';

// What's in our fleet, by origin — three cards inside "What FG has recorded".
// The rules live in src/lib/fleetOrigin.ts; the design trail in docs/ticket-fleet-by-origin.md.
//
// ⭐ The copy is his, and it DESCRIBES rather than explains. On 2026-09-17 the first mock captioned
// a bucket with a reason I had invented ("absorbed, not yet re-plated") and XT193P proved the
// opposite reason. A label names what is observable; a reason appears only where he gave it.

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4';
const TITLE = 'text-sm font-semibold text-gray-900 dark:text-gray-100';
const SUB = 'text-[11px] text-gray-500 dark:text-gray-400 mt-1';
const TESLA_PREVIEW = 6;

function Plates({ cars, onOpen }: { cars: OriginVehicle[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {cars.map(v => (
        <button key={v.id} type="button"
          onClick={() => { hapticLight(); onOpen(v.id); }}
          title={vehicleNameText({ year: v.year ?? null, make: v.make ?? null, model: v.model ?? null })}
          className="font-mono text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-fg-yellow cursor-pointer transition">
          {v.licensePlate}
        </button>
      ))}
    </div>
  );
}

export function FleetOriginCard({ vehicles, onOpenVehicle }: {
  vehicles: readonly OriginVehicle[];
  onOpenVehicle: (vehicleId: string) => void;
}) {
  const o = useMemo(() => fleetOrigin(vehicles), [vehicles]);
  const [allTeslas, setAllTeslas] = useState(false);
  const [openCity, setOpenCity] = useState<string | null>(null);

  if (o.live === 0) return null;

  const hereCount = o.convertedHere.teslas.length + o.convertedHere.oneWays.length;
  const converted = hereCount + o.convertedAway.length;
  const pct = (n: number) => `${((n / o.live) * 100).toFixed(1)}%`;
  const teslas = allTeslas ? o.convertedHere.teslas : o.convertedHere.teslas.slice(0, TESLA_PREVIEW);
  const hiddenTeslas = o.convertedHere.teslas.length - teslas.length;
  const maxCity = Math.max(1, ...o.cities.map(c => c.count));

  return (<>
    {/* ── where the fleet comes from ────────────────────────────────────── */}
    <div className={CARD}>
      <p className={TITLE}>Local — Manitoba plate and Winnipeg owning</p>
      <p className={SUB}>Both halves have to agree. A plate is a receipt from the last branch that re-plated the car.</p>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{o.local}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">of {o.live} live</span>
        <span className="ml-auto text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
          {Math.round((o.local / o.live) * 100)}%
        </span>
      </div>
      <div className="flex h-2 mt-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700"
        role="img" aria-label={`${o.local} local, ${o.foreignOwned} foreign-owned, ${converted} converted, ${o.unknown.length} unknown`}>
        <span className="bg-fg-yellow" style={{ width: pct(o.local) }} />
        <span className="bg-gray-400 dark:bg-gray-500" style={{ width: pct(o.foreignOwned) }} />
        <span className="bg-amber-600 dark:bg-amber-400" style={{ width: pct(converted) }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600 dark:text-gray-300">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-fg-yellow" />Local {o.local}</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-gray-400 dark:bg-gray-500" />Foreign-owned {o.foreignOwned}</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-600 dark:bg-amber-400" />Converted {converted}</span>
      </div>
      {/* ⚠️ SELF-HIDES AT ZERO. It existed to name 51 blank rows; after 2026-09-17 there were none.
          It comes back on its own the next time a car is registered without an owning area. */}
      {o.unknown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            {o.unknown.length} with no owning area yet
          </p>
          <Plates cars={o.unknown} onOpen={onOpenVehicle} />
        </div>
      )}
    </div>

    {/* ── cars converted ──────────────────────────────────────────────────── */}
    {converted > 0 && (
      <div className={CARD}>
        <p className={TITLE}>Cars converted</p>
        <p className={SUB}>One branch&apos;s plates, another branch&apos;s books. Normal circulation — nothing here needs fixing.</p>

        {hereCount > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">Converted here</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{hereCount}</span>
            </div>
            {o.convertedHere.teslas.length > 0 && (<>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                <b className="text-gray-700 dark:text-gray-200">{o.convertedHere.teslas.length} Teslas</b> — our fleet needed them, so a batch was put on MB plates.
              </p>
              <Plates cars={teslas} onOpen={onOpenVehicle} />
              {o.convertedHere.teslas.length > TESLA_PREVIEW && (
                <button type="button" onClick={() => { hapticLight(); setAllTeslas(a => !a); }}
                  className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 cursor-pointer hover:underline">
                  {allTeslas ? 'show fewer' : `+${hiddenTeslas} more`}
                </button>
              )}
            </>)}
            {o.convertedHere.oneWays.length > 0 && (<>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
                <b className="text-gray-700 dark:text-gray-200">{o.convertedHere.oneWays.length} low-km one-ways</b> — arrived here and were worth keeping.
              </p>
              <Plates cars={o.convertedHere.oneWays} onOpen={onOpenVehicle} />
            </>)}
          </div>
        )}

        {o.convertedAway.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">Converted away</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{o.convertedAway.length}</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Ours, now wearing another province&apos;s plates.</p>
            <Plates cars={o.convertedAway} onOpen={onOpenVehicle} />
          </div>
        )}
      </div>
    )}

    {/* ── by owning city ──────────────────────────────────────────────────── */}
    <div className={CARD}>
      <p className={TITLE}>What each city sends us</p>
      <p className={SUB}>Older and newer owning numbers fold into their city. Tap one for its class mix.</p>
      <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
        {o.cities.map(c => {
          const open = openCity === c.city;
          return (
            <div key={c.city}>
              <button type="button" aria-expanded={open}
                onClick={() => { hapticLight(); setOpenCity(open ? null : c.city); }}
                className="w-full text-left py-2.5 cursor-pointer">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{c.city}</span>
                  <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">{c.codes.join(' · ')}</span>
                  <span className="ml-auto text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{c.count}</span>
                </div>
                <span className="block h-1.5 mt-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <span className="block h-full bg-fg-yellow" style={{ width: `${Math.max(2, (c.count / maxCity) * 100)}%` }} />
                </span>
                <span className="flex text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  <span className={c.mbPlated > 0 && c.city !== 'Winnipeg' ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''}>
                    MB-plated {c.mbPlated}
                  </span>
                  <span className="ml-auto">{open ? 'classes ▴' : 'classes ▾'}</span>
                </span>
              </button>
              {open && (
                <div className="flex flex-wrap gap-1 pb-3">
                  {c.classes.map(([cls, n]) => (
                    <span key={cls} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {cls} <b className="text-gray-900 dark:text-gray-100">{n}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </>);
}
