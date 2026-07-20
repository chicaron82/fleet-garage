// Shared vision-model fallback policy for the assistant endpoints. Extracted from
// fg-schedule-parse so the *decision* — is this worth a second attempt on another model? —
// is pinned by tests. It can't be verified live: proving it works needs a real outage of
// the primary model, which is exactly the moment you don't want to be discovering a typo
// in an error-class name.
import Anthropic from '@anthropic-ai/sdk';

/**
 * Is this an "the model wasn't reachable" failure rather than an "we asked wrong" one?
 *
 * Only the former is worth retrying on another model — re-sending a bad API key, a
 * malformed request or a permissions failure just buys a second guaranteed failure on
 * someone else's clock, and doubles the latency before the operator sees the real error.
 *
 * Covers: 429 rate-limited, any 5xx (incl. 529 `overloaded_error`, the actual shape of a
 * capacity outage), and connection failures that never got a response at all.
 *
 * NOTE: the Claude API's own `fallbacks` request parameter does NOT cover these — it fires
 * on safety refusals only, and per the API docs rate limits, overloads and server errors
 * "are returned as-is, never falling back". Availability fallback has to be client-side.
 */
export function isAvailabilityError(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError
  );
}
