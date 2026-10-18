// Aaron, 2026-10-18 17:00: back on My Day, a pulled VSA showed "present/cleaning for a brief second before correcting
// itself". A screen that mounts after another has read the crew must start from that answer, not from nothing.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }));
const payload = { summary: { vsa: { cleaning: 0, moving: 1, out: 0 }, driver: { airport: 0, other: 0, out: 0 } }, changedAt: null, members: [] };
const { useLotCrew } = await import('../../src/hooks/useLotCrew');

afterEach(() => vi.unstubAllGlobals());

describe('useLotCrew — the last answer, in memory', () => {
  it('⭐ a second screen starts from what the first one read, before its own fetch lands', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const first = renderHook(() => useLotCrew({ signedIn: true }));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    first.unmount();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));   // the next fetch never answers
    const second = renderHook(() => useLotCrew({ signedIn: true }));
    expect(second.result.current.loaded).toBe(true);
    expect(second.result.current.crew?.summary.vsa.moving).toBe(1);
  });
  it('the read-only door keeps its own answer (no names cross over)', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const pub = renderHook(() => useLotCrew());
    expect(pub.result.current.loaded).toBe(false);
  });
});
