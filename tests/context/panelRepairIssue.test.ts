// A split made at ONE issue of a multi-type hold (LJF720, 2026-11-21): the fixed row is typed to that issue
// alone, and the issue joins the original's resolved_types only when it is done. See context/panelRepair.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Hold } from '../../src/types';

const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
let table = '';
const chain = {
  insert: vi.fn((p: Record<string, unknown>) => { writes.push({ table, op: 'insert', payload: p }); return chain; }),
  update: vi.fn((p: Record<string, unknown>) => { writes.push({ table, op: 'update', payload: p }); return chain; }),
  delete: vi.fn(() => chain),
  eq: vi.fn(() => chain),
};
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn((t: string) => { table = t; return chain; }) },
  writeWithRefresh: vi.fn(async (fn: () => unknown) => { fn(); return { error: null }; }),
}));

const { makeMarkPanelsRepaired } = await import('../../src/context/panelRepair');

const ljf720: Hold = {
  id: 'h-7', vehicleId: 'v-7', holdTypes: ['hail', 'damage'], holdType: 'hail', resolvedTypes: [],
  damageDescription: 'Hail damage; Windshield chip', notes: '',
  flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
  flaggedAt: '2026-11-18T14:30:00.000Z', status: 'ACTIVE', branchId: 'YWG',
  damageZones: ['hood', 'windshield', 'roof', 'trunk-liftgate'], photos: [],
};
const fixed = { zones: ['hood', 'roof', 'trunk-liftgate'], photos: [], description: 'Hail damage; Windshield chip' };
const standing = { zones: ['windshield'], photos: [], description: 'Hail damage; Windshield chip' };
const repair = { repairedById: 'u-9', repairedAt: '2026-11-21T20:00:00.000Z', notes: '', outcome: 'clean' as const };

function run(issue?: { type: 'hail' | 'damage'; resolves: boolean }, hold: Hold = ljf720) {
  const setAllHolds = vi.fn();
  return makeMarkPanelsRepaired({ holds: [hold], setAllHolds })('h-7', fixed, standing, repair, issue)
    .then(() => {
      const next = (setAllHolds.mock.calls[0][0] as (p: Hold[]) => Hold[])([hold]);
      return { next, row: writes.find(w => w.op === 'insert' && w.table === 'holds')!.payload,
        shrink: writes.find(w => w.op === 'update' && w.table === 'holds')!.payload };
    });
}

beforeEach(() => { writes.length = 0; });

describe('makeMarkPanelsRepaired at one issue', () => {
  it('⭐ the hail repair is a hail row, and hail is done on the hold the chip still sits on', async () => {
    const { row, shrink, next } = await run({ type: 'hail', resolves: true });
    expect(row).toMatchObject({ hold_type: 'hail', hold_types: ['hail'], resolved_types: ['hail'], status: 'REPAIRED',
      damage_zones: ['hood', 'roof', 'trunk-liftgate'] });
    expect(shrink).toMatchObject({ damage_zones: ['windshield'], resolved_types: ['hail'] });
    const original = next.find(h => h.id === 'h-7')!;
    expect(original).toMatchObject({ status: 'ACTIVE', resolvedTypes: ['hail'], damageZones: ['windshield'] });
    expect(next.find(h => h.id !== 'h-7')).toMatchObject({ holdTypes: ['hail'], status: 'REPAIRED' });
  });

  it('the last issue fixed on part of its panels stays open on the rest', async () => {
    const { shrink, next } = await run({ type: 'damage', resolves: false }, { ...ljf720, resolvedTypes: ['hail'] });
    expect(shrink.resolved_types).toEqual(['hail']);
    expect(next.find(h => h.id === 'h-7')!.resolvedTypes).toEqual(['hail']);
  });

  it('the control: with no issue, a one-type split writes what it always did', async () => {
    const { row, shrink } = await run(undefined, { ...ljf720, holdTypes: ['damage'], holdType: 'damage' });
    expect(row).toMatchObject({ hold_types: ['damage'], resolved_types: ['damage'] });
    expect(shrink).not.toHaveProperty('resolved_types');
  });
});
