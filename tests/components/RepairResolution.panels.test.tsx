// docs/ticket-repair-some-panels.md — Aaron, 2026-10-21, 0ET075: "went to mark as repaired, but i'm
// afraid it will "repair" the rim damage as well."
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepairResolution } from '../../src/components/holds/RepairResolution';
import type { Hold } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn() }));

const RIM = 'https://x/rim.jpg';
const WS = 'https://x/ws.jpg';
const oet075: Hold = {
  id: 'h-1', vehicleId: 'v-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Windshield chip; Rim / hubcap damage', notes: 'Various windshield chips, RR rim scratches',
  flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
  flaggedAt: '2026-10-21T14:30:12.000Z', status: 'ACTIVE', branchId: 'YWG',
  damageZones: ['windshield', 'wheel-passenger-rear'], photos: [RIM, WS],
};

function setup(hold: Hold = oet075) {
  const confirm = {
    repairNotes: 'Glass shop, same day', setRepairNotes: vi.fn(), repairOutcome: 'clean' as const,
    setRepairOutcome: vi.fn(), repairing: false, onCancel: vi.fn(), onConfirm: vi.fn(),
  };
  const markPanelsRepaired = vi.fn().mockResolvedValue(undefined);
  render(<RepairResolution confirmHolds={[hold]} vehicleHolds={[hold]} userId="u-9"
    markIssueRepaired={vi.fn()} markPanelsRepaired={markPanelsRepaired} confirm={confirm} />);
  return { confirm, markPanelsRepaired };
}

describe('RepairResolution — a hold on two panels asks what got fixed', () => {
  it('starts with every panel ticked, so the whole-hold repair is still one tap', () => {
    const { confirm, markPanelsRepaired } = setup();
    expect(screen.getByRole('button', { name: /Windshield/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /passenger rear/ }).getAttribute('aria-pressed')).toBe('true');
    // No photo/description questions until it is a part repair — hail would never need them.
    expect(screen.queryByText(/Photos of what got fixed/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Repaired' }));
    expect(confirm.onConfirm).toHaveBeenCalledOnce();
    expect(markPanelsRepaired).not.toHaveBeenCalled();
  });

  // ⭐⭐ THE CAR THIS IS FOR.
  it('0ET075: untick the rim, pick the windshield photo and words — only the windshield is repaired', async () => {
    const { confirm, markPanelsRepaired } = setup();
    fireEvent.click(screen.getByRole('button', { name: /passenger rear/ }));
    expect(screen.getByText(/stays on this hold/).textContent).toMatch(/Wheel — passenger rear stays on this hold/);
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Windshield chip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark 1 of 2 as Repaired' }));

    await waitFor(() => expect(markPanelsRepaired).toHaveBeenCalledOnce());
    const [holdId, fixed, standing, repair] = markPanelsRepaired.mock.calls[0];
    expect(holdId).toBe('h-1');
    expect(fixed).toEqual({ zones: ['windshield'], photos: [WS], description: 'Windshield chip' });
    expect(standing).toEqual({ zones: ['wheel-passenger-rear'], photos: [RIM], description: 'Rim / hubcap damage' });
    expect(repair).toMatchObject({ repairedById: 'u-9', notes: 'Glass shop, same day', outcome: 'clean' });
    expect(confirm.onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm.onCancel).toHaveBeenCalledOnce());
  });

  it('a hold on one panel gets the plain confirm, no picker', () => {
    setup({ ...oet075, damageZones: ['windshield'] });
    expect(screen.queryByTestId('panel-repair-picker')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mark as Repaired' })).toBeTruthy();
  });
});
