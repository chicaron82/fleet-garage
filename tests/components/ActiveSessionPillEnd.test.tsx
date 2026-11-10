// ⭐ A tap on the header pill ENDS the session (docs/ticket-pill-tap-ends-session.md). Aaron, 2026-11-09: *"just end it on
// tap since that's really what I need to do"*, and *"the same for movement log when making trips to the airport"*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { ActiveSession, SessionEnder } from '../../src/context/ActiveSessionsContext';

const { rows, endTrip, endOth, ctx } = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown> | null>,
  endTrip: vi.fn(async (..._a: unknown[]) => true),
  endOth: vi.fn(async (..._a: unknown[]) => true),
  ctx: { ender: null as SessionEnder | null, refresh: vi.fn(), setMovementTab: vi.fn() },
}));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: (_k: string, id: string) => {
    const one = { maybeSingle: async () => ({ data: rows[id] ?? null, error: null }) };
    return { ...one, is: () => one };
  } }) }) },
}));
vi.mock('../../src/lib/sessionEndHeadless', async (orig) => ({
  ...(await orig<typeof import('../../src/lib/sessionEndHeadless')>()),
  endTripHeadless: (...a: unknown[]) => endTrip(...a),
  endOthHeadless: (...a: unknown[]) => endOth(...a),
}));
// The hold, shortened so the test waits on the real timer path.
vi.mock('../../src/lib/pillEnd', async (orig) => ({ ...(await orig<typeof import('../../src/lib/pillEnd')>()), PILL_UNDO_MS: 30 }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Aaron Sauddin', branchId: 'YWG' } }) }));

const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
let trip: ActiveSession | null = null;
let oth: ActiveSession | null = null;
vi.mock('../../src/context/ActiveSessionsContext', async (orig) => ({
  ...(await orig<typeof import('../../src/context/ActiveSessionsContext')>()),
  useActiveSessions: () => ({
    trip, oth, nowMs: Date.now(), refresh: ctx.refresh, movementTab: 'movement-log', setMovementTab: ctx.setMovementTab,
    openingDutiesPending: false, signalOpeningDuties: vi.fn(), consumeOpeningDuties: vi.fn(),
    registerEnder: vi.fn(), enderFor: () => ctx.ender,
  }),
}));

import { ActiveSessionPill } from '../../src/components/layout/ActiveSessionPill';

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  endTrip.mockClear(); endOth.mockClear(); ctx.refresh.mockClear(); ctx.setMovementTab.mockClear();
  ctx.ender = null; trip = null; oth = null;
});

const tripRow = (m: number, auth: string | null = 'PERSONAL') => ({
  id: 't1', depart_time: ago(m), auth_type: auth, queue_at_departure: null, notes: null, ev_cable_status: null,
  ev_adapter_status: null, status: 'in_progress',
});

