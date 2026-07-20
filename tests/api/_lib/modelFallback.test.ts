import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { isAvailabilityError } from '../../../api/_lib/modelFallback';

// The fallback path can only be proven by a real outage of the primary model, so the
// classification is pinned here instead. If an SDK upgrade renames or re-parents one of
// these error classes, the fallback would silently stop firing — these tests fail first.

/** Build a real SDK error the way the SDK itself does — from a status + error body. */
function apiError(status: number, type: string): Anthropic.APIError {
  return Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type, message: 'boom' } },
    'boom',
    new Headers(),
  );
}

describe('isAvailabilityError', () => {
  it('treats 529 overloaded as retryable — the actual shape of a capacity outage', () => {
    const err = apiError(529, 'overloaded_error');
    expect(err).toBeInstanceOf(Anthropic.InternalServerError);
    expect(isAvailabilityError(err)).toBe(true);
  });

  it('treats 500 and 503 as retryable', () => {
    expect(isAvailabilityError(apiError(500, 'api_error'))).toBe(true);
    expect(isAvailabilityError(apiError(503, 'api_error'))).toBe(true);
  });

  it('treats 429 rate-limited as retryable', () => {
    const err = apiError(429, 'rate_limit_error');
    expect(err).toBeInstanceOf(Anthropic.RateLimitError);
    expect(isAvailabilityError(err)).toBe(true);
  });

  it('treats a connection failure (no response at all) as retryable', () => {
    expect(isAvailabilityError(new Anthropic.APIConnectionError({ message: 'socket hang up' }))).toBe(true);
  });

  it('does NOT retry configuration errors — a second call would fail identically', () => {
    expect(isAvailabilityError(apiError(400, 'invalid_request_error'))).toBe(false);
    expect(isAvailabilityError(apiError(401, 'authentication_error'))).toBe(false);
    expect(isAvailabilityError(apiError(403, 'permission_error'))).toBe(false);
    expect(isAvailabilityError(apiError(404, 'not_found_error'))).toBe(false);
  });

  it('does NOT retry a request that was simply too large', () => {
    expect(isAvailabilityError(apiError(413, 'request_too_large'))).toBe(false);
  });

  it('ignores non-SDK throwables rather than masking a real bug as an outage', () => {
    expect(isAvailabilityError(new TypeError('cannot read property of undefined'))).toBe(false);
    expect(isAvailabilityError('a string')).toBe(false);
    expect(isAvailabilityError(null)).toBe(false);
    expect(isAvailabilityError(undefined)).toBe(false);
  });
});
