import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ⚠️⚠️ THE SECOND DOOR. 08d4bee made "What's wrong this time?" required on the CARD's Reopen. Starting
// a New Issue whose title matches a cleared one offers "↩ Reopen instead" — and that door reopened
// with NO note and threw away the description he had just typed. Aaron, 2026-09-24, after the auto
// wash's rinse pipe snapped: *"I reopened it. But couldn't explain what broke."* The 17:02 reopen
// event carries note: null. docs/September/ticket-reopen-instead-drops-the-fault.md

const reopenIssue = vi.fn(async () => {});
const attachPhoto = vi.fn(async () => {});

const AUTO_WASH = {
  id: 'aw', branchId: 'YWG', title: 'Auto wash', description: '', severity: 'high',
  reportedById: 'u1', reportedAt: '2026-06-08T11:48:00Z', status: 'resolved', reopenCount: 0,
  photoUrl: 'https://cdn/june-estop.jpg',
};

vi.mock('../../src/context/IssueContext', () => ({
  useIssueContext: () => ({
    facilityIssues: [AUTO_WASH], addIssue: vi.fn(), attachPhoto, clearIssue: vi.fn(),
    reopenIssue, loadError: null, reload: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/useUserResolver', () => ({ useUserResolver: () => ({ getName: () => 'Aaron' }) }));

import { IssueLogView } from '../../src/components/issue-log/IssueLogView';

async function startDuplicate() {
  render(<IssueLogView />);
  await userEvent.click(screen.getByRole('button', { name: /issue/i }));
  await userEvent.type(screen.getByPlaceholderText(/title/i), 'Auto wash');
}

beforeEach(() => { reopenIssue.mockClear(); attachPhoto.mockClear(); });

describe('"Reopen instead" — the duplicate door', () => {
  it('carries what he typed as the reopen note', async () => {
    await startDuplicate();
    await userEvent.type(screen.getByPlaceholderText(/description|what's wrong/i), 'Rinse pipe snapped off the arch');
    await userEvent.click(screen.getByRole('button', { name: /reopen instead/i }));
    // Third argument: the photo, which rides on the reopen as THIS fault's picture (migration 149).
    expect(reopenIssue).toHaveBeenCalledWith('aw', 'Rinse pipe snapped off the arch', undefined);
  });

  it('will not reopen with no note — same rule as the card', async () => {
    await startDuplicate();
    const btn = screen.getByRole('button', { name: /reopen instead/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(reopenIssue).not.toHaveBeenCalled();
    expect(screen.getByText(/what's wrong this time/i)).toBeInTheDocument();   // says WHY it's disabled
  });
});
