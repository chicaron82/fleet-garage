import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { FacilityIssue } from '../../src/types';
import type { IssueFault } from '../../api/_lib/issueFaults';

// ⭐⭐ THE MACHINE IS THE RECORD (Aaron, 2026-09-20): *"instead of having a second mat machine issue
// for it eating mats, we'd just rename the record as mat machine, and what's currently wrong with it
// this time."* Two behaviours make that safe, and both are pinned here: the card shows TODAY's
// fault, and a reopen cannot be confirmed without saying what broke.
// See docs/September/ticket-the-machine-is-the-record.md.

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) },
}));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn() }));
vi.mock('../../src/components/shared/ShareAction', () => ({ ShareAction: () => null }));
const ctx = vi.hoisted(() => ({ addFault: vi.fn(async () => {}), clearFault: vi.fn(async () => {}), attachFaultPhoto: vi.fn(async () => {}) }));
vi.mock('../../src/context/IssueContext', () => ({ useIssueContext: () => ctx }));

import { IssueCard } from '../../src/components/issue-log/IssueCard';

const issue = (over: Partial<FacilityIssue> = {}): FacilityIssue => ({
  id: 'mat', branchId: 'YWG', title: 'Mat machine', description: 'Keeps on tripping the outlet',
  severity: 'low', reportedById: 'u1', reportedAt: '2026-04-30T12:00:00Z',
  status: 'reopened', reopenCount: 2, ...over,
});

const props = {
  onClear: vi.fn(async () => {}),
  onReopen: vi.fn(async () => {}),
  getUserName: () => 'Aaron S.',
};

beforeEach(() => { props.onReopen.mockClear(); props.onClear.mockClear(); });

const fault = (over: Partial<IssueFault> = {}): IssueFault => ({
  id: 'f1', issueId: 'mat', note: 'Eating mats and getting stuck', openedAt: '2026-08-04T15:00:00Z',
  openedBy: 'u1', ...over,
});

describe('IssueCard — what is wrong with it now', () => {
  it('⭐ an open machine shows its open fault', () => {
    render(<IssueCard issue={issue({ faults: [fault()] })} {...props} />);
    expect(screen.getByText(/Eating mats and getting stuck/)).toBeInTheDocument();
  });

  // ⚠️ The FIRST fault (description) is never shown in place of a newer one — it stays on the record.
  it('⚠️ never shows the first report while a fault is open', () => {
    render(<IssueCard issue={issue({ faults: [fault()] })} {...props} />);
    expect(screen.queryByText(/Keeps on tripping the outlet/)).toBeNull();
  });

  it('⚠️ a cleared machine shows no fault at all — it is not down', () => {
    render(<IssueCard issue={issue({ status: 'resolved', faults: [] })} cleared {...props} />);
    expect(screen.queryByText(/Eating mats/)).toBeNull();
    expect(screen.queryByText(/Keeps on tripping the outlet/)).toBeNull();
  });
});

