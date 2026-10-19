// Reflection 87 (2026-10-18): with no signal, a signed-in session that needs its hourly refresh has no token. That
// used to answer 401, and the airport queue drops everything on a 401 — so the parkade lost its waiting taps.
import { describe, it, expect, vi, afterEach } from 'vitest';

let session: { access_token: string } | null = null;
let sessionError: unknown = null;
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session }, error: sessionError }) } } }));
const { postLotSignedIn } = await import('../../src/hooks/useLotPin');

const setOnline = (on: boolean) => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => on });
afterEach(() => { setOnline(true); session = null; sessionError = null; });

describe('postLotSignedIn with no token', () => {
  it('⭐ offline: answers like no signal (status 0), so waiting taps WAIT', async () => {
    setOnline(false);
    expect(await postLotSignedIn({ action: 'reading' })).toMatchObject({ ok: false, status: 0 });
  });
  it('⭐ a refresh that failed on the network: also no signal', async () => {
    sessionError = new TypeError('Failed to fetch');
    expect(await postLotSignedIn({ action: 'reading' })).toMatchObject({ status: 0 });
  });
  it('online with no session really is signed out: 401, said plainly', async () => {
    expect(await postLotSignedIn({ action: 'reading' })).toMatchObject({ status: 401, error: 'Sign in to FG again.' });
  });
});
