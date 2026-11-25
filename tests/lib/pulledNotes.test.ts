// His recent Pulled away notes (migration 172, docs/ticket-lot-bay-pulled-away-note.md): one-tap picks, per phone.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PULLED_NOTES_KEY, readPulledNotes, rememberNote, savePulledNotes, tidyNote } from '../../src/lib/pulledNotes';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
}

afterEach(() => vi.unstubAllGlobals());

describe('pulledNotes', () => {
  it('tidies to one line and caps at 80', () => {
    expect(tidyNote('  Driving to\n  the airport ')).toBe('Driving to the airport');
    expect(tidyNote('x'.repeat(90))).toHaveLength(80);
    expect(tidyNote('   ')).toBe('');
  });

  it('⭐ the newest on top, an older copy dropped whatever its case, three kept', () => {
    let l: string[] = [];
    for (const n of ['A run', 'Meeting', 'Driving', 'a RUN']) l = rememberNote(l, n);
    expect(l).toEqual(['a RUN', 'Driving', 'Meeting']);
    expect(rememberNote(l, '  ')).toEqual(l);
    expect(rememberNote(['C', 'B', 'A'], 'D')).toEqual(['D', 'C', 'B']);   // four distinct: the oldest goes
  });

  it('⭐ saved, then read back (a real storage: an absence proves nothing against a no-op mock)', () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    savePulledNotes(['Driving', 'Meeting']);
    expect(s.m.get(PULLED_NOTES_KEY)).toBe('["Driving","Meeting"]');
    expect(readPulledNotes()).toEqual(['Driving', 'Meeting']);
  });

  it('a storage that throws, or holds junk, reads as no picks and never breaks the strip', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readPulledNotes()).toEqual([]);
    expect(() => savePulledNotes(['x'])).not.toThrow();
    vi.stubGlobal('localStorage', { getItem: () => '{"not":"a list"}', setItem: () => {} });
    expect(readPulledNotes()).toEqual([]);
  });
});