describe('IssueCard — reopening asks what broke', () => {
  const openReopen = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<IssueCard issue={issue({ status: 'resolved' })} cleared {...props} />);
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
  };

  it('asks the question in his words', async () => {
    const user = userEvent.setup();
    await openReopen(user);
    expect(screen.getByPlaceholderText(/What's wrong this time\?/i)).toBeInTheDocument();
  });

  // ⚠️⚠️ THE RULING (2026-09-20). It was optional, and both reopens on file carry an EMPTY note —
  // so with the record renamed to the machine, a blank reopen would leave the card describing
  // April's fault while the machine is down for a new one.
  it('⚠️⚠️ cannot be confirmed until he says what is wrong', async () => {
    const user = userEvent.setup();
    await openReopen(user);
    const confirm = screen.getByRole('button', { name: /Confirm Reopen/i });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(props.onReopen).not.toHaveBeenCalled();
  });

  it('⚠️ whitespace is not an answer', async () => {
    const user = userEvent.setup();
    await openReopen(user);
    await user.type(screen.getByPlaceholderText(/What's wrong this time\?/i), '   ');
    expect(screen.getByRole('button', { name: /Confirm Reopen/i })).toBeDisabled();
  });

  it('⭐ answered, it reopens with the fault attached', async () => {
    const user = userEvent.setup();
    await openReopen(user);
    await user.type(screen.getByPlaceholderText(/What's wrong this time\?/i), 'eating the mats');
    await user.click(screen.getByRole('button', { name: /Confirm Reopen/i }));
    await waitFor(() => expect(props.onReopen).toHaveBeenCalledWith('mat', 'eating the mats'));
  });
});

// ⭐⭐ FAULTS AS ROWS (migration 150). Aaron, 2026-09-24, at the auto wash: *"there's also another
// issue … The wheel brush on the passenger side isn't spinning. That one has been non functional for
// a month now"* — on top of the rinse pipe that snapped that afternoon. docs/September/ticket-faults-as-rows.md
describe('IssueCard — a machine down for two reasons', () => {
  const NOW = new Date('2026-09-24T23:30:00Z');
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); Object.values(ctx).forEach(f => f.mockClear()); });
  afterEach(() => { vi.useRealTimers(); });

  const BRUSH = fault({ id: 'brush', issueId: 'aw', note: 'Passenger side wheel brush not spinning',
    openedAt: '2026-08-24T17:00:00Z', photoUrl: 'https://cdn/brush.jpg' });
  const PIPE = fault({ id: 'pipe', issueId: 'aw', note: 'Rinse pipe snapped off the arch', openedAt: '2026-09-24T22:02:00Z' });
  const wash = () => issue({ id: 'aw', title: 'Auto wash', reportedAt: '2026-06-08T11:48:00Z',
    photoUrl: 'https://cdn/june-estop.jpg', faults: [BRUSH, PIPE] });

  it('⭐ shows BOTH faults, and the header counts from the OLDEST', () => {
    render(<IssueCard issue={wash()} {...props} />);
    expect(screen.getByText(/Rinse pipe snapped off the arch/)).toBeInTheDocument();
    expect(screen.getByText(/wheel brush not spinning/)).toBeInTheDocument();
    expect(screen.getByText(/2 faults · Day 31/)).toBeInTheDocument();
    expect(screen.queryByText(/Day 108/)).toBeNull();                 // never the machine's first report
  });

  it('each fault counts its OWN days', () => {
    render(<IssueCard issue={wash()} {...props} />);
    expect(screen.getByText(/Aaron S\. · Day 31/)).toBeInTheDocument();
    expect(screen.getByText(/Aaron S\. · Today/)).toBeInTheDocument();
  });

  it('⭐ each fault has its own photo — or its own "+ Add photo" — never the first report\'s', () => {
    render(<IssueCard issue={wash()} {...props} />);
    const photos = screen.getAllByAltText('Issue photo').map(i => i.getAttribute('src'));
    expect(photos).toEqual(['https://cdn/brush.jpg']);               // June's E-stop photo is not shown
    expect(screen.getByText(/\+ Add photo/)).toBeInTheDocument();    // …the pipe can take its own
  });

  it('⭐ each fault clears ON ITS OWN', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<IssueCard issue={wash()} {...props} />);
    const clears = screen.getAllByRole('button', { name: 'Clear' });
    expect(clears.length).toBe(3);                                    // the machine's + one per fault
    await user.click(clears[2]);                                      // the pipe's
    await user.click(screen.getByRole('button', { name: /Clear this fault/ }));
    expect(ctx.clearFault).toHaveBeenCalledWith(PIPE, undefined);
  });

  it('a single fault has no Clear of its own — the machine\'s Clear already means it', () => {
    render(<IssueCard issue={issue({ faults: [fault()] })} {...props} />);
    expect(screen.getAllByRole('button', { name: 'Clear' })).toHaveLength(1);
  });

  it('⭐ "+ Add fault" asks what else is wrong, and will not add a blank', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<IssueCard issue={issue({ faults: [fault()] })} {...props} />);
    await user.click(screen.getByRole('button', { name: '+ Add fault' }));
    const add = screen.getByRole('button', { name: '+ Add fault' });
    expect(add).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/What else is wrong/), 'Belt slipping');
    await user.click(add);
    expect(ctx.addFault).toHaveBeenCalledWith('mat', 'Belt slipping');
  });

  it('a machine that has only its first fault reads "Reported by X · Day N"', () => {
    render(<IssueCard issue={issue({ faults: [fault({ openedAt: '2026-09-20T15:00:00Z' })] })} {...props} />);
    expect(screen.getByText(/Reported by Aaron S\. · Day 4/)).toBeInTheDocument();
  });
});
