// api/lot.ts has one door, a signed-in FG session (2026-11-05: the /lot/erin PIN page retired, *"It's unused and just
// keeping the read-only"*; docs/ticket-retire-erin-pin-page.md). The old PIN, right or wrong, opens nothing now.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn(async (token: string) => (token === 'good' ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: new Error('bad') }));
const from = vi.fn(() => { throw new Error('the lot tables must not be touched'); });
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser }, from }) }));

const { default: handler } = await import('../../api/lot');

function call(body: unknown, authorization?: string) {
  const out: { status?: number; json?: Record<string, unknown> } = {};
  const res = { status(c: number) { out.status = c; return res; }, json(b: Record<string, unknown>) { out.json = b; } };
  return handler({ method: 'POST', body, headers: authorization ? { authorization } : {} }, res).then(() => out);
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'http://db.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  vi.stubEnv('LOT_PIN', '4821');   // still set on Vercel until he deletes it: it must not matter
  from.mockClear();
});

describe('api/lot — the one door', () => {
  it('⭐ the old shared PIN, even the right one, writes nothing without a sign-in', async () => {
    const r = await call({ pin: '4821', action: 'cleans', delta: 1, by: 'LOT' });
    expect(r.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('the PIN page\'s unlock check is gone too', async () => {
    expect((await call({ pin: '4821', action: 'check' })).status).toBe(401);
    expect((await call({ action: 'check' }, 'Bearer good')).status).toBe(400);
  });

  it('a sign-in that ran out says so', async () => {
    const r = await call({ action: 'cleans', delta: 1, by: 'AS' }, 'Bearer stale');
    expect(r.status).toBe(401);
    expect(r.json?.error).toMatch(/sign-in has run out/);
  });

  it('works without LOT_PIN set at all (the env var is unread now)', async () => {
    vi.stubEnv('LOT_PIN', '');
    expect((await call({ action: 'check' }, 'Bearer good')).status).toBe(400);
  });
});

describe('api/lot — On break (migration 166, docs/ticket-lot-bay-on-break.md)', () => {
  function fakeBay() {
    const patches: Record<string, unknown>[] = [], tables: string[] = [];
    from.mockImplementation(((table: string) => {
      tables.push(table);
      return {
        update(patch: Record<string, unknown>) {
          patches.push(patch);
          const chain = { eq: () => chain, select: () => chain, single: async () => ({ data: { id: 1, cleans: 6, ...patch }, error: null }) };
          return chain;
        },
      };
    }) as never);
    return { patches, tables };
  }

  it('⭐ on stamps break_at, back clears it; it moves no count and logs no tap', async () => {
    const f = fakeBay();
    const on = await call({ action: 'bayBreak', on: true, by: 'AS' }, 'Bearer good');
    expect(on.status).toBe(200);
    expect(typeof f.patches[0]!.break_at).toBe('string');
    expect(Object.keys(f.patches[0]!)).toEqual(['break_at']);
    const back = await call({ action: 'bayBreak', on: false, by: 'AS' }, 'Bearer good');
    expect(back.status).toBe(200);
    expect(f.patches[1]).toEqual({ break_at: null });
    expect(f.tables).toEqual(['lot_bay', 'lot_bay']);
  });

  it('needs the sign-in like everything else', async () => {
    fakeBay();
    expect((await call({ action: 'bayBreak', on: true, by: 'AS' })).status).toBe(401);
  });
});
