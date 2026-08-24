import { useCallback, useSyncExternalStore } from 'react';
import {
  startParse, subscribeParse, getParseState, resetParse, adoptParse, parsingImage, type JobState,
} from '../lib/scheduleParseJob';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';

// Client side of the schedule-photo import (Phase 1). READ-ONLY — nothing is written here; the
// preview is the product.
//
// ⚠️ THE FETCH USED TO LIVE IN THIS HOOK, and that made the read die with the modal: unmounting
// orphaned the promise, it landed on a dead component, and the answer was discarded. Closing the
// sheet mid-read cost a vision call and returned nothing. The job now lives at module scope
// (lib/scheduleParseJob) and this hook is a subscription to it — so the read carries on while he
// goes and scans a car, and whoever is mounted when it lands picks it up.
type ImportStatus = 'idle' | 'parsing' | 'done' | 'error';

export function useScheduleImport() {
  // useSyncExternalStore, not useState+useEffect: the read can finish between the first render and
  // the subscription, and this is the primitive built to close exactly that gap without tearing.
  // (`getParseState` returns the same object reference until the job actually emits, which is the
  // contract it needs.)
  const job: JobState = useSyncExternalStore(subscribeParse, getParseState, getParseState);

  const parse = useCallback(async (image: string) => { startParse(image); }, []);
  const reset = useCallback(() => { resetParse(); }, []);

  /** Adopt a parse restored from a draft without re-reading the sheet — a fresh vision call costs
   *  money and could return a DIFFERENT grid than the one his overrides were made against, silently
   *  pointing his corrections at the wrong cells. */
  const hydrate = useCallback((image: string, schedule: ParsedSchedule, wasDegraded: boolean) => {
    adoptParse(image, schedule, wasDegraded);
  }, []);

  return {
    status: job.status as ImportStatus,
    schedule: job.status === 'done' ? job.schedule : null,
    error: job.status === 'error' ? job.error : null,
    degraded: job.status === 'done' ? job.degraded : false,
    /** The image the running read belongs to — lets a resume tell "still mine" from "a stale job". */
    parsingImage,
    parse,
    reset,
    hydrate,
  };
}
