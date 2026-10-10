import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvAssetLoan, Vehicle } from '../../src/types';

// ⚠️ A WRITE THAT FAILS MUST SAY SO. Both loan ops answered a failed write with a bare `return`, so a
// lost loan looked exactly like a saved one (line-checks 2026-09-28 and 2026-10-10).
// docs/October/ticket-ev-loan-writes-say-when-they-fail.md

// What each table's next write answers with. Reset per test; `{ error: null }` unless a test says otherwise.
const answers: Record<string, { error: unknown }> = {};
const answer = (key: string) => Promise.resolve(answers[key] ?? { error: null });

vi.mock('../../src/lib/supabase', () => ({
  writeWithRefresh: (fn: () => unknown) => fn(),
  supabase: {
    from: (table: string) => ({
      insert: () => answer(`${table}:insert`),
      update: () => ({ eq: () => answer(`${table}:update`) }),
    }),
  },
}));

import { makeEvAssetLoanOps } from '../../src/context/evAssetLoanWrite';

const LOAN: EvAssetLoan = {
  id: 'loan-1', lenderVehicleId: 'v-lender', assetType: 'cable', borrowerUnit: '5429001', status: 'out',
  notes: null, createdAt: '2026-10-01T00:00:00Z', createdBy: 'u1', returnedAt: null, returnedBy: null,
};
const LENDER = { id: 'v-lender', hasMobileCable: false, hasJ1772Adapter: true } as Vehicle;
const FAILED = { error: { message: 'boom' } };

let loans: EvAssetLoan[];
let vehicles: Vehicle[];
const apply = <T,>(get: () => T, set: (v: T) => void) => (next: T | ((prev: T) => T)) =>
  set(typeof next === 'function' ? (next as (prev: T) => T)(get()) : next);
const ops = () => makeEvAssetLoanOps({
  setLoans: apply(() => loans, v => { loans = v; }),
  setAllVehicles: apply(() => vehicles, v => { vehicles = v; }),
});

beforeEach(() => {
  for (const k of Object.keys(answers)) delete answers[k];
  loans = [LOAN];
  vehicles = [LENDER];
});

describe('createEvAssetLoan', () => {
  it('⭐ throws when the insert fails, and adds no loan to the list', async () => {
    loans = [];
    answers['ev_asset_loans:insert'] = FAILED;
    await expect(ops().createEvAssetLoan('v-lender', 'cable', '5429001', null, 'u1')).rejects.toThrow();
    expect(loans).toEqual([]);
  });

  it('a landed insert adds the loan and resolves', async () => {
    loans = [];
    await ops().createEvAssetLoan('v-lender', 'adapter', ' 5429002 ', null, 'u1');
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ assetType: 'adapter', borrowerUnit: '5429002', status: 'out' });
  });
});

describe('returnEvAssetLoan', () => {
  it('⭐ throws when the loan did not close, and changes nothing locally', async () => {
    answers['ev_asset_loans:update'] = FAILED;
    await expect(ops().returnEvAssetLoan(LOAN, LENDER, 'u1')).rejects.toThrow();
    expect(loans).toEqual([LOAN]);
    expect(vehicles[0].hasMobileCable).toBe(false);
  });

  it('a clean return closes the loan, marks the asset present, and says "returned"', async () => {
    await expect(ops().returnEvAssetLoan(LOAN, LENDER, 'u1')).resolves.toBe('returned');
    expect(loans).toEqual([]);
    expect(vehicles[0].hasMobileCable).toBe(true);
  });

  it('⭐ the loan closed but the restore failed → "incomplete", and the card does NOT claim the cable', async () => {
    answers['vehicles:update'] = FAILED;
    await expect(ops().returnEvAssetLoan(LOAN, LENDER, 'u1')).resolves.toBe('incomplete');
    expect(loans).toEqual([]);                       // the loan really is closed
    expect(vehicles[0].hasMobileCable).toBe(false);  // the database still says missing
  });

  it('the restore landed but the timeline row did not → still "incomplete", asset shown present', async () => {
    answers['ev_asset_updates:insert'] = FAILED;
    await expect(ops().returnEvAssetLoan(LOAN, LENDER, 'u1')).resolves.toBe('incomplete');
    expect(vehicles[0].hasMobileCable).toBe(true);
  });
});
