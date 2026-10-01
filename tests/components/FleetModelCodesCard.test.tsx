import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

// ⭐ Aaron, 2026-10-01: *"can we have somewhere i can see FG's learned model codes to audit"*.
// The card, its hook and the Forget write run for real here; only the database is faked, with a
// MEMORY, so "the row is gone" is proven against a row that was there (the localStorage-mock lesson).

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { class_code_rental_class: [], vehicle_class_codex: [] };
let readFails = false;
let deleteRemovesNothing = false;
const reads: string[] = [];

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        reads.push(table);
        return Promise.resolve(readFails ? { data: null, error: { message: 'down' } } : { data: [...db[table]], error: null });
      },
      delete: () => {
        const want: { code?: unknown; unpinnedOnly?: boolean } = {};
        const chain = {
          eq: (_col: string, v: unknown) => { want.code = v; return chain; },
          is: () => { want.unpinnedOnly = true; return chain; },
          select: () => {
            if (deleteRemovesNothing) return Promise.resolve({ data: [], error: null });
            const hit = (r: Row) => r.code === want.code && (!want.unpinnedOnly || r.pinned_at == null);
            const removed = db[table].filter(hit);
            db[table] = db[table].filter(r => !hit(r));
            return Promise.resolve({ data: removed, error: null });
          },
        };
        return chain;
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { FleetModelCodesCard } from '../../src/components/analytics/FleetModelCodesCard';

const car = (classCode: string, make: string, model: string, rentalClass: string, extra: Row = {}) =>
  ({ classCode, make, model, rentalClass, ...extra });
const LIVE = [
  car('CQZZ', 'Kia', 'Seltos', 'B5'), car('CQZZ', 'Kia', 'Seltos', 'B5'),
  car('CTXF', 'Chevrolet', 'Trax', 'B4'), car('CTXF', 'Chevrolet', 'Trax', 'B4'), car('CTXF', 'Chevrolet', 'Trax', 'B4'),
  car('CQZZ', 'Kia', 'Seltos', 'B5', { unitNumber: 'HRZ-001' }), // a mock — never counted
];
const ARCHIVED = [car('CQZZ', 'Kia', 'Seltos', 'B5', { archivedAt: '2026-08-01' })];

beforeEach(() => {
  readFails = false; deleteRemovesNothing = false; reads.length = 0;
  db.class_code_rental_class = [
    { code: 'CQZX', rental_class: 'B5', pinned_at: null }, // one character from CQZZ, same class
    { code: 'CQZZ', rental_class: 'B5', pinned_at: null },
    { code: 'CTXF', rental_class: 'B4', pinned_at: '2026-09-01T00:00:00Z' },
  ];
  db.vehicle_class_codex = [{ code: 'CQZZ', make: 'Kia', model: 'Seltos' }];
});

const openCard = async () => {
  const user = userEvent.setup();
  render(<FleetModelCodesCard vehicles={LIVE} archivedVehicles={ARCHIVED} />);
  await user.click(screen.getByRole('button', { name: /Model codes FG has learned/ }));
  return user;
};
const rowOf = (code: string) => screen.getByText(code).closest('li')!;

describe('FleetModelCodesCard', () => {
  it('stays shut, and reads nothing, until he opens it', () => {
    render(<FleetModelCodesCard vehicles={LIVE} archivedVehicles={ARCHIVED} />);
    expect(reads).toEqual([]);
    expect(screen.queryByText(/to check/)).not.toBeInTheDocument();
  });

  it('⭐ opens on what needs his eyes, with the reason in plain words', async () => {
    await openCard();
    expect(await screen.findByText(/3 codes/)).toHaveTextContent('3 codes · 1 to check · 0 with no live car');
    expect(within(rowOf('CQZX')).getByText(/one character from CQZZ \(2 cars\), which is also class B5/)).toBeInTheDocument();
    // The codes that agree with their cars wait behind a tap.
    expect(screen.queryByText('CTXF')).not.toBeInTheDocument();
  });

  it('counts live cars only — never a mock or an archived one', async () => {
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: /Agrees with the cars/ }));
    expect(within(rowOf('CQZZ')).getByText('2 cars')).toBeInTheDocument();
  });

  it('⭐ offers Forget on a learned class and a taught model, never on a pin or the built-in list', async () => {
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: /Agrees with the cars/ }));
    expect(screen.getByRole('button', { name: 'Forget class B5 for CQZZ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forget taught Kia Seltos for CQZZ' })).toBeInTheDocument();
    expect(within(rowOf('CTXF')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(rowOf('CTXF')).getByText(/📌/)).toBeInTheDocument();
  });

  it('⭐ Forget takes two taps, and Keep backs out with nothing removed', async () => {
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: 'Forget class B5 for CQZX' }));
    expect(db.class_code_rental_class).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Keep class B5 for CQZX' }));
    expect(db.class_code_rental_class).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Forget class B5 for CQZX' })).toBeInTheDocument();
  });

  it('⭐ the second tap removes the row from the table and from the list', async () => {
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: 'Forget class B5 for CQZX' }));
    await user.click(screen.getByRole('button', { name: 'Yes, forget class B5 for CQZX' }));
    expect(await screen.findByText(/2 codes/)).toHaveTextContent('0 to check');
    expect(screen.queryByText('CQZX')).not.toBeInTheDocument();
    expect(db.class_code_rental_class.map(r => r.code)).toEqual(['CQZZ', 'CTXF']);
  });

  it('forgetting a taught model leaves the learned class alone', async () => {
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: /Agrees with the cars/ }));
    await user.click(screen.getByRole('button', { name: 'Forget taught Kia Seltos for CQZZ' }));
    await user.click(screen.getByRole('button', { name: 'Yes, forget taught Kia Seltos for CQZZ' }));
    expect(await within(rowOf('CQZZ')).findByText('no model')).toBeInTheDocument();
    expect(db.vehicle_class_codex).toEqual([]);
    expect(db.class_code_rental_class).toHaveLength(3);
  });

  // ⚠️ A delete the database quietly refuses answers zero rows and no error.
  it('⭐ says so when the Forget did not land, and keeps the row', async () => {
    deleteRemovesNothing = true;
    const user = await openCard();
    await user.click(await screen.findByRole('button', { name: 'Forget class B5 for CQZX' }));
    await user.click(screen.getByRole('button', { name: 'Yes, forget class B5 for CQZX' }));
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't forget class B5 for CQZX. Nothing was removed");
    expect(screen.getByText('CQZX')).toBeInTheDocument();
  });

  it('⭐ a failed read says so instead of showing an empty list, and Try again reads again', async () => {
    readFails = true;
    const user = await openCard();
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't read the learned codes.");
    expect(screen.queryByText(/to check/)).not.toBeInTheDocument();
    readFails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/3 codes/)).toBeInTheDocument();
  });
});
