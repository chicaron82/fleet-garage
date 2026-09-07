import { useState } from 'react';
import { asRotation, nextRotation } from '../../lib/keytagPhotoRotation';
import { KeytagPhoto } from './KeytagPhoto';
import { KeytagRetake } from './KeytagRetake';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight } from '../../lib/haptics';

/**
 * The key tag at full size on the vehicle RECORD — read it, turn it, zoom it, vouch for it.
 *
 * ⚠️ EXTRACTED FROM `VehicleRecordFacts` (2026-09-07), which was 437 lines and over the cap before
 * any of this landed. The overlay already existed there and was already the right place; it simply
 * had no controls.
 *
 * ⭐ THE THREE THINGS AARON HIT DURING A REAL KEY AUDIT, all on this one surface because that is
 * where he was standing when each one bit:
 *
 *   1. *"is there a way to add zoom toggles when on desktop? on my phone i can use gestures."* The
 *      audit card has had a stepper for a week; the record relied on the browser's own pinch, which
 *      desktop does not have. THE GAP WAS THE PAGE, NOT THE DEVICE.
 *   2. *"a way to rotate the tag on record"* — rotation has been built and persisted since migration
 *      133, but the ↻ lived only in the auditor.
 *   3. *"what happens when it reads the tag wrong. is there a way to correct it."* — see below.
 *
 * ⚠️ ROTATION WRITES THROUGH `rotateKeytagPhoto`, NOT the audit path. `saveKeytagAudit` stamps
 * `keytag_audited_at/by/result: 'verified'`, so reusing it would mark a car AUDITED for the crime of
 * turning its photo — quietly retiring it from the queue with nobody having read it.
 */
export function KeytagZoomOverlay({ vehicleId, plate, keytagPhotoUrl, keytagPhotoRotation, keytagPhotoConfirmedAt, keytagPhotoConfirmedBy, audited, onClose }: {
  vehicleId: string;
  plate?: string | null;
  keytagPhotoUrl?: string | null;
  keytagPhotoRotation?: number | null;
  /** Set = a human has vouched that this photo is this car's, overruling a plate mismatch. */
  keytagPhotoConfirmedAt?: string | null;
  /** Who vouched. Shown, not merely stored — a claim this strong should carry a name. */
  keytagPhotoConfirmedBy?: string | null;
  /** Whether this car carries an audit stamp — decides if the re-audit escape hatch is offered. */
  audited: boolean;
  onClose: () => void;
}) {
  const { reopenKeytagAudit, rotateKeytagPhoto, confirmKeytagPhoto } = useVehicleHoldContext();
  // ⚠️ Seeded from the prop and remounted with the overlay, so re-opening always shows what is
  // stored. Not a seed-once trap: the overlay's whole lifetime is one viewing.
  const [rotation, setRotation] = useState(() => asRotation(keytagPhotoRotation));
  // An explicit stepper, matching the auditor. A fixed full-screen overlay swallows page zoom on
  // most phones, so pinch would look available and do nothing — and on desktop there is no pinch.
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  const confirmed = Boolean(keytagPhotoConfirmedAt);

  const rotate = async () => {
    hapticLight();
    const next = nextRotation(rotation);
    setRotation(next);                      // optimistic: the turn must feel instant
    const ok = await rotateKeytagPhoto(vehicleId, next);
    if (!ok) setRotation(rotation);         // ⚠️ put it back rather than show a lie
  };

  const toggleConfirm = async () => {
    setBusy(true);
    await confirmKeytagPhoto(vehicleId, !confirmed);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      {keytagPhotoUrl ? (
        <div className="relative w-full max-w-md overflow-auto max-h-[70dvh]" onClick={e => e.stopPropagation()}>
          {/* ⚠️ THE SAME DEFECT AARON FOUND IN THE AUDITOR, in another room: a rotated image kept its
              upright footprint and painted outside it. `KeytagPhoto` carries the turned box, so the
              layout is honest at every angle — and `scale` makes the box big enough to pan inside. */}
          <KeytagPhoto src={keytagPhotoUrl} alt={`Key tag${plate ? ` for ${plate}` : ''}`}
            rotation={rotation} scale={scale} title="Zoom the tag"
            onClick={() => setScale(sc => (sc >= 3 ? 1 : sc + 1))} />
        </div>
      ) : (
        <p className="relative text-white/70 text-sm">No key tag photo on file for this car.</p>
      )}

      {keytagPhotoUrl && (
        <div className="relative mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <span className="rounded bg-black/60 px-2 py-1 text-[11px] text-white/70 tabular-nums">
            {scale}× · tap the tag to zoom
          </span>
          <button type="button" onClick={() => void rotate()} aria-label="Rotate the tag"
            className="rounded-full bg-black/60 hover:bg-black/80 text-white/80 w-9 h-9 text-sm transition cursor-pointer">↻</button>
        </div>
      )}

      <div className="relative mt-3 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
        <KeytagRetake vehicleId={vehicleId} onReplaced={onClose} />

        {/* ⭐⭐ "THIS TAG REALLY IS THIS CAR'S" — the answer to *"what happens when it reads the tag
            wrong."* The re-read vetoes a car whose tag reads a different plate, which is right
            (LUR243 wrote a 2026 VIN onto a 2025 Versa off a misfiled photo) — but it cannot tell a
            MISREAD from a MISFILE, and XN294J read as XN294Z is one character. Without this the
            warning re-fires on every future run forever and the blanks are never filled.
            ⚠️ Offered HERE, looking at the photo full-size, because that is the only place the claim
            can honestly be made. And it toggles: a wrong tap costs a tap, not a silenced guard. */}
        {keytagPhotoUrl && (
          <button type="button" disabled={busy} onClick={() => void toggleConfirm()}
            className={`text-xs font-semibold underline cursor-pointer disabled:opacity-50 ${
              confirmed ? 'text-emerald-300 hover:text-emerald-200' : 'text-white/70 hover:text-white'}`}>
            {confirmed
              ? '✓ Confirmed as this car’s tag — undo'
              : 'This tag is this car’s (stops the wrong-tag warning)'}
          </button>
        )}
        {/* ⚠️ WHO AND WHEN, SHOWN — not decoration. The vehicle-field census caught
            `keytag_photo_confirmed_by` being written and rendered nowhere, which is the exact
            reader/writer defect that hid `vin_last9` behind a 380-row backfill. And it is the right
            UX independently: this flag RETIRES A GUARD, so the record should name who retired it,
            the same way the audit stamp names who audited. */}
        {confirmed && keytagPhotoConfirmedAt && (
          <p className="text-[11px] text-emerald-300/70">
            vouched by {keytagPhotoConfirmedBy ?? 'someone'} on{' '}
            {new Date(keytagPhotoConfirmedAt).toLocaleDateString()}
          </p>
        )}

        {audited && (
          <button type="button" onClick={() => { void reopenKeytagAudit(vehicleId); onClose(); }}
            className="text-xs font-semibold text-white/70 hover:text-white underline cursor-pointer">
            Re-audit this tag — put it back in the queue
          </button>
        )}
      </div>

      <button type="button" aria-label="Close" onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl cursor-pointer">×</button>
    </div>
  );
}
