// The read-only page says when the count isn't being kept (docs/ticket-lot-view-count-not-kept.md). Aaron, 2026-11-05:
// *"a message that shows over the blurred page ... they can still view but the info is stale"*, on after 2 h quiet.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const NOW = Date.parse('2026-11-06T01:30:00Z');
const state = {
  bay: { cleans: 14, cleansBy: 'AS', cleansAt: '', dirties: 1, dirtiesBy: 'AS', dirtiesAt: '', used: 26, usedOn: '2026-11-05' },
  rows: [] as { started_at: string; exited_at: string | null }[],
};
vi.mock('../../src/hooks/useLotBay', () => ({ useLotBay: () => ({ bay: state.bay, log: [], loaded: true, nowMs: NOW, setBay: () => {} }) }));
vi.mock('../../src/hooks/useBayLog', () => ({ useBayLog: () => ({ rows: state.rows, loaded: true, error: null }) }));
vi.mock('../../src/hooks/useLotCrew', () => ({ useLotCrew: () => ({ crew: null }) }));
vi.mock('../../src/components/lot/LotBayStrip', () => ({ LotBayStrip: () => <p>the count</p> }));
vi.mock('../../src/components/lot/BayLogList', () => ({ BayLogList: () => <p>the list</p> }));
const { LotViewPage } = await import('../../src/components/lot/LotViewPage');

const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe('LotViewPage, when the count is not being kept', () => {
  beforeEach(() => { state.rows = []; });

  it('⭐ 2 h with nothing done: a card over the blurred page, in the bay\'s voice, with when it was last updated', () => {
    state.bay = { ...state.bay, cleansAt: ago(200), dirtiesAt: ago(190) };
    render(<LotViewPage />);
    const card = screen.getByRole('region', { name: 'Not being kept' });
    expect(card.textContent).toContain("The count isn't being kept right now.");
    expect(card.textContent).toMatch(/Last updated \d\d:\d\d\./);
    expect(screen.getByText('the count').closest('[aria-hidden="true"]')).not.toBeNull();   // blurred and hidden from reading
    expect(card.textContent).not.toMatch(/Aaron|back at|shift/i);
  });

  it('Show it anyway clears it for this visit', () => {
    state.bay = { ...state.bay, cleansAt: ago(200), dirtiesAt: ago(190) };
    render(<LotViewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Show it anyway' }));
    expect(screen.queryByRole('region', { name: 'Not being kept' })).toBeNull();
    expect(screen.getByText('the count').closest('[aria-hidden="true"]')).toBeNull();
  });

  it('⭐ any bay tap inside 2 h keeps it, even with the count itself untouched for hours (an M hold moves no clean)', () => {
    state.bay = { ...state.bay, cleansAt: ago(300), dirtiesAt: ago(300) };
    state.rows = [{ started_at: ago(100), exited_at: ago(95) }];
    render(<LotViewPage />);
    expect(screen.queryByRole('region', { name: 'Not being kept' })).toBeNull();
    expect(screen.getByText('the count').closest('[aria-hidden="true"]')).toBeNull();
  });

  it('a count tap inside 2 h keeps it', () => {
    state.bay = { ...state.bay, cleansAt: ago(119), dirtiesAt: ago(400) };
    render(<LotViewPage />);
    expect(screen.queryByRole('region', { name: 'Not being kept' })).toBeNull();
  });
});

describe('LotViewPage, on break (migration 166)', () => {
  beforeEach(() => { state.rows = []; });

  it('⭐ a heads-up, not the blur, and no time on it', () => {
    state.bay = { ...state.bay, cleansAt: ago(40), dirtiesAt: ago(45), breakAt: ago(20) } as typeof state.bay;
    render(<LotViewPage />);
    const note = screen.getByRole('status');
    expect(note.textContent).toBe('The count is paused for a break. It catches up after.');
    expect(screen.queryByRole('region', { name: 'Not being kept' })).toBeNull();
    expect(screen.getByText('the count').closest('[aria-hidden="true"]')).toBeNull();
  });

  it('⭐ his next tap ends it, with nothing cleared', () => {
    state.bay = { ...state.bay, cleansAt: ago(5), dirtiesAt: ago(45), breakAt: ago(20) } as typeof state.bay;
    render(<LotViewPage />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a break he never came back from turns into "not being kept" 2 h after it began, with the count\'s own last time', () => {
    state.bay = { ...state.bay, cleansAt: ago(150), dirtiesAt: ago(150), breakAt: ago(125) } as typeof state.bay;
    render(<LotViewPage />);
    expect(screen.queryByRole('status')).toBeNull();
    const card = screen.getByRole('region', { name: 'Not being kept' });
    expect(card.textContent).toContain('Last updated');
  });

  it('the break keeps the 2 h clock alive: a break 1 h ago after a last tap 3 h ago is a break, not "not kept"', () => {
    state.bay = { ...state.bay, cleansAt: ago(180), dirtiesAt: ago(180), breakAt: ago(60) } as typeof state.bay;
    render(<LotViewPage />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
