import { describe, it, expect } from 'vitest';
import { swapPlan, giveAwayPlan } from '../../src/lib/shiftSwap';

describe('swapPlan', () => {
  it('each shift takes on the other\'s content (type + times)', () => {
    const mid     = { shiftType: 'mid' as const,     startTime: '10:30', endTime: '19:00' };
    const dayOff  = { shiftType: 'day-off' as const, startTime: undefined, endTime: undefined };
    const plan = swapPlan(mid, dayOff);
    // Moaz's mid ↔ Mohammed's day-off: each row ends with the other's content.
    expect(plan.forA).toEqual({ shiftType: 'day-off', startTime: undefined, endTime: undefined });
    expect(plan.forB).toEqual({ shiftType: 'mid', startTime: '10:30', endTime: '19:00' });
  });

  it('swapping is symmetric — applying forA then forB lands the trade', () => {
    const opening = { shiftType: 'opening' as const, startTime: '06:45', endTime: '15:15' };
    const closing = { shiftType: 'closing' as const, startTime: '14:30', endTime: '23:00' };
    const plan = swapPlan(opening, closing);
    expect(plan.forA).toEqual({ shiftType: 'closing', startTime: '14:30', endTime: '23:00' });
    expect(plan.forB).toEqual({ shiftType: 'opening', startTime: '06:45', endTime: '15:15' });
  });
});

describe('giveAwayPlan', () => {
  it('giver drops to a day-off, taker inherits the shift content', () => {
    const closing = { shiftType: 'closing' as const, startTime: '14:30', endTime: '23:00' };
    const plan = giveAwayPlan(closing);
    expect(plan.forGiver).toEqual({ shiftType: 'day-off', startTime: undefined, endTime: undefined });
    expect(plan.forTaker).toEqual({ shiftType: 'closing', startTime: '14:30', endTime: '23:00' });
  });
});
