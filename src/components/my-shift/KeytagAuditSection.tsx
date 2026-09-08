// "Audit key tags" — he reads the tags FG couldn't, one car at a time, between cars.
// A thin surface over useKeytagAudit (the queue) and KeytagAuditCard (the car); this file owns
// only the collapse, the headline counts, and the two things worth stopping for — a failed write
// and a blocked unit number. Lives beside Batch Keytag Scan because it is the same downtime
// session: one control captures tags, the other reads them. Collapsed by default.
import { useState } from 'react';
import { useKeytagAudit } from '../../hooks/useKeytagAudit';
import { KeytagAuditCard } from '../vehicle/KeytagAuditCard';
import { KeytagRereadRow } from './KeytagRereadRow';

export function KeytagAuditSection({ onOpenVehicle }: {
  /** So the unit-conflict notice can OPEN the other car it names — see the notice below. */
  onOpenVehicle?: (vehicleId: string) => void;
}) {
  const { current, remaining, stats, retakes, knownRentalClasses, knownModelCodes, guessOwning, owningPresets, saving, error, unitConflict, save, skip, flagUnreadable, dismissConflict } = useKeytagAudit();
  const [collapsed, setCollapsed] = useState(true);
  // ⭐ HELD HERE, ABOVE THE PER-CAR `key`. The card remounts on every save so its edits and zoom
  // scale reset; if the zoom FLAG lived there too it would reset as well, dropping him out of the
  // full-screen view on every single vehicle. This is the one piece of that state that belongs to
  // the sitting rather than to the car.
  const [zoomed, setZoomed] = useState(false);
  // ⚠️ Collapsed by default: this line must not get taller on a busy day (`472020e`, same morning).
  const [showRetakes, setShowRetakes] = useState(false);
  const open = !collapsed;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors">
      <button type="button" onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          🏷️ Audit key tags
          {stats.pending > 0 && (
            <span className="ml-2 font-semibold text-gray-400 tabular-nums">{stats.pending} to read</span>
          )}
        </span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
          {/* What a full pass would recover, so the queue length means something. */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stats.gaps > 0
              ? <>Reading these fills <strong className="tabular-nums">{stats.gaps}</strong> blank fields no model could settle. Confirming a field that is already right locks it against later misreads.</>
              : <>Every blank is filled. Confirming a car still locks its fields against later misreads.</>}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
            <span>✓ {stats.verified} verified</span>
            {/* ⭐⭐ TAPPABLE — Aaron, 2026-09-08: *"it tells me 1 needs a retake… what if i wanna know
                what it is."* The list has been in `retakeWatchlist` all along and the hook never
                handed it over, so this line could count what it could not name.
                ⚠️ The principle was already TEN LINES BELOW, in this file, on the unit-conflict
                notice: *"a card that names a car and can't open it is a to-do list that can't open
                its own items."* Caught once, fixed there, and left standing here. */}
            {retakes.length > 0 ? (
              <button type="button" onClick={() => setShowRetakes(r => !r)} aria-expanded={showRetakes}
                className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                ⚠️ {retakes.length} need a retake {showRetakes ? '▲' : '▼'}
              </button>
            ) : (
              <span>⚠️ 0 need a retake</span>
            )}
            {/* 📷 NOT tappable, deliberately (his call, 2026-09-08): those 73 already have a home in
                Fleet's "No keytag" chip. A count needs to name its items only when nothing else
                does — duplicating a list that has a screen is clutter wearing an affordance's
                clothes. ⚠️ Scale-dependent: if it ever drops to a handful, revisit. */}
            <span>📷 {stats.noPhoto} have no photo yet</span>
          </div>

          {showRetakes && retakes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              {retakes.map(v => (
                <li key={v.id} className="flex items-baseline gap-2 text-[11px]">
                  {onOpenVehicle ? (
                    <button type="button" onClick={() => onOpenVehicle(v.id)}
                      className="font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 cursor-pointer">
                      {[v.licensePlate, v.unitNumber].filter(Boolean).join(' · ')}
                    </button>
                  ) : (
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      {[v.licensePlate, v.unitNumber].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {/* ⭐ One errand, two expectations — say which he'll find at the car. */}
                  <span className="text-amber-700/70 dark:text-amber-400/70">
                    {v.keytagAuditResult === 'stale' ? 'wrong tag on file' : 'photo unreadable'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <KeytagRereadRow />

          {error && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">⚠️ {error}</p>}

          {/* ⚠️ Worth stopping for: a unit number is fleet-wide, so the same one on two records means
              it has drifted onto the wrong car. The data cannot say which record is right — only the
              tag can, and he is looking at it right now. */}
          {unitConflict && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 space-y-1">
              {/* ⭐ THE PLATE OPENS THE OTHER CAR. This notice exists to send him to a second record
                  — "one of those two records has the wrong unit, and only the tags can say which" —
                  and until now it named that record and made him go find it by hand. Same defect
                  Aaron caught on the hybrid card the same afternoon: *"this isn't tappable. so i
                  have to look this up to make the correction."* A card that names a car and can't
                  open it is a to-do list that can't open its own items. */}
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Unit # not applied —{' '}
                {onOpenVehicle ? (
                  <button type="button" onClick={() => onOpenVehicle(unitConflict.id)}
                    className="underline underline-offset-2 font-bold cursor-pointer">
                    {unitConflict.licensePlate}
                  </button>
                ) : unitConflict.licensePlate}
                {' '}already carries it.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Everything else you read was saved. One of those two records has the wrong unit, and only the tags can say which.
              </p>
              <button type="button" onClick={dismissConflict}
                className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 underline cursor-pointer">
                Got it
              </button>
            </div>
          )}

          {current ? (
            <>
              {/* Remounted per car — see KeytagAuditCard's header for why that matters. */}
              <KeytagAuditCard
                key={current.vehicle.id}
                candidate={current}
                saving={saving}
                knownRentalClasses={knownRentalClasses}
                knownModelCodes={knownModelCodes}
                guessOwning={guessOwning}
                owningPresets={owningPresets}
                zoomed={zoomed}
                onZoomChange={setZoomed}
                remaining={remaining}
                onSave={save}
                onSkip={skip}
                onFlagUnreadable={flagUnreadable}
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{remaining} left in this sitting</p>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.pending === 0
                ? 'Nothing left to audit — every stored tag has been read.'
                : 'You have skipped everything in the queue. Reopen this later and they will be back.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
