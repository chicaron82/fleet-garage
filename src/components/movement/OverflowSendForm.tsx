// "Send to overflow" — the second half of the Movement Log's one card. The plate comes from the
// SHARED input above (typed, or filled by the key-tag scan there); tapping a spot logs that car
// straight to it. A stack of tags is the batch path: attach, review, log.
//
// ⭐⭐ MERGED INTO THE TRIP CARD 2026-09-09, his design: *"what say we combine the two sends. typing
// out a plate could serve as the fallback if i don't have the keytag(s) on me. and if it happens to
// be overflow, then i'll tap AV Flight or FastAir and it gets logged"* — *"an airport trip would
// still be timed. enter/scan plate. tap the quick start button. overflow would be enter/scan plate.
// tap where its going. and it just logs where it was sent."*
//
// ⭐ ONE QUESTION, TWO OUTCOMES. The card asked "which car?" twice, in two different ways, with two
// different scan buttons. The car was always the same question; the BUTTON is the whole decision —
// a quick-start card runs a live timer, a spot chip logs a finished one-way move.
//
// ⚠️ Its own scan button is gone, not lost: the shared `KeytagSearchScan` above fills the same
// plate. What stays here is the STACK (`takeMany` → `scanPhotos`), which is a different gesture —
// photograph a pile, attach, review — and the reason the batch route stopped being the lossy one.
//
// State + writes live in useOverflowSend.
import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useOverflowSend, type OverflowSend } from '../../hooks/useOverflowSend';
import { KeytagReplateOffer } from '../scan-router/KeytagReplateOffer';
import { OVERFLOW_UI_DESTINATIONS } from '../../../api/_lib/overflowProposal';
import { Toast } from '../shared/Toast';
import { PhotoError } from '../../components/shared/PhotoError';

const BADGE: Record<OverflowSend['status'], { label: string; cls: string }> = {
  registered:   { label: '✨ Registered', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  backfilled:   { label: '✨ Updated',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  known:        { label: 'On file',      cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  unregistered: { label: '⚠️ Not in fleet', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export function OverflowSendForm({ onLogged, plate, onPlateSent }: {
  onLogged?: () => void;
  /** The plate from the card's shared input — typed, or filled by the key-tag scan above. */
  plate?: string;
  /** Clear the shared input once its car has been sent, so the next one starts empty. */
  onPlateSent?: () => void;
}) {
  const ov = useOverflowSend(onLogged);
  // ⚠️ Upper-cased for the chip, because the chip is a PROMISE of what will be logged — and
  // `sendPlateTo` upper-cases before writing. A chip reading "lur537 → FastAir" would name a plate
  // that never appears in the record.
  const typed = (plate ?? '').trim().toUpperCase();
  const { photoError, takeMany } = usePhotoIntake();
  const filesRef = useRef<HTMLInputElement>(null);


  /**
   * ⭐ Aaron used the Effie chat for this instead — *"i went for the chat because I could send
   * multiple in one go"* — and the chat's tool keeps only the plate. The one-at-a-time camera
   * stays (it is the right tool at the car); this is the stack, so the batch route is no longer
   * the lossy one.
   *
   * ⚠️ `takeMany` reports how many photos failed to compress rather than dropping them silently —
   * a partial batch must never look like a clean one.
   */
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const base64s = await takeMany(Array.from(files));
    if (base64s.length) await ov.scanPhotos(base64s);
  };

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Send to overflow <span className="normal-case tracking-normal text-gray-400 dark:text-gray-600">· logged, no timer</span>
      </p>

      {/* ⭐ THE SPOT CHIP IS THE ACTION when a plate is in hand: tap it and the car is logged there.
          With no plate it just arms the destination for the stack below — same control, and which
          job it is doing is visible from whether a plate is filled in. */}
      <div className="flex gap-1">
        {OVERFLOW_UI_DESTINATIONS.map(d => (
          <button
            key={d}
            type="button"
            disabled={ov.logging}
            onClick={() => {
              hapticLight();
              // ⚠️ ARM IT EITHER WAY. Tapping with a plate used to log and leave `destination`
              // untouched, so a stack attached afterwards went wherever the chip had been armed
              // BEFORE — silently, and wrong in the direction that puts cars on the wrong list.
              ov.setDestination(d);
              if (!typed) return;
              void ov.sendPlateTo(typed, d).then(ok => { if (ok) onPlateSent?.(); });
            }}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
              // ⚠️ `typed || …` lit BOTH chips whenever a plate was present, so the armed spot
              // was invisible exactly when it mattered. The highlight tracks the destination only.
              ov.destination === d
                ? 'bg-fg-yellow text-gray-900 hover:bg-fg-yellow-hi'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {typed ? `${typed} → ${d}` : d}
          </button>
        ))}
      </div>

      <PhotoError message={photoError} />
      {/* ⚠️ `multiple`, and NO `capture` — same reasoning as BatchKeytagScan: you photograph a
          stack of tags first and attach them after, so forcing the camera would be wrong here. */}
      <input
        ref={filesRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={ov.reading || !!ov.scanProgress}
          onClick={() => filesRef.current?.click()}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          📎 Attach a stack of key tags
        </button>
        {ov.scanProgress && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {ov.scanProgress.done} / {ov.scanProgress.total}
          </span>
        )}
      </div>
      {ov.err && <p className="text-xs text-red-500">{ov.err}</p>}

      {/* Staged list */}
      {ov.sends.length > 0 && (
        <div className="space-y-1.5">
          {ov.sends.map((s, i) => (
            <div key={`${s.plate}-${i}`}>
            {/* ⚠️ A send logs `vehicle_plate` as a STRING — no vehicle_id — so a re-plated car files
                a trip under a plate FG connects to nothing. Rare enough that at most one row in a
                batch ever shows this; the nonce is per row so dismissing one leaves the others. */}
            <KeytagReplateOffer vehicle={s.vehicle} tagPlate={s.plate} scanNonce={`${s.plate}-${i}`} />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{s.plate}</span>
              <span className="text-gray-400 dark:text-gray-500 text-xs truncate">{s.label}</span>
              <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE[s.status].cls}`}>{BADGE[s.status].label}</span>
              <button type="button" aria-label="Remove" onClick={() => ov.remove(i)} className="shrink-0 text-gray-400 hover:text-red-500 text-xs cursor-pointer">✕</button>
            </div>
            </div>
          ))}
          <button
            type="button"
            disabled={ov.logging}
            onClick={() => void ov.logSends()}
            className="w-full rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi py-2 text-sm font-semibold text-black transition cursor-pointer disabled:opacity-60"
          >
            {ov.logging ? 'Logging…' : `Log ${ov.sends.length} send${ov.sends.length === 1 ? '' : 's'} → ${ov.destination}`}
          </button>
        </div>
      )}

      {ov.toast && <Toast message={ov.toast} variant="success" />}
    </div>
  );
}
