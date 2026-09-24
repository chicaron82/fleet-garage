import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { FacilityIssue } from '../../src/types';

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

import { IssueCard } from '../../src/components/issue-log/IssueCard';

const issue = (over: Partial<FacilityIssue> = {}): FacilityIssue => ({
  id: 'mat', branchId: 'YWG', title: 'Mat machine', description: 'Keeps on tripping the outlet',
  severity: 'low', reportedById: 'u1', reportedAt: '2026-04-30T12:00:00Z',
  status: 'reopened', reopenCount: 2, ...over,
});

const props = {
  onClear: vi.fn(async () => {}),
  onReopen: vi.fn(async () => {}),
  onAttachPhoto: vi.fn(async () => {}),
  getUserName: () => 'Aaron S.',
};

beforeEach(() => { props.onReopen.mockClear(); props.onClear.mockClear(); });

describe('IssueCard — what is wrong with it now', () => {
  it('⭐ shows the CURRENT fault, marked as now', () => {
    render(<IssueCard issue={issue({ currentFault: 'eating the mats being fed in' })} {...props} />);
    expect(screen.getByText(/eating the mats being fed in/)).toBeInTheDocument();
    expect(screen.getByText(/Now:/)).toBeInTheDocument();
  });

  // ⚠️ The first fault is NOT overwritten — it stays on the record and in the history. What changes
  // is which one the card leads with.
  it('⚠️ a machine that only ever broke once still shows its original fault, unlabelled', () => {
    render(<IssueCard issue={issue({ reopenCount: 0, status: 'open', currentFault: undefined })} {...props} />);
    expect(screen.getByText(/Keeps on tripping the outlet/)).toBeInTheDocument();
    expect(screen.queryByText(/Now:/)).not.toBeInTheDocument();
  });

  it('⚠️ a cleared machine shows no fault line at all — it is not down', () => {
    render(<IssueCard issue={issue({ status: 'resolved', currentFault: 'eating the mats' })} cleared {...props} />);
    expect(screen.queryByText(/eating the mats/)).not.toBeInTheDocument();
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

// ⭐ THE PICTURE FOLLOWS THE FAULT (2026-09-24, migration 149). The auto wash's card said "Now: Rinse
// pipe snapped off the arch" — and the only photo it had was June's E-stop. Showing that under the
// new line would be a confident, wrong image. docs/September/ticket-a-photo-per-fault.md
describe('IssueCard — the photo belongs to the fault it sits under', () => {
  const wash = (over: Partial<FacilityIssue> = {}) => issue({
    id: 'aw', title: 'Auto wash', photoUrl: 'https://cdn/june-estop.jpg', ...over,
  });

  it('⚠️ a current fault with no photo shows NO photo — never the first fault\'s', () => {
    render(<IssueCard issue={wash({ currentFault: 'Rinse pipe snapped off the arch' })} {...props} />);
    expect(screen.queryByAltText('Issue photo')).toBeNull();
    expect(screen.getByText(/add photo/i)).toBeInTheDocument();     // …and offers to add THIS one
  });

  it('shows the current fault\'s own photo', () => {
    render(<IssueCard issue={wash({ currentFault: 'Rinse pipe snapped', currentPhoto: 'https://cdn/pipe.jpg' })} {...props} />);
    expect(screen.getByAltText('Issue photo')).toHaveAttribute('src', 'https://cdn/pipe.jpg');
  });

  it('a machine that only broke once still shows its first photo', () => {
    render(<IssueCard issue={wash({ status: 'open', reopenCount: 0 })} {...props} />);
    expect(screen.getByAltText('Issue photo')).toHaveAttribute('src', 'https://cdn/june-estop.jpg');
  });
});
