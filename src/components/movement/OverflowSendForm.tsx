// "Log overflow sends" — the client-side overflow entry in the Movement Log tab. Pick a spot,
// scan a stack of key tags (each registers/backfills the car from the read so the send isn't an
// orphan), then log them all as one-way trips. State + writes live in useOverflowSend.
import { useRef } from 'react';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useOverflowSend, type OverflowSend } from '../../hooks/useOverflowSend';
import { KeytagReplateOffer } from '../scan-router/KeytagReplateOffer';
import { OVERFLOW_DESTINATIONS } from '../../../api/_lib/overflowProposal';
import { Toast } from '../shared/Toast';
import { PhotoError } from '../../components/shared/PhotoError';
import { ScanButton } from '../shared/ScanButton';

const BADGE: Record<OverflowSend['status'], { label: string; cls: string }> = {
  registered:   { label: '✨ Registered', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  backfilled:   { label: '✨ Updated',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  known:        { label: 'On file',      cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  unregistered: { label: '⚠️ Not in fleet', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export function OverflowSendForm({ onLogged }: { onLogged?: () => void }) {
  const ov = useOverflowSend(onLogged);
  const { photoError, takeOne, takeMany } = usePhotoIntake();
  const filesRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const base64 = await takeOne(file);
    if (base64) await ov.scanPhoto(base64);
  };

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
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">📦 Log overflow sends</p>

      {/* Destination */}
      <div className="flex gap-1">
        {OVERFLOW_DESTINATIONS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => ov.setDestination(d)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition cursor-pointer ${
              ov.destination === d
                ? 'bg-fg-yellow text-black'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Scan — one at the car, or a stack from the roll. */}
      <PhotoError message={photoError} />
      <ScanButton onFile={onFile} reading={ov.reading} variant="outline" fullWidth />
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
