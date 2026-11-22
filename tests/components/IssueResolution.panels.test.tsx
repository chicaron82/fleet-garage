// docs/ticket-multi-issue-hold-panel-pick.md — LJF720, 2026-11-21. One hold, hail + a windshield chip, on
// hood · windshield · roof · trunk. The hail came back fixed; the chip did not. Aaron: "if it was hail, then the
// damage map for hail should be cleared once marked repair. if i marked chip repaired, then the windshield would
// be cleared."
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepairResolution } from '../../src/components/holds/RepairResolution';
import type { Hold } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn() }));

const ljf720: Hold = {
  id: 'h-7', vehicleId: 'v-7', holdTypes: ['hail', 'damage'], holdType: 'hail', resolvedTypes: [],
  damageDescription: 'Hail damage; Windshield chip', notes: '',
  flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
  flaggedAt: '2026-11-18T14:30:00.000Z', status: 'ACTIVE', branchId: 'YWG',
  damageZones: ['hood', 'windshield', 'roof', 'trunk-liftgate'], photos: [],
};

function setup(hold: Hold = ljf720) {
  const confirm = {
    repairNotes: '', setRepairNotes: vi.fn(), repairOutcome: 'clean' as const,
    setRepairOutcome: vi.fn(), repairing: false, onCancel: vi.fn(), onConfirm: vi.fn(),
  };
  const markIssueRepaired = vi.fn().mockResolvedValue(undefined);
  const markPanelsRepaired = vi.fn().mockResolvedValue(undefined);
  render(<RepairResolution confirmHolds={[hold]} vehicleHolds={[hold]} userId="u-9"
    markIssueRepaired={markIssueRepaired} markPanelsRepaired={markPanelsRepaired} confirm={confirm} />);
  return { confirm, markIssueRepaired, markPanelsRepaired };
}

const markDone = (i: number) => fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[i]);
const chip = (name: RegExp) => screen.getByRole('button', { name });

describe('a multi-type hold over several panels asks which ones each issue cleared', () => {
  // ⭐⭐ THE CAR THIS IS FOR.
  it('LJF720: Mark Hail done → the hail panels start ticked, one tap clears them, the windshield stays', async () => {
    const { markIssueRepaired, markPanelsRepaired } = setup();
    markDone(0);
    expect(screen.getByText('What did the hail repair clear?')).toBeTruthy();
    expect(chip(/Hood/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/Roof/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/Trunk/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/^(✓ )?Windshield$/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(/stays on this hold for Damage/).textContent).toMatch(/Windshield stays on this hold for Damage/);
    // The glass isn't part of the hail repair, so no scar question — though the description names it (render, 11-21).
    expect(screen.queryByText(/Repair outcome/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Hail done' }));
    await waitFor(() => expect(markPanelsRepaired).toHaveBeenCalledOnce());
    const [holdId, fixed, standing, , issue] = markPanelsRepaired.mock.calls[0];
    expect(holdId).toBe('h-7');
    expect(fixed.zones).toEqual(['hood', 'roof', 'trunk-liftgate']);
    expect(standing.zones).toEqual(['windshield']);
    expect(issue).toEqual({ type: 'hail', resolves: true });
    expect(markIssueRepaired).not.toHaveBeenCalled();
    // Back on the checklist, not closed: the chip is still open.
    await waitFor(() => expect(screen.getByText(/Resolve issues/i)).toBeTruthy());
  });

  it('the chip starts with nothing ticked; tick the windshield and only it clears', async () => {
    const { markPanelsRepaired } = setup();
    markDone(1);
    expect(screen.getByText('What did the damage repair clear?')).toBeTruthy();
    expect(chip(/^(✓ )?Windshield$/).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip(/^(✓ )?Windshield$/));
    expect(screen.getByText(/Repair outcome/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Damage done' }));
    await waitFor(() => expect(markPanelsRepaired).toHaveBeenCalledOnce());
    const [, fixed, standing, , issue] = markPanelsRepaired.mock.calls[0];
    expect(fixed.zones).toEqual(['windshield']);
    expect(standing.zones).toEqual(['hood', 'roof', 'trunk-liftgate']);
    expect(issue).toEqual({ type: 'damage', resolves: true });
  });

  it('every panel ticked while the other issue is open can\'t be saved — it has to sit somewhere', () => {
    const { markIssueRepaired, markPanelsRepaired } = setup();
    markDone(0);
    fireEvent.click(chip(/^(✓ )?Windshield$/));
    const save = screen.getByRole('button', { name: 'Mark Hail done' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/a panel has to stay on this hold/)).toBeTruthy();
    fireEvent.click(save);
    expect(markIssueRepaired).not.toHaveBeenCalled();
    expect(markPanelsRepaired).not.toHaveBeenCalled();
  });

  it('nothing ticked marks the issue done and leaves every panel, the tap it was before', async () => {
    const { markIssueRepaired, markPanelsRepaired } = setup();
    markDone(0);
    ['Hood', 'Roof', 'Trunk'].forEach(n => fireEvent.click(chip(new RegExp(n))));
    expect(screen.queryByText(/Notes/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Hail done' }));
    await waitFor(() => expect(markIssueRepaired).toHaveBeenCalledWith('h-7', 'hail'));
    expect(markPanelsRepaired).not.toHaveBeenCalled();
  });

  it('the last issue with every panel left ticked is the whole repair, one tap, and the hold closes', async () => {
    const { confirm, markIssueRepaired, markPanelsRepaired } = setup({ ...ljf720, resolvedTypes: ['hail'], damageZones: ['windshield', 'hood'] });
    markDone(0);
    expect(screen.getByText('What got fixed?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Repaired' }));
    await waitFor(() => expect(markIssueRepaired).toHaveBeenCalledOnce());
    expect(markIssueRepaired.mock.calls[0][0]).toBe('h-7');
    expect(markIssueRepaired.mock.calls[0][1]).toBe('damage');
    expect(markIssueRepaired.mock.calls[0][2]).toMatchObject({ holdId: 'h-7', repairedById: 'u-9' });
    expect(markPanelsRepaired).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm.onCancel).toHaveBeenCalledOnce());
  });

  it('an issue with no panel (mechanical) is still a single tap', async () => {
    const { markIssueRepaired } = setup({ ...ljf720, holdTypes: ['hail', 'mechanical', 'damage'] });
    markDone(1);
    await waitFor(() => expect(markIssueRepaired).toHaveBeenCalledWith('h-7', 'mechanical'));
    expect(screen.queryByTestId('panel-repair-picker')).toBeNull();
  });
});
