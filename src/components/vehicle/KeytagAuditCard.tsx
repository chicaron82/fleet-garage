import { useState } from 'react';
import { VehicleName } from '../shared/VehicleName';
import { KeytagAuditFields, KeytagAuditActions } from './KeytagAuditFields';
import type { AuditField, AuditCandidate } from '../../lib/keytagAuditQueue';
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
 * he waves through stays wrong and is now stamped 'manual'. The mitigation is that blanks are
 * marked, so his eye lands on the fields that need reading.
 *
 * ⭐⭐ TWO LAYOUTS, ONE FORM. The card is fine for a legible tag. For the ones he has to zoom —
 * which is most of them, since a Last9vin is small print — the same fields render ON TOP of the
 * full-screen photo, because *"having to flip back between image entering things read from the tag
 * is tedious."* Five fields was five round trips per car. Neither layout owns the inputs; they both
 * render `KeytagAuditFields`, so the two can never disagree about what a tag holds.
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
  // Panel edge is HIS choice, not my guess: on a phone the keyboard rises from the bottom and can
  // sit over a bottom panel, but a top panel covers the tag's own top line — which edge is right
  // depends on the phone and on where the field he is reading sits. One tap to move it.
  const [panelAtTop, setPanelAtTop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  // An explicit stepper rather than pinch: a fixed full-screen overlay swallows page zoom on most
  // phones, so pinch would look available and do nothing.
  const [scale, setScale] = useState(1);

  const set = (f: AuditField, v: string) => setEdits(prev => ({ ...prev, [f]: v }));
  const save = () => onSave(edits);

  const panel = (
    <div className={`shrink-0 bg-gray-900/95 backdrop-blur border-white/10 ${panelAtTop ? 'border-b' : 'border-t'}`}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-semibold text-white/50 tabular-nums">
          {vehicle.licensePlate}
          {missing.length > 0 && <span className="ml-2 text-amber-300">{missing.length} blank</span>}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPanelAtTop(t => !t)} title="Move the fields to the other edge"
            className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10 cursor-pointer">⇅</button>
          <button type="button" onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'Hide the fields' : 'Show the fields'}
            className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10 cursor-pointer">{panelOpen ? '⌄' : '⌃'}</button>
        </div>
      </div>
      {panelOpen && (
        <div className="px-3 pb-3 space-y-2.5">
          <KeytagAuditFields edits={edits} missing={missing} tone="dark" onChange={set} />
          <KeytagAuditActions saving={saving} tone="dark" onSave={save} onSkip={onSkip} onFlagUnreadable={onFlagUnreadable} />
        </div>
      )}
    </div>
  );

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

      {vehicle.keytagPhotoUrl && (
        <button type="button" onClick={() => setZoomed(true)} className="block w-full cursor-zoom-in">
          <img src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}`}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-contain max-h-72 bg-gray-50 dark:bg-gray-950" />
          <span className="mt-1 block text-[11px] text-gray-400">Tap the tag to read and type without leaving it</span>
        </button>
      )}

      <KeytagAuditFields edits={edits} missing={missing} tone="light" onChange={set} />
      <KeytagAuditActions saving={saving} tone="light" onSave={save} onSkip={onSkip} onFlagUnreadable={onFlagUnreadable} />

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Saving locks every filled field as <strong>manually verified</strong> — later scans can no longer overwrite them.
      </p>

      {/* ⭐ The tag at full size WITH the form on it. dvh, not vh, so the mobile keyboard shrinks the
          photo instead of pushing the inputs off-screen. */}
      {zoomed && vehicle.keytagPhotoUrl && (
        <div role="dialog" aria-label={`Key tag for ${vehicle.licensePlate}, full size`}
          className="fixed inset-0 z-50 bg-black flex flex-col h-[100dvh]">
          {panelAtTop && panel}

          <div className="relative flex-1 min-h-0 overflow-auto">
            <button type="button" onClick={() => setScale(s => (s >= 3 ? 1 : s + 1))}
              title="Zoom the tag" className="block w-full cursor-zoom-in">
              <img src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}, full size`}
                style={{ width: `${scale * 100}%` }}
                className="max-w-none object-contain" />
            </button>
            <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white/70 tabular-nums">
              {scale}× · tap the tag to zoom
            </div>
            <button type="button" onClick={() => setZoomed(false)} aria-label="Close the full-size tag"
              className="absolute top-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white/80 hover:bg-black/80 cursor-pointer">✕</button>
          </div>

          {!panelAtTop && panel}
        </div>
      )}
    </div>
  );
}
