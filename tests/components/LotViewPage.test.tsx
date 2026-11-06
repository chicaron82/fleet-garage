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
