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
    const out = await pinClassMapping('CRHX', 'E6');
    expect(out).toEqual({ pinned: true });
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
      expect(await pinClassMapping(code, cls)).toEqual({ pinned: false });
    }
    expect(upserts).toHaveLength(0);
  });

  // ⭐ Reports the truth about the write -- the R61/R62 lesson. A caller must never be able to
  // claim a mapping that failed to store.
  it('says false when the write fails, rather than swallowing it', async () => {
    upsertError = { message: 'rls' };
    expect(await pinClassMapping('CRHX', 'E6')).toEqual({ pinned: false });
  });

  it('still pins when the session has no user — an anonymous pin beats no pin', async () => {
    currentUser = null;
    expect(await pinClassMapping('CRHX', 'E6')).toEqual({ pinned: true });
    expect(upserts[0].row.pinned_by).toBeNull();
  });
});

// ⭐⭐ A PIN THE CODEX CONTRADICTS. On 2026-08-28 at 13:05 this exact path pinned `CSPT → E6` from a
// Sportage hybrid wearing a mis-printed ICE tag. Aaron named the cause himself: "me flipping the
// hybrid checkbox but forgetting to change the model code." True of the car in his hand, false of
// the eleven petrol Sportages — and PINNED, so no scan was permitted to correct it.
describe('pinClassMapping — refusing a pin the codex contradicts', () => {
  it('⭐ writes NOTHING for CSPT + E6, and names the code he probably meant', async () => {
    const out = await pinClassMapping('CSPT', 'E6');
    expect(out.pinned).toBe(false);
    expect(out.contradiction).toEqual({ code: 'CSPT', rentalClass: 'E6', hybridCode: 'CSEH' });
    expect(upserts).toHaveLength(0);
  });

  it('pins the corrected pairing without complaint', async () => {
    expect(await pinClassMapping('CSEH', 'E6')).toEqual({ pinned: true });
    expect(await pinClassMapping('CSPT', 'Q4')).toEqual({ pinned: true });
    expect(upserts).toHaveLength(2);
  });

  it('⚠️ refuses only the SHARED mapping — it must never be read as blocking the car edit', async () => {
    // The car's own correction is the thing he came to fix; this write has always been the bonus.
    // The outcome says "not pinned", never "failed", and the caller keeps going.
    const out = await pinClassMapping('CSPT', 'E6');
    expect(out.pinned).toBe(false);
    expect(out).not.toHaveProperty('error');
  });

  it('⚠️ still pins a code the codex has never seen — unknown is not a contradiction', async () => {
    expect(await pinClassMapping('ZZZZ', 'E6')).toEqual({ pinned: true });
  });
});
