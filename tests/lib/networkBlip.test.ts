import { describe, it, expect } from 'vitest';
import { isNetworkBlip } from '../../src/lib/networkBlip';

describe('isNetworkBlip — what earns the one retry', () => {
  it('a dropped request, as each browser words it', () => {
    expect(isNetworkBlip(new TypeError('Failed to fetch'))).toBe(true);                     // Chrome
    expect(isNetworkBlip({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);   // postgrest's shape
    expect(isNetworkBlip(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true); // Firefox
    expect(isNetworkBlip(new TypeError('Load failed'))).toBe(true);                         // Safari
  });

  it('a TIMEOUT is not a blip — it already cost the full wait', () => {
    expect(isNetworkBlip({ name: 'TimeoutError', message: 'signal timed out' })).toBe(false);
    expect(isNetworkBlip({ name: 'AbortError', message: 'The operation was aborted.' })).toBe(false);
    expect(isNetworkBlip({ code: 'ABORT_ERR', message: 'Failed to fetch' })).toBe(false);
  });

  it('a real answer from the server is not retried (a bad filter stays bad)', () => {
    expect(isNetworkBlip({ code: 'PGRST100', message: 'failed to parse filter' })).toBe(false);
    expect(isNetworkBlip({ code: '42703', message: 'column does not exist' })).toBe(false);
    expect(isNetworkBlip(null)).toBe(false);
    expect(isNetworkBlip(undefined)).toBe(false);
  });
});
