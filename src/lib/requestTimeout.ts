// One time limit for every request FG sends to Supabase, set where the client is built.
//
// ⭐ WHY (surveyed 2026-10-10, cooked on Aaron's "allez cuisine"). A connection that ACCEPTS a request
// and never answers rejects nothing, so nothing errors, nothing retries, and a form sits on
// "Saving…" until the browser gives up minutes later. That was fixed twice in one week, one call
// site each (`6104e42` Find a car, `ce16ba4` the fleet balance) while ~190 other writes had no limit.
// It is a property of the network, so the limit lives under all of them.
//
// ⚠️ THE CLOCK STOPS WHEN THE ANSWER STARTS. The limit covers "sent, nothing came back" and is
// cleared the moment response headers arrive. A big read trickling in on a weak signal is slow, not
// hung, and cutting it off would break a load that used to finish.
//
// ⚠️ AN ABORT, BY NAME. postgrest-js never retries an `AbortError` (PostgrestBuilder.ts, "Never retry
// aborted requests"). Any other name on a GET would be retried three more times, each waiting the
// full limit again.

/** Row reads and writes, and auth. Rows are small; twelve seconds of nothing is not a slow answer. */
export const ROW_TIMEOUT_MS = 12_000;
/** Photo uploads. ⚠️ The clock runs while the photo is still going UP, and a weak signal on the lot
 *  makes that slow for honest reasons, so this is deliberately long. */
export const UPLOAD_TIMEOUT_MS = 120_000;

const GAVE_UP = 'FG stopped waiting';

export function timeoutFor(url: string): number {
  return url.includes('/storage/v1/') ? UPLOAD_TIMEOUT_MS : ROW_TIMEOUT_MS;
}

/** Was this failure FG's own time limit (not the network refusing, not the server saying no)? */
export function isGaveUp(error: unknown): boolean {
  if (!error) return false;
  const e = error as { message?: string };
  return typeof e.message === 'string' && e.message.includes(GAVE_UP);
}

/**
 * Would sending this request a SECOND time make a second thing?
 *
 * ⚠️ A timed-out request may still have LANDED. An update, an upsert or a delete sent again changes
 * nothing. A plain insert makes a second row, and an rpc may undo itself (a shift swapped twice is
 * swapped back). Those are the ones that must say "check before you try again".
 */
export function makesSomethingNew(url: string, method: string, headers?: HeadersInit): boolean {
  if (method.toUpperCase() !== 'POST' || !url.includes('/rest/v1/')) return false;
  const prefer = new Headers(headers).get('Prefer') ?? '';
  return !prefer.includes('resolution=');
}

export interface GaveUp {
  url: string;
  method: string;
  makesSomethingNew: boolean;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

export function withTimeout(base: typeof fetch, onGaveUp?: (info: GaveUp) => void): typeof fetch {
  return async (input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? 'GET';
    const limit = timeoutFor(url);
    const controller = new AbortController();

    // A caller's own signal still works, and may be tighter than the shared limit.
    const own = init?.signal;
    if (own?.aborted) controller.abort(own.reason);
    else own?.addEventListener('abort', () => controller.abort(own.reason), { once: true });

    const timer = setTimeout(() => {
      onGaveUp?.({ url, method, makesSomethingNew: makesSomethingNew(url, method, init?.headers) });
      controller.abort(new DOMException(`${GAVE_UP} after ${Math.round(limit / 1000)}s`, 'AbortError'));
    }, limit);

    try {
      return await base(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
