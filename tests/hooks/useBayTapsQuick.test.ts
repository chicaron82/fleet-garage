// The Erin pill's quick taps, phone side: what each one sends, what the note says, and that Undo puts the row back
// (used included) — Aaron, 2026-10-16: *"i didn't quite understand the toast when i tapped quickly from 3 to 6"*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { LotBay } from '../../src/lib/lotBay';

const sent: Record<string, unknown>[] = [];
let reply: (body: Record<string, unknown>) => Record<string, unknown>;
vi.mock('../../src/hooks/useLotPin', () => ({
  postLot: vi.fn(),
  useLotPin: vi.fn(),
  postLotSignedIn: vi.fn(async (body: Record<string, unknown>) => {
    sent.push(body);
    return { ok: true, status: 200, json: { bay: reply(body) } };
  }),
}));
const { useBayTapsSignedIn } = await import('../../src/hooks/useBayTaps');

const NOW_ISO = new Date().toISOString();
const bay: LotBay = { cleans: 9, cleansBy: 'AS', cleansAt: NOW_ISO, dirties: 3, dirtiesBy: 'AS', dirtiesAt: NOW_ISO, used: 4, usedOn: '2026-10-16' };
const row = (b: Partial<LotBay>) => ({
  cleans: b.cleans ?? 9, cleans_by: 'AS', cleans_at: NOW_ISO, dirties: b.dirties ?? 3, dirties_by: 'AS', dirties_at: NOW_ISO,
  used: b.used ?? 4, used_on: '2026-10-16',
});

function setup() {
  const notes: { msg: string; undo?: () => void }[] = [];
  const state = { bay, log: [], loaded: true, nowMs: Date.now(), setBay: vi.fn() };
  const { result } = renderHook(() => useBayTapsSignedIn(state, (msg, undo) => notes.push({ msg, undo }), 'AS'));
  return { result, notes };
}

beforeEach(() => { sent.length = 0; });

describe('useBayTapsSignedIn — quick taps', () => {
  it('⭐ +1 says the count and nothing else (no slip lecture)', async () => {
    reply = () => row({ cleans: 10 });
    const { result, notes } = setup();
    await act(() => result.current.tapCleans(1));
    expect(notes.map(n => n.msg)).toEqual(['10 cleans']);
  });

  it('⭐ drain sends the driver count and offers Undo; Undo restores the row as it was, used included', async () => {
    reply = b => (b.action === 'drain' ? row({ cleans: 6, used: 7 }) : row({}));
    const { result, notes } = setup();
    await act(() => result.current.drain(3));
    expect(sent[0]).toMatchObject({ action: 'drain', n: 3, by: 'AS' });
    expect(notes[0].msg).toBe('Drained 3 · 6 cleans');
    expect(notes[0].undo).toBeTypeOf('function');
    await act(async () => { notes[0].undo!(); await Promise.resolve(); });
    expect(sent[1]).toEqual({ action: 'bayUndo', field: 'cleans', to: { cleans: 9, dirties: 3, used: 4, usedOn: '2026-10-16' }, by: 'AS' });
  });

  it('a drain bigger than the pile says how many it really took', async () => {
    reply = () => row({ cleans: 0 });
    const { result, notes } = setup();
    await act(() => result.current.drain(12));
    expect(notes[0].msg).toBe('Drained 9 (only 9 on the lot) · 0 cleans');
  });

  it('fill adds the drivers\' dirties, undoable', async () => {
    reply = () => row({ dirties: 6 });
    const { result, notes } = setup();
    await act(() => result.current.fill(3));
    expect(sent[0]).toMatchObject({ action: 'fill', n: 3 });
    expect(notes[0]).toMatchObject({ msg: 'Filled 3 · 6 dirties' });
    expect(notes[0].undo).toBeTypeOf('function');
  });

  it('set cleans is the correction action; zero says what it was', async () => {
    reply = b => row({ cleans: b.count as number });
    const { result, notes } = setup();
    await act(async () => { await result.current.setCount('cleans', 6); });
    await act(async () => { await result.current.setCount('cleans', 0); });
    expect(sent.map(s => s.action)).toEqual(['cleansSet', 'cleansSet']);
    expect(notes.map(n => n.msg)).toEqual(['Set to 6 cleans', 'Cleans zeroed (was 9)']);
  });

  it('dirties ±1 steps and says the count', async () => {
    reply = () => row({ dirties: 4 });
    const { result, notes } = setup();
    await act(() => result.current.stepDirties(1));
    expect(sent[0]).toMatchObject({ action: 'dirtiesStep', delta: 1 });
    expect(notes[0].msg).toBe('4 dirties');
  });
});