describe('⭐ the trip pill', () => {
  it('a tap holds "✓ 12m · Undo", then ends Back at Washbay at the TAP\'s time (headless: no card mounted)', async () => {
    trip = { id: 't1', startedAt: ago(12), label: 'In Transit', emoji: '🚗' };
    rows.t1 = tripRow(12);
    const nav = vi.fn();
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={nav} />);
    const tapped = Date.now();
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    const undo = await screen.findByRole('button', { name: /Trip ended, back at Washbay, 12 minutes\. Undo/ });
    expect(undo).toHaveTextContent('✓ 12m');
    expect(endTrip).not.toHaveBeenCalled();
    await waitFor(() => expect(endTrip).toHaveBeenCalledTimes(1));
    const atIso = endTrip.mock.calls[0][1] as string;
    expect(Math.abs(Date.parse(atIso) - tapped)).toBeLessThan(1000);
    expect(nav).not.toHaveBeenCalled();
    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();
  });

  it('⭐ Undo writes NOTHING (no arrival, no off-standard entry, no manager alert)', async () => {
    trip = { id: 't1', startedAt: ago(12), label: 'In Transit', emoji: '🚗' };
    rows.t1 = tripRow(12);
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Undo/ }));
    await act(() => new Promise(r => setTimeout(r, 80)));
    expect(endTrip).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /End In Transit/ })).toBeInTheDocument();
  });

  it('⭐ a mounted card ends it THROUGH the card, never behind its back', async () => {
    trip = { id: 't1', startedAt: ago(12), label: 'In Transit', emoji: '🚗' };
    rows.t1 = tripRow(12);
    const cardEnd = vi.fn(async () => true);
    ctx.ender = cardEnd;
    // A registered ender = the card is mounted (both movement-log tabs stay mounted, one hidden).
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    await waitFor(() => expect(cardEnd).toHaveBeenCalledTimes(1));
    expect(endTrip).not.toHaveBeenCalled();
  });

  it.each([
    ['under 5 minutes', tripRow(3)],
    ['no authorization', tripRow(12, null)],
  ])('%s opens the card, as the pill always did', async (_w, r) => {
    trip = { id: 't1', startedAt: r.depart_time, label: 'In Transit', emoji: '🚗' };
    rows.t1 = r;
    const nav = vi.fn();
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={nav} />);
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    await waitFor(() => expect(nav).toHaveBeenCalledWith({ name: 'movement-log' }));
    expect(ctx.setMovementTab).toHaveBeenCalledWith('movement-log');
    expect(endTrip).not.toHaveBeenCalled();
  });

  it('a row it cannot read (no signal) opens the card', async () => {
    trip = { id: 't1', startedAt: ago(12), label: 'In Transit', emoji: '🚗' };
    const nav = vi.fn();
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={nav} />);
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    await waitFor(() => expect(nav).toHaveBeenCalled());
  });

  it('a failed end says so, and its chip opens the card', async () => {
    trip = { id: 't1', startedAt: ago(12), label: 'In Transit', emoji: '🚗' };
    rows.t1 = tripRow(12);
    endTrip.mockResolvedValueOnce(false);
    const nav = vi.fn();
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={nav} />);
    fireEvent.click(screen.getByRole('button', { name: /End In Transit/ }));
    fireEvent.click(await screen.findByRole('button', { name: /did not save/ }));
    await waitFor(() => expect(nav).toHaveBeenCalledWith({ name: 'movement-log' }));
  });
});

describe('⭐ the off-standard pill', () => {
  it('ends in place; under 5 min the chip says it will not be logged', async () => {
    oth = { id: 'o1', startedAt: ago(3), label: 'Fleeting Cars', emoji: '⏱' };
    rows.o1 = { id: 'o1', start_time: ago(3), preset_reason: 'fleeting_cars', status: 'in_progress' };
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /End Fleeting Cars/ }));
    expect(await screen.findByRole('button', { name: /not logged\. Undo/ })).toHaveTextContent('✕ 3m');
    await waitFor(() => expect(endOth).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Not logged')).toBeInTheDocument();
  });

  it('⭐ EDV opens the card', async () => {
    oth = { id: 'o1', startedAt: ago(30), label: 'EDV', emoji: '⏱' };
    rows.o1 = { id: 'o1', start_time: ago(30), preset_reason: 'edv', status: 'in_progress' };
    const nav = vi.fn();
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={nav} />);
    fireEvent.click(screen.getByRole('button', { name: /End EDV/ }));
    await waitFor(() => expect(nav).toHaveBeenCalled());
    expect(ctx.setMovementTab).toHaveBeenCalledWith('off-standard');
    expect(endOth).not.toHaveBeenCalled();
  });

  it('a session already ended elsewhere: no end, the pill refreshes', async () => {
    oth = { id: 'o1', startedAt: ago(30), label: 'Fleeting Cars', emoji: '⏱' };
    rows.o1 = { id: 'o1', start_time: ago(30), preset_reason: null, status: 'complete' };
    render(<ActiveSessionPill activeModule="lot-lookout" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /End Fleeting Cars/ }));
    await waitFor(() => expect(ctx.refresh).toHaveBeenCalled());
    expect(endOth).not.toHaveBeenCalled();
  });
});
