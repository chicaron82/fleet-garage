// "Re-read the stored tags" — the backlog half of the key-tag pipeline fix (c5f8dd6).
//
// That commit taught the WRITERS to accept owning area, model code and VIN, which the reader had
// been extracting all along. It is forward-looking: the 45 cars already sitting in Aaron's audit
// queue still hold the blanks. His answer to "just re-upload the photos": *"having to find 45
// keytags from ~150 to reupload is a hassle lol isn't there a better solution. can't it just be
// re-read and filled out? leaving the key count?"*
//
// So this loops the SHIPPED single-read engine over the photos FG already stores — no new read
// logic, no new resolve logic, and no upload. The per-car decision is the pure `planKeytagReread`.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { fetchImageAsDataUrl } from '../lib/image';
import { planKeytagReread } from '../lib/planKeytagReread';
import { isAuditable } from '../lib/keytagAuditQueue';
import type { Vehicle } from '../types';

export interface RereadState {
  running: boolean;
  progress: { done: number; total: number } | null;
  /** Cars whose stored photo could be re-read into at least one blank field. */
  filled: number;
  /** Blank fields actually written across the run — what he no longer has to type. */
  fieldsFilled: number;
  /** Cars where the fresh read DISAGREES with a value already on the record. Never applied; worth
   *  his eyes, and they stay in the audit queue where his eyes already go. */
  disagreed: number;
  /** ⚠️ Cars whose stored photo is a tag for a DIFFERENT car. Nothing written — the finding is the
   *  product, and it is the one worth stopping for. */
  wrongPhoto: { plate: string; readPlate: string }[];
  /** Photos that could not be fetched or read at all. */
  failed: number;
  /** How many cars a run would cover right now — shown BEFORE he taps, because each one is a
   *  model call on his API key. */
  candidates: number;
  run: () => Promise<void>;
}

export function useKeytagReread(): RereadState {
  const { readKeytag } = useKeytagRead();
  const { allVehicles, updateVehicleFields } = useVehicleHoldContext();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [filled, setFilled] = useState(0);
  const [fieldsFilled, setFieldsFilled] = useState(0);
  const [disagreed, setDisagreed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [wrongPhoto, setWrongPhoto] = useState<{ plate: string; readPlate: string }[]>([]);

  // ⚠️ THE SAME PREDICATE THE AUDIT QUEUE USES, not a second definition of "worth re-reading". A
  // car with no photo has nothing to re-read; a car he has already audited holds MANUAL values that
  // must not be second-guessed by a model. `isAuditable` already says exactly that.
  const targets = allVehicles.filter(v => !v.archivedAt && isAuditable(v));

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setFilled(0); setFieldsFilled(0); setDisagreed(0); setFailed(0); setWrongPhoto([]);
    // Snapshot the list: `allVehicles` is rewritten by every successful fill, and iterating a list
    // that reshuffles under the loop is how a run silently skips cars.
    const queue: Vehicle[] = allVehicles.filter(v => !v.archivedAt && isAuditable(v));
    setProgress({ done: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      const v = queue[i];
      try {
        const image = v.keytagPhotoUrl ? await fetchImageAsDataUrl(v.keytagPhotoUrl) : null;
        const read = image ? await readKeytag(image) : null;
        if (!read) {
          setFailed(n => n + 1);
        } else {
          const plan = planKeytagReread(read, v);
          // ⚠️ Reported and skipped, never written. A tag that belongs to another car is not
          // evidence about this one — see planKeytagReread's wrongPhotoCheck (LUR243).
          if (plan.wrongPhoto) setWrongPhoto(l => [...l, { plate: v.licensePlate, readPlate: plan.wrongPhoto!.readPlate }]);
          if (plan.disagreements.length > 0) setDisagreed(n => n + 1);
          if (plan.fills.length > 0) {
            await updateVehicleFields(v.id, plan.fills);
            setFilled(n => n + 1);
            setFieldsFilled(n => n + plan.fills.length);
          }
        }
      } catch {
        // One car's failure costs that car. The run continues — a half-finished pass he can see the
        // shape of beats an aborted one that reports nothing.
        setFailed(n => n + 1);
      }
      setProgress({ done: i + 1, total: queue.length });
    }
    setRunning(false);
  }, [running, allVehicles, readKeytag, updateVehicleFields]);

  return {
    running, progress, filled, fieldsFilled, disagreed, failed, wrongPhoto,
    candidates: targets.length,
    run,
  };
}
