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
const strip: { big?: boolean } = {};
vi.mock('../../src/components/lot/LotBayStrip', () => ({ LotBayStrip: (p: { big?: boolean }) => { strip.big = p.big; return <p>the count</p>; } }));
const list: { chipsClassName?: string; onFilter?: unknown } = {};
vi.mock('../../src/components/lot/BayLogList', () => ({ BayLogList: (p: typeof list) => { list.chipsClassName = p.chipsClassName; list.onFilter = p.onFilter; return <p>the list</p>; } }));
const { LotViewPage } = await import('../../src/components/lot/LotViewPage');
const { clockOf } = await import('../../src/lib/lotBay');

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

  it("⭐ an update from another day says its day (his: a bare time reads as last night; ticket-lot-times-carry-the-day)", () => {
    const tuesday = ago(2 * 24 * 60);   // NOW is Thu evening in Winnipeg: two days back is Tue, same hour
    state.bay = { ...state.bay, cleansAt: tuesday, dirtiesAt: tuesday };
    render(<LotViewPage />);
    const card = screen.getByRole('region', { name: 'Not being kept' });
    expect(card.textContent).toContain(`Last updated Tue ${clockOf(tuesday)}.`);
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

  it('⭐ pulled away: a generic line, no time, never what the work was (migration 171)', () => {
    state.bay = { ...state.bay, cleansAt: ago(40), dirtiesAt: ago(45), breakAt: ago(20), breakKind: 'pulled' } as typeof state.bay;
    render(<LotViewPage />);
    const note = screen.getByRole('status');
    expect(note.textContent).toBe('The count is paused while the bay crew is on other work. It catches up after.');
    expect(note.textContent).not.toMatch(/\d\d:\d\d|driv|meeting|break/i);
    state.bay = { ...state.bay, breakKind: undefined } as typeof state.bay;
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

// The FG brand on the public page (docs/ticket-lot-view-fg-branding.md). Aaron, 2026-11-15: *"its quiet advertising of
// the FG brand we've built"*. Lot Lookout stays the headline; FG says where it comes from.
describe('LotViewPage, the FG brand', () => {
  beforeEach(() => { state.rows = []; state.bay = { ...state.bay, cleansAt: ago(5), dirtiesAt: ago(5) }; });

  it('⭐ the FG logo beside the title, Fleet Garage under it, and it still says read only', () => {
    render(<LotViewPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lot Lookout');
    expect(screen.getByRole('img', { name: 'Fleet Garage' }).getAttribute('src')).toBe('/FG.webp');
    expect(screen.getByText('Fleet Garage · Erin St · read only')).toBeTruthy();
  });

  it("no online dot: in the app it reports his connection, which means nothing to a viewer", () => {
    const { container } = render(<LotViewPage />);
    expect(container.querySelector('[title="Online"], [title="Offline"]')).toBeNull();
  });
});

// What a ✈ mark means (docs/ticket-lot-view-sent-mark-disclaimer.md). Aaron, 2026-11-17: *"the count is more important
// than what was marked as sent. i use it for the ones they ask for specifically"*. An unmarked car is not "still here".
describe('LotViewPage, the ✈ disclaimer', () => {
  beforeEach(() => { state.rows = []; state.bay = { ...state.bay, cleansAt: ago(5), dirtiesAt: ago(5) }; });

  it('⭐ says what a ✈ mark is, right under the bay log', () => {
    render(<LotViewPage />);
    const line = screen.getByText('✈ marks cars asked for by name. The count is the lot.');
    expect(line.previousElementSibling?.textContent).toBe('the list');
  });

  it('hides with the list when the count is not being kept', () => {
    state.bay = { ...state.bay, cleansAt: ago(200), dirtiesAt: ago(190), breakAt: undefined } as typeof state.bay;   // the break tests above leave one
    render(<LotViewPage />);
    expect(screen.getByText('✈ marks cars asked for by name. The count is the lot.').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

// The counter's monitor (docs/ticket-lot-view-desktop-layout.md). Aaron, 2026-11-19: *"Jagdeep reads from the computer
// rather than from his phone. What say we have a desktop version with a better bougie view?"*
describe('LotViewPage, the desktop layout', () => {
  beforeEach(() => { state.rows = []; state.bay = { ...state.bay, cleansAt: ago(5), dirtiesAt: ago(5), breakAt: undefined } as typeof state.bay; });

  it('⭐ the bay and the count on the left (pinned), the log on the right', () => {
    const { container } = render(<LotViewPage />);
    const glance = container.querySelector('[data-column="glance"]')!;
    const log = container.querySelector('[data-column="log"]')!;
    expect(glance.className).toContain('lg:sticky');
    expect(glance.querySelector('[aria-label="In the bay now"]')).not.toBeNull();
    expect(glance.textContent).toContain('the count');
    expect(log.textContent).toContain('the list');
    expect(log.textContent).toContain('✈ marks cars asked for by name.');
    expect(glance.parentElement!.className).toContain('lg:grid');
    expect(strip.big).toBe(true);
  });

  it('⭐ the phone order is unchanged: bay, count, then the list and its ✈ line', () => {
    const { container } = render(<LotViewPage />);
    const text = container.textContent!;
    const at = (t: string) => text.indexOf(t);
    expect(at('In the bay now')).toBeLessThan(at('the count'));
    expect(at('the count')).toBeLessThan(at('the list'));
    expect(at('the list')).toBeLessThan(at('✈ marks cars asked for by name.'));
  });

  it('⭐ the left column also carries Find (desktop only); the phone keeps its own Find above the list', () => {
    const { container } = render(<LotViewPage />);
    const desk = container.querySelector('[data-column="glance"] [data-desktop-only]')!;
    expect(desk.className).toContain('hidden lg:block');
    expect(desk.querySelector('[aria-label="Find in the log"]')).not.toBeNull();
    const phoneFind = container.querySelector('[data-column="log"] [data-phone-only]')!;
    expect(phoneFind.className).toContain('lg:hidden');
    expect(phoneFind.querySelector('[aria-label="Find in the log"]')).not.toBeNull();
    // The chips hide on a desktop, where the tiles stand in for them; the list's filter is the page's.
    expect(list.chipsClassName).toBe('lg:hidden');
    expect(typeof list.onFilter).toBe('function');
  });

  it('the not-kept blur still covers both columns', () => {
    state.bay = { ...state.bay, cleansAt: ago(200), dirtiesAt: ago(190) };
    render(<LotViewPage />);
    expect(screen.getByText('the count').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('the list').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
