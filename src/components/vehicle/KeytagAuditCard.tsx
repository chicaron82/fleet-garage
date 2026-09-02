import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { VehicleName } from '../shared/VehicleName';
import { KeytagAuditFields, KeytagAuditActions } from './KeytagAuditFields';
import { auditWarnings, auditKeyCountOffered, type AuditField, type AuditCandidate } from '../../lib/keytagAuditQueue';
import { asRotation, nextRotation } from '../../lib/keytagPhotoRotation';
import { KeytagPhoto } from './KeytagPhoto';
import type { OwningGuess } from '../../lib/owningFromUnit';
import type { OwningPreset } from '../../lib/owningPresets';
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
export function KeytagAuditCard({ candidate, saving, knownRentalClasses, knownModelCodes, guessOwning, owningPresets, zoomed, onZoomChange, remaining, onSave, onSkip, onFlagUnreadable }: {
  candidate: AuditCandidate<Vehicle>;
  saving: boolean;
  /** The two vocabularies FG already holds — the guard catches a value from one landing in the
   *  other's box. No shape rule: plenty of tags spell the model out (SELTOS, COMPASS, Model Y)
   *  and carry no code at all. */
  knownRentalClasses: ReadonlySet<string>;
  knownModelCodes: ReadonlySet<string>;
  /** What the fleet's unit numbers say about the branch — Aaron's own shortcut, computed. */
  guessOwning: (unitNumber: string) => OwningGuess;
  /** Named branches this fleet carries — one tap instead of four digits. */
  owningPresets: readonly OwningPreset[];
  /** ⭐ ZOOM IS CONTROLLED FROM ABOVE THE `key`, deliberately. This component remounts per car so
   *  the edits and the zoom SCALE reset — correct for both. But local zoom state meant Save & next
   *  dropped him out of the full-screen view on EVERY vehicle, so he had to tap the tag again for
   *  each one. Aaron: *"when i save to go next, the view stays as zoomed, rather than me tapping to
   *  go back."* Lifting only this one flag keeps him in the view he chose. */
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
  /**
   * ⭐ HOW MANY ARE LEFT, INCLUDING THIS ONE — shown on the panel strip because that strip is the
   * only thing on screen when he is zoomed in reading a tag.
   *
   * ⚠️ Aaron, 2026-09-01, mid-audit: *"whatcha think of adding something to let me know how much i
   * have left to do when i have it zoomed in"*. The count already existed — as a line BELOW the
   * card, in the section — and the zoomed view is a full-screen dialog that does not render it at
   * all. So the number was there, and never once where he was looking. A batching job with no
   * visible end is the difference between "a few more" and "how long has this been".
   */
  remaining: number;
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
  // Panel edge is HIS choice, not my guess: on a phone the keyboard rises from the bottom and can
  // sit over a bottom panel, but a top panel covers the tag's own top line — which edge is right
  // depends on the phone and on where the field he is reading sits. One tap to move it.
  const [panelAtTop, setPanelAtTop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  // An explicit stepper rather than pinch: a fixed full-screen overlay swallows page zoom on most
  // phones, so pinch would look available and do nothing.
  const [scale, setScale] = useState(1);

  // ⭐ EVERY VALUE ON A KEY TAG IS UPPERCASE — a branch number, a rental class, a model code, a unit
  // number, nine VIN characters. None of the five has a lowercase form, so uppercasing as he types
  // is not a preference, it is the field's actual alphabet.
  //
  // ⚠️ `autoCapitalize="characters"` steers a MOBILE keyboard and nothing else. On a real keyboard
  // it does nothing, so `crvb` would have been stored lowercase beside two RAV4s carrying `CRVB` —
  // codex lookups normalise and would still resolve, but any exact match (the fleet queries, the
  // wrong-box guard's own vocabulary) would silently miss the car. Uppercasing here also means the
  // guard compares what he SEES rather than a value it quietly re-cased behind him.
  const set = (f: AuditField, v: string) => setEdits(prev => ({ ...prev, [f]: v.toUpperCase() }));
  // ⭐ A quarter-turn for a sideways tag. Local until he saves, so a stray tap costs nothing — and
  // the stored FILE is never re-encoded; this is display metadata only (migration 133).
  const [rotation, setRotation] = useState(() => asRotation(vehicle.keytagPhotoRotation));
  const rotate = () => { hapticLight(); setRotation(r => nextRotation(r)); };
  const setKeyCount = (v: string) => setEdits(prev => ({ ...prev, keyCount: v }));
  // ⚠️ Offered only on a car with NO count. One that already has one is never re-asked — that
  // number came off a ring in someone's hand, and re-asking from a photo invites a worse answer
  // over a better one.
  const keysOffered = auditKeyCountOffered(vehicle);

  const save = () => onSave({ ...edits, photoRotation: rotation });
  // Recomputed every keystroke — it is a pure read of what is in the boxes right now, and he should
  // see the mix-up while the tag is still in front of him, not after Save.
  const warnings = auditWarnings(edits, knownRentalClasses, knownModelCodes);
  // Asked about the unit currently in the box, not the one on the record, so correcting the unit
  // moves the suggestion with it.
  const owningGuess = guessOwning(edits.unitNumber ?? '');

  const panel = (
    <div className={`shrink-0 bg-gray-900/95 backdrop-blur border-white/10 ${panelAtTop ? 'border-b' : 'border-t'}`}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-semibold text-white/50 tabular-nums">
          {vehicle.licensePlate}
          {missing.length > 0 && <span className="ml-2 text-amber-300">{missing.length} blank</span>}
          {/* ⭐ "last one" rather than "1 left" on the final tag. Batching is a stamina problem as
              much as a work one, and the end of the pile is worth naming — it is the one count that
              changes what he decides to do next. `remaining` includes the car on screen. */}
          {remaining > 0 && (
            <span className="ml-2 text-white/40">
              {remaining === 1 ? 'last one' : `${remaining} left`}
            </span>
          )}
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
          <KeytagAuditFields edits={edits} missing={missing} warnings={warnings} owningGuess={owningGuess} owningPresets={owningPresets} tone="dark" keyCountOffered={keysOffered} onChange={set} onKeyCountChange={setKeyCount} />
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
        <div className="relative">
          {/* ⚠️ A FIXED SQUARE THAT CLIPS. Aaron, 2026-08-30: *"rotating before zooming, goes over
              the keycount."* A CSS transform does not affect layout, so the turned photo kept its
              upright footprint in the flow and painted straight over the controls below it. */}
          <button type="button" onClick={() => onZoomChange(true)} className="block w-full cursor-zoom-in">
            <KeytagPhoto src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}`} rotation={rotation} />
            <span className="mt-1 block text-[11px] text-gray-400">Tap the tag to read and type without leaving it</span>
          </button>
          {/* ⭐ Aaron, 2026-08-30: *"some are shown on its side is there a way to rotate them here in
              the audit, and the saved photo as well?"* Four taps return it exactly as captured — the
              file is never touched, so a wrong turn costs a tap rather than image quality. */}
          <button type="button" onClick={rotate} aria-label="Rotate the tag"
            className="absolute top-1.5 right-1.5 rounded-lg bg-gray-900/70 hover:bg-gray-900/90 text-white w-8 h-8 text-sm transition cursor-pointer">
            ↻
          </button>
        </div>
      )}

      <KeytagAuditFields edits={edits} missing={missing} warnings={warnings} owningGuess={owningGuess} owningPresets={owningPresets} tone="light" keyCountOffered={keysOffered} onChange={set} onKeyCountChange={setKeyCount} />

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
            {/* ⚠️ Aaron: *"rotating after zooming, i can't zoom in further."* The rotation style was
                spread AFTER this width and its `width: '100%'` clobbered the zoom — taps still moved
                `scale`, nothing moved on screen. Sizing and turning now live in one place. */}
            <KeytagPhoto src={vehicle.keytagPhotoUrl} alt={`Key tag for ${vehicle.licensePlate}, full size`}
              rotation={rotation} scale={scale} title="Zoom the tag"
              onClick={() => setScale(sc => (sc >= 3 ? 1 : sc + 1))} />
            {/* ⚠️ THE ROTATE CONTROL BELONGS HERE TOO, and for the same reason the key count does:
                zoomed is where he is actually READING the tag, so it is exactly where a sideways one
                needs turning. Leaving it only on the small card would repeat the split he just
                reported — enter one thing here, tap away, finish there. */}
            <button type="button" onClick={rotate} aria-label="Rotate the tag"
              className="absolute top-2 left-2 mt-8 rounded-full bg-black/60 hover:bg-black/80 text-white/80 w-9 h-9 text-sm transition cursor-pointer">
              ↻
            </button>
            <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white/70 tabular-nums">
              {scale}× · tap the tag to zoom
            </div>
            <button type="button" onClick={() => onZoomChange(false)} aria-label="Close the full-size tag"
              className="absolute top-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white/80 hover:bg-black/80 cursor-pointer">✕</button>
          </div>

          {!panelAtTop && panel}
        </div>
      )}
    </div>
  );
}
