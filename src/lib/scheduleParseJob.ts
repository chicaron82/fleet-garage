// A schedule read that outlives the modal that started it.
//
// ⚠️ WHY IT IS NOT IN THE HOOK. `useScheduleImport` owned the fetch, so unmounting the modal orphaned
// the promise: it kept running, landed on a dead component, and the answer was thrown away. Closing
// the sheet mid-read cost a vision call and gave nothing back. Aaron's actual ask (2026-08-24) was to
// snap the photo, walk off and scan a car, and come back to a grid that is ready — and that cannot be
// done from inside the thing he is walking away from.
//
// So the job lives at module scope: one read at a time, started by whoever, observed by whoever is
// around when it lands. The modal subscribes; if nobody is subscribed the result is still kept, which
// is the entire point.
//
// ⭐ IT WRITES ITS RESULT INTO THE DRAFT ITSELF. The component that would normally do the saving may
// not exist when the answer arrives, so the job persists it — otherwise "come back later" would only
// work if he happened to be watching at the right moment.
import { supabase } from './supabase';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';
import { loadImportDraft, saveImportDraft } from './scheduleImportDraft';

export type JobState =
  | { status: 'idle' }
  /** `startedAt` is epoch-ms. The client always knew how long it had been waiting and threw it
   *  away — this is the whole fix for "it looks stalled". */
  | { status: 'parsing'; startedAt: number }
  | { status: 'done'; schedule: ParsedSchedule; degraded: boolean }
  | { status: 'error'; error: string };

let state: JobState = { status: 'idle' };
let listeners = new Set<(s: JobState) => void>();
/** The image the running job is reading — so a resume can tell "mine" from "someone else's sheet". */
let readingImage: string | null = null;

function emit(next: JobState) {
  state = next;
  for (const l of listeners) l(next);
}

export function getParseState(): JobState { return state; }
export function parsingImage(): string | null { return readingImage; }

export function subscribeParse(fn: (s: JobState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Adopt a parse restored from a saved draft as the job's current result — WITHOUT re-reading the
 *  sheet. A fresh vision call costs money and could return a different grid than the one his
 *  corrections were made against, silently pointing them at the wrong cells. It goes into the store
 *  rather than a component's state so it survives the next time the modal closes, too. */
export function adoptParse(image: string, schedule: ParsedSchedule, degraded: boolean): void {
  readingImage = image;
  emit({ status: 'done', schedule, degraded });
}

/** Forget the last result. An explicit retake — the old sheet's answer must not resurface. */
export function resetParse(): void {
  readingImage = null;
  emit({ status: 'idle' });
}

/**
 * Start reading a sheet. A second call for the SAME image while one is in flight is ignored rather
 * than duplicated — resuming a draft must not pay for a second vision call just because the modal
 * was reopened.
 */
export function startParse(image: string): void {
  if (state.status === 'parsing' && readingImage === image) return;
  readingImage = image;
  emit({ status: 'parsing', startedAt: Date.now() });

  void (async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/fg-schedule-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      });
      const data = (await res.json().catch(() => null)) as
        | { schedule?: ParsedSchedule; degraded?: boolean; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error || `Parse failed (${res.status})`);
      // ⚠️ He may have moved on to a different sheet while this one was in the air. Landing it now
      // would overwrite the read he is actually waiting for, silently.
      if (readingImage !== image) return;
      const schedule = data?.schedule ?? { staff: [] };
      const degraded = data?.degraded === true;
      persist(image, schedule, degraded);
      emit({ status: 'done', schedule, degraded });
    } catch (e) {
      if (readingImage !== image) return;
      emit({ status: 'error', error: e instanceof Error ? e.message : 'Could not parse the schedule.' });
    }
  })();
}

/** Fold the result into the saved draft, keeping whatever corrections are already there. */
function persist(image: string, schedule: ParsedSchedule, degraded: boolean): void {
  const draft = loadImportDraft();
  saveImportDraft({
    image,
    schedule,
    degraded,
    // A draft for a DIFFERENT sheet must not lend its overrides to this one — they index by row and
    // column, so they would land on whatever happens to sit at those coordinates now.
    nameOverrides: draft && draft.image === image ? draft.nameOverrides : {},
    cellOverrides: draft && draft.image === image ? draft.cellOverrides : {},
  });
}

/** Test seam — reset module state between cases. */
export function __resetParseJobForTests(): void {
  state = { status: 'idle' };
  readingImage = null;
  listeners = new Set();
}
