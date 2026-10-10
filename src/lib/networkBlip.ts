// Is this failure the NETWORK dropping a request (worth one quick retry), or anything else?
//
// ⭐ WHY (2026-09-29 measured, 2026-10-09 cooked on Aaron's "i'm good with your pick"). postgrest-js
// retries every failed read three times with 1s/2s/4s backoff, so a dead connection cost SEVEN
// seconds of silence before Find a car said "Couldn't search". Turning that off outright would
// surface every one-second 5G handoff on the lot as an error. So FG owns the retry instead: ONE,
// after a short pause, and only for this kind of failure — then it tells the truth.
//
// ⚠️ A TIMEOUT IS NOT A BLIP. A request that hung until the abort signal fired has already cost the
// full wait; retrying it would double a delay he has already sat through.

const BLIP = /failed to fetch|networkerror|load failed|network request failed/i;
const ABORT = /abort|timed? ?out/i;

export function isNetworkBlip(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; code?: string; message?: string };
  const text = `${e.name ?? ''} ${e.code ?? ''} ${e.message ?? ''}`;
  if (ABORT.test(text)) return false;
  return BLIP.test(text);
}

/** How long FG waits before its one retry. Long enough for a cell handoff, short enough that a dead
 *  network is still reported in under half a second. */
export const BLIP_RETRY_MS = 400;

/** A read that has not answered in this long gives up and SAYS so, instead of hanging forever (a
 *  connection that accepts the request and never replies rejects nothing, so nothing retried and
 *  nothing timed out). */
export const READ_TIMEOUT_MS = 8000;
