import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐⭐ THE LOOP THIS CLOSES. `api/keytag-read.ts` upserted the code→class mapping on EVERY scan
// that read both a code and a class -- unconditional, last-write-wins, under the comment "Ground
// truth only, the tags are the chart". So Aaron's correction could not survive a single scan:
// every CRHX he scanned re-taught Q4 and erased it. His words, 2026-08-25: *"saves me from
// constantly changing it."*
//
// A pin is a person's decision. The scan may read it; it may never overwrite it.

let upsertError: { message: string } | null = null;
const upserts: { row: Record<string, unknown>; opts: unknown }[] = [];
let currentUser: { id: string } | null = { id: 'u-aaron' };

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (row: Record<string, unknown>, opts: unknown) => {
        upserts.push({ row, opts });
        return Promise.resolve({ error: upsertError });
      },
    }),
    auth: { getUser: async () => ({ data: currentUser ? { user: currentUser } : null }) },
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { pinClassMapping } from '../../src/context/classPinWrite';

beforeEach(() => { upsertError = null; upserts.length = 0; currentUser = { id: 'u-aaron' }; });

describe('pinClassMapping', () => {
  it('pins the mapping with a timestamp and the person who decided it', async () => {
    const ok = await pinClassMapping('CRHX', 'E6');
    expect(ok).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toMatchObject({ code: 'CRHX', rental_class: 'E6', pinned_by: 'u-aaron' });
    expect(upserts[0].row.pinned_at).toEqual(expect.any(String));
    expect(upserts[0].opts).toEqual({ onConflict: 'code' });
  });

  it('normalises what he typed — the codex key is upper-case and trimmed', async () => {
    await pinClassMapping('  crhx ', ' e6 ');
    expect(upserts[0].row).toMatchObject({ code: 'CRHX', rental_class: 'E6' });
  });

  // ⚠️ BOTH OR NOTHING. A code with no class teaches nothing, and a class with no code has no key.
  // Either half alone would put a partial row in a table the SCANNER reads as authority.
  it('refuses a half pin, and writes nothing at all', async () => {
    for (const [code, cls] of [['CRHX', ''], ['', 'E6'], ['  ', ' '], [null, 'E6'], ['CRHX', undefined]] as const) {
      expect(await pinClassMapping(code, cls)).toBe(false);
    }
    expect(upserts).toHaveLength(0);
  });

  // ⭐ Reports the truth about the write -- the R61/R62 lesson. A caller must never be able to
  // claim a mapping that failed to store.
  it('says false when the write fails, rather than swallowing it', async () => {
    upsertError = { message: 'rls' };
    expect(await pinClassMapping('CRHX', 'E6')).toBe(false);
  });

  it('still pins when the session has no user — an anonymous pin beats no pin', async () => {
    currentUser = null;
    expect(await pinClassMapping('CRHX', 'E6')).toBe(true);
    expect(upserts[0].row.pinned_by).toBeNull();
  });
});
