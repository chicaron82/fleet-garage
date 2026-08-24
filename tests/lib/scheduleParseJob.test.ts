import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  startParse, getParseState, subscribeParse, resetParse, adoptParse, parsingImage,
  __resetParseJobForTests,
} from '../../src/lib/scheduleParseJob';
import { loadImportDraft, clearImportDraft } from '../../src/lib/scheduleImportDraft';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}));

const sheet = { staff: [{ name: 'Vladimir', cells: [] }] } as unknown as ParsedSchedule;
const ok = (s: ParsedSchedule = sheet, degraded = false) =>
  ({ ok: true, json: async () => ({ schedule: s, degraded }) }) as unknown as Response;
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { __resetParseJobForTests(); clearImportDraft(); localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('the schedule read, detached from the modal', () => {
  it('⭐ keeps the result even when nobody is listening — the whole point', () => {
    // He picks a sheet, closes the modal, goes and scans a car. Nothing is subscribed when the read
    // lands. Before this the answer was thrown away and reopening started from nothing.
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    startParse('data:image/jpeg;base64,AAA');
    expect(getParseState().status).toBe('parsing');
    return settle().then(() => {
      expect(getParseState()).toMatchObject({ status: 'done', degraded: false });
      expect(loadImportDraft()!.schedule).toEqual(sheet);   // and it saved itself
    });
  });

  it('does not pay for a second read when the same sheet is resumed mid-flight', async () => {
    const f = vi.fn(async () => ok());
    vi.stubGlobal('fetch', f);
    startParse('IMG');
    startParse('IMG');                 // reopening the modal while it is still reading
    await settle();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('⚠️ a stale read cannot overwrite the sheet he moved on to', async () => {
    // He picks sheet A, changes his mind, picks sheet B. A lands last. Without the guard it would
    // quietly replace B's grid with A's — same shape, wrong week, and nothing on screen to say so.
    let resolveA: (r: Response) => void = () => {};
    const f = vi.fn((_u: string, init: { body: string }) =>
      JSON.parse(init.body).image === 'A'
        ? new Promise<Response>((r) => { resolveA = r; })
        : Promise.resolve(ok({ staff: [{ name: 'B-sheet', cells: [] }] } as unknown as ParsedSchedule)));
    vi.stubGlobal('fetch', f);
    startParse('A');
    startParse('B');
    await settle();
    resolveA(ok());                    // A finally answers, too late
    await settle();
    const s = getParseState();
    expect(s.status).toBe('done');
    expect(s.status === 'done' && s.schedule.staff[0].name).toBe('B-sheet');
  });

  it('a failed read is reported, not swallowed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Vision down' }) }) as unknown as Response));
    startParse('IMG');
    await settle();
    expect(getParseState()).toMatchObject({ status: 'error', error: 'Vision down' });
  });

  it('notifies whoever is listening, and stops when they leave', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const seen: string[] = [];
    const off = subscribeParse((s) => seen.push(s.status));
    startParse('IMG');
    await settle();
    off();
    startParse('OTHER');
    expect(seen).toEqual(['parsing', 'done']);
  });

  it('adopting a restored parse marks the job as owning that image — so a resume will not re-read it', () => {
    adoptParse('IMG', sheet, true);
    expect(parsingImage()).toBe('IMG');
    expect(getParseState()).toMatchObject({ status: 'done', degraded: true });
  });

  it('a retake forgets everything — the old sheet must not resurface', () => {
    adoptParse('IMG', sheet, false);
    resetParse();
    expect(getParseState().status).toBe('idle');
    expect(parsingImage()).toBeNull();
  });
});
