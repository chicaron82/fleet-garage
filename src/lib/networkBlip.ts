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

import { writeWithRefresh } from './supabase';

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

/** A read someone is WAITING on (a tap, typing, a screen with a spinner): FG's fast path, the one `searchVehicles`
 *  has inline. postgrest-js's own three retries are turned off, a dropped request gets ONE retry after
 *  `BLIP_RETRY_MS`, a token that ran out is refreshed once (`writeWithRefresh`), and a THROWN failure comes back as
 *  `error` like a returned one, so the caller always has something to say. A dead network answers in under a second
 *  instead of seven. (docs/ticket-waited-on-reads-still-wait-seven-seconds.md, 2026-10-18.)
 *
 *  ⚠️ Only where someone is waiting. A background load (a sync on open, a card that fills in later) is better served
 *  by the library's patient retries, and must not use this. */
export async function readOnce<R extends { data: unknown; error: unknown }>(
  build: () => PromiseLike<R> & { retry(enabled: boolean): PromiseLike<R> },
  retryMs: number = BLIP_RETRY_MS,
): Promise<R | { data: null; error: unknown }> {
  const attempt = async () => {
    try { return await writeWithRefresh(() => build().retry(false)); } catch (thrown) { return { data: null, error: thrown }; }
  };
  const first = await attempt();
  if (!isNetworkBlip(first.error)) return first;
  await new Promise(resolve => setTimeout(resolve, retryMs));
  return attempt();
}

/** Thrown when a read someone is waiting on came back failed, so the screen says so instead of showing what an empty
 *  answer would look like (an empty fleet, a shift report of zeros). */
export class ReadFailedError extends Error {}

/** Every result in, or a `ReadFailedError` with `message`. For screens that build one answer out of many reads (the
 *  shift report reads 14): one failed read means the whole answer is not true, so none of it is shown. */
export function throwIfAnyFailed(results: readonly { error: unknown }[], message: string): void {
  if (results.some(r => r.error)) throw new ReadFailedError(message);
}
