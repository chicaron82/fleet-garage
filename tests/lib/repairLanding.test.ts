import { describe, it, expect } from 'vitest';
import { projectRepair } from '../../src/lib/repairChains';
import type { Hold } from '../../src/types';

function hold(id: string, over: Partial<Hold> = {}): Hold {
  return {
    id, vehicleId: 'v-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
    damageDescription: 'scrape', notes: '',
    flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
    flaggedAt: '2026-06-11T08:00:00.000Z', status: 'ACTIVE', branchId: 'YWG', ...over,
  };
}
const released = (id: string, releaseType: 'EXCEPTION' | 'PRE_EXISTING', over: Partial<Hold> = {}) => hold(id, {
  status: 'RELEASED', flaggedAt: '2026-05-01T00:00:00.000Z',
  release: { id: `rel-${id}`, holdId: id, approvedById: 'mgr', approvedAt: '2026-05-01T00:00:00.000Z',
    releaseType, releaseMethod: 'standard', reason: '', notes: '' },
  ...over,
});

describe('projectRepair — what the confirm is allowed to promise', () => {
  it('the only hold on the car → clear', () => {
    expect(projectRepair(['a'], [hold('a')])).toEqual({ status: 'clear', closes: [] });
  });

  it('another active hold remains → held, NOT clear', () => {
    expect(projectRepair(['a'], [hold('a'), hold('chip')]).status).toBe('held');
  });

  it('a pre-existing release remains → pre-existing', () => {
    expect(projectRepair(['a'], [hold('a'), released('old', 'PRE_EXISTING')]).status).toBe('pre-existing');
  });

  it('an UNLINKED open exception remains → on-exception', () => {
    expect(projectRepair(['a'], [hold('a'), released('other', 'EXCEPTION')]).status).toBe('on-exception');
  });

  it('a linked re-hold → clear, and names the earlier release it closes', () => {
    const earlier = released('aug', 'EXCEPTION');
    const landing = projectRepair(['sep'], [earlier, hold('sep', { linkedHoldId: 'aug' })]);
    expect(landing.status).toBe('clear');
    expect(landing.closes.map(h => h.id)).toEqual(['aug']);
  });

  it('picking both ends of a link closes nothing extra', () => {
    const earlier = released('aug', 'EXCEPTION');
    const landing = projectRepair(['sep', 'aug'], [earlier, hold('sep', { linkedHoldId: 'aug' })]);
    expect(landing).toEqual({ status: 'clear', closes: [] });
  });
});
