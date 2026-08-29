// "Audit key tags" — he reads the tags FG couldn't, one car at a time, between cars.
// A thin surface over useKeytagAudit (the queue) and KeytagAuditCard (the car); this file owns
// only the collapse, the headline counts, and the two things worth stopping for — a failed write
// and a blocked unit number. Lives beside Batch Keytag Scan because it is the same downtime
// session: one control captures tags, the other reads them. Collapsed by default.
import { useState } from 'react';
import { useKeytagAudit } from '../../hooks/useKeytagAudit';
import { KeytagAuditCard } from '../vehicle/KeytagAuditCard';

export function KeytagAuditSection() {
  const { current, remaining, stats, knownRentalClasses, knownModelCodes, guessOwning, owningPresets, saving, error, unitConflict, save, skip, flagUnreadable, dismissConflict } = useKeytagAudit();
  const [collapsed, setCollapsed] = useState(true);
  // ⭐ HELD HERE, ABOVE THE PER-CAR `key`. The card remounts on every save so its edits and zoom
  // scale reset; if the zoom FLAG lived there too it would reset as well, dropping him out of the
  // full-screen view on every single vehicle. This is the one piece of that state that belongs to
  // the sitting rather than to the car.
  const [zoomed, setZoomed] = useState(false);
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
            <span>⚠️ {stats.unreadable} need a retake</span>
            <span>📷 {stats.noPhoto} have no photo yet</span>
          </div>

          {error && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">⚠️ {error}</p>}

          {/* ⚠️ Worth stopping for: a unit number is fleet-wide, so the same one on two records means
              it has drifted onto the wrong car. The data cannot say which record is right — only the
              tag can, and he is looking at it right now. */}
          {unitConflict && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Unit # not applied — {unitConflict.licensePlate} already carries it.
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
