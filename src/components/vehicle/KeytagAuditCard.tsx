import { useState } from 'react';
import { VehicleName } from '../shared/VehicleName';
import { AUDIT_FIELDS, AUDIT_FIELD_LABELS, type AuditField, type AuditCandidate } from '../../lib/keytagAuditQueue';
import type { KeytagAuditEdits } from '../../context/keytagAuditWrite';
import type { Vehicle } from '../../types';

/**
 * One car, one tag photo, five fields — the whole loop.
 *
 * ⚠️ MOUNTED PER CAR (`key={vehicle.id}` at the call site), which is what keeps the seed-once trap
 * out of this file. Seeding form state from a prop with `useState(prop)` captures the value at
 * mount and silently ignores every later car; remounting makes the initial state correct by
 * construction. Deriving instead would mean losing what he has typed on every fleet refresh.
 *
 * ⭐ FG'S CURRENT VALUE IS SHOWN, not hidden — Aaron's call. Confirming has to be one tap or the
 * volume never works, and volume is the entire point. The honest cost is anchoring: a wrong value
 * he waves through stays wrong and is now stamped 'manual'. The mitigation is that the blanks are
 * marked, so his eye lands on the fields that need reading rather than on a wall of pre-filled text.
 */
export function KeytagAuditCard({ candidate, saving, onSave, onSkip, onFlagUnreadable }: {
  candidate: AuditCandidate<Vehicle>;
  saving: boolean;
  onSave: (edits: KeytagAuditEdits) => void;
  onSkip: () => void;
  onFlagUnreadable: () => void;
}) {
  const { vehicle, missing } = candidate;
  const [edits, setEdits] = useState<KeytagAuditEdits>(() => ({
    owningArea:  vehicle.owningArea  ?? '',
    rentalClass: vehicle.rentalClass ?? '',
    classCode:   vehicle.classCode   ?? '',
    unitNumber:  vehicle.unitNumber  ?? '',
    vinLast9:    vehicle.vinLast9    ?? '',
  }));
  const [zoomed, setZoomed] = useState(false);

  const set = (f: AuditField, v: string) => setEdits(prev => ({ ...prev, [f]: v }));
  const isMissing = (f: AuditField) => missing.includes(f);

  return (
    <div className="space-y-3">
      {/* Who this is */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{vehicle.licensePlate}</div>
          <VehicleName vehicle={vehicle} className="text-xs text-gray-500 dark:text-gray-400" />
        </div>
        <span className="shrink-0 text-xs text-gray-400">
          {missing.length === 0 ? 'nothing missing — confirm it' : `${missing.length} blank`}
        </span>
      </div>

      {/* The tag. Tap to fill the screen — a watermark across a VIN is the whole reason this
          feature exists, and it cannot be settled from a thumbnail. */}
      {vehicle.keytagPhotoUrl && (
        <button type="button" onClick={() => setZoomed(true)} className="block w-full cursor-zoom-in">
          <img src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}`}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-contain max-h-72 bg-gray-50 dark:bg-gray-950" />
        </button>
      )}
      {zoomed && vehicle.keytagPhotoUrl && (
        <div role="dialog" aria-label="Key tag, full size" onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 cursor-zoom-out">
          <img src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}, full size`}
            className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* The five fields, in tag reading order */}
      <div className="grid grid-cols-2 gap-2">
        {AUDIT_FIELDS.map(f => (
          <label key={f} className={f === 'vinLast9' ? 'col-span-2' : ''}>
            <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
              {AUDIT_FIELD_LABELS[f]}
              {isMissing(f) && <span className="ml-1 text-amber-600 dark:text-amber-400" title="blank on the record">•</span>}
            </span>
            <input
              type="text"
              value={edits[f] ?? ''}
              onChange={e => set(f, e.target.value)}
              placeholder={isMissing(f) ? 'read it off the tag' : ''}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors ${
                isMissing(f)
                  ? 'border-amber-300 dark:border-amber-700'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" disabled={saving} onClick={() => onSave(edits)}
          className="rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 text-sm font-bold text-gray-900 transition cursor-pointer">
          {saving ? 'Saving…' : '✓ Save & next'}
        </button>
        <button type="button" disabled={saving} onClick={onSkip}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition cursor-pointer">
          Skip
        </button>
        {/* The retake watchlist, written by the same tap that advances the queue. */}
        <button type="button" disabled={saving} onClick={onFlagUnreadable}
          className="rounded-lg border border-amber-300 dark:border-amber-800 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-40 transition cursor-pointer">
          Can't read this
        </button>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Saving locks every filled field as <strong>manually verified</strong> — later scans can no longer overwrite them.
      </p>
    </div>
  );
}
