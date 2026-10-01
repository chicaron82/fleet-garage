import { describe, it, expect, vi, beforeEach } from 'vitest';

// Forget is the only write the Model codes audit offers (Aaron, 2026-10-01). Two things it must never
// do: report a delete that removed nothing, and remove a class he pinned.

type Call = { table: string; filters: [string, string, unknown][] };
const calls: Call[] = [];
let answer: { data: { code: string }[] | null; error: { message: string } | null } = { data: [{ code: 'X' }], error: null };

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      delete: () => {
        const call: Call = { table, filters: [] };
        calls.push(call);
        const chain = {
          eq: (col: string, v: unknown) => { call.filters.push(['eq', col, v]); return chain; },
          is: (col: string, v: unknown) => { call.filters.push(['is', col, v]); return chain; },
          select: () => Promise.resolve(answer),
        };
        return chain;
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { forgetLearnedClass, forgetTaughtModel } from '../../src/context/learnedCodeWrite';

beforeEach(() => { calls.length = 0; answer = { data: [{ code: 'X' }], error: null }; });

describe('forgetLearnedClass', () => {
  it('deletes the one code, normalised', async () => {
    await forgetLearnedClass('  cx4l ');
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('class_code_rental_class');
    expect(calls[0].filters).toContainEqual(['eq', 'code', 'CX4L']);
  });

  // ⭐⭐ The guard is IN THE QUERY, so no screen can delete a pin through this path by mistake.
  it('⭐ only ever matches an unpinned row', async () => {
    await forgetLearnedClass('CRHX');
    expect(calls[0].filters).toContainEqual(['is', 'pinned_at', null]);
  });

  // ⚠️ PostgREST answers a blocked or no-match delete with zero rows and NO error. That must read as
  // a failure — "nothing was removed" is the silent-success bug this codebase keeps finding.
  it('⭐ throws when nothing was removed, even with no error', async () => {
    answer = { data: [], error: null };
    await expect(forgetLearnedClass('CX4L')).rejects.toThrow('learned class not forgotten');
  });

  it('throws on an error, and on no answer at all', async () => {
    answer = { data: null, error: { message: 'rls' } };
    await expect(forgetLearnedClass('CX4L')).rejects.toThrow();
    answer = { data: null, error: null };
    await expect(forgetLearnedClass('CX4L')).rejects.toThrow();
  });

  it('refuses a blank code without touching the table', async () => {
    await expect(forgetLearnedClass('   ')).rejects.toThrow('no code to forget');
    expect(calls).toHaveLength(0);
  });
});

describe('forgetTaughtModel', () => {
  it('deletes the one code from the taught list', async () => {
    await forgetTaughtModel(' cbrs');
    expect(calls[0].table).toBe('vehicle_class_codex');
    expect(calls[0].filters).toEqual([['eq', 'code', 'CBRS']]);
  });

  it('⭐ throws when nothing was removed', async () => {
    answer = { data: [], error: null };
    await expect(forgetTaughtModel('CBRS')).rejects.toThrow('taught model not forgotten');
  });

  it('refuses a blank code without touching the table', async () => {
    await expect(forgetTaughtModel('')).rejects.toThrow('no code to forget');
    expect(calls).toHaveLength(0);
  });
});
