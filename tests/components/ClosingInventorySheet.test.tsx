// The running sheet, in piles.
//
// ⚠️ WHY THIS EXISTS: grouping the table means a row's DRAWN position stops matching its position in
// the sheet, while `onEdit`/`onRemove` still address rows by position. Get that wrong and a tap on
// one car's × deletes another — silently, and `Undo last` only lifts the newest row, so a wrongly
// removed row 3 of 40 is unrecoverable. The lib test proves `groupEntries` carries the index; this
// one proves the component actually USES it.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClosingInventorySheet } from '../../src/components/my-shift/ClosingInventorySheet';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const row = (plate: string, status: InventoryEntry['status']): InventoryEntry => ({
  vehicleId: null, plate, unitNumber: null, owningArea: null, rentalClass: null,
  status, row: '', note: '',
});

// Aaron's actual 2026-09-05 sweep shape: *"starts off M some B break it then back to M"*.
const SHEET = [row('M1', 'M'), row('B1', 'B'), row('M2', 'M'), row('A1', 'A'), row('B2', 'B')];

function sheet(over: Partial<Parameters<typeof ClosingInventorySheet>[0]> = {}) {
  const onRemove = vi.fn(), onEdit = vi.fn(), onUndo = vi.fn();
  render(<ClosingInventorySheet entries={SHEET} tally={[]}
    onRemove={onRemove} onEdit={onEdit} onUndo={onUndo} {...over} />);
  return { onRemove, onEdit, onUndo };
}

describe('ClosingInventorySheet', () => {
  it('draws the piles in the form legend order, not scan order', () => {
    sheet();
    const heads = screen.getAllByRole('columnheader')
      .map(h => h.textContent ?? '').filter(t => /\(\d\)/.test(t));
    expect(heads.map(t => t.replace(/\s+/g, ' ').trim()))
      .toEqual(['Available (1)', 'Body (2)', 'Mechanical (2)']);
  });

  it('⚠️ removes the car that was TAPPED, not the one at that drawn position', async () => {
    // M1 is scanned first (sheet index 0) but drawn fourth once the piles form.
    const { onRemove } = sheet();
    await userEvent.click(screen.getByLabelText('Remove M1'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('⚠️ edits by sheet index too', async () => {
    const { onEdit } = sheet();
    await userEvent.click(screen.getByLabelText('Edit B2'));
    expect(onEdit).toHaveBeenCalledWith(4);   // scanned last, drawn third
  });

  it('marks the most recently scanned car, which grouping no longer leaves at the bottom', () => {
    sheet();
    expect(screen.getByText(/most recently scanned/)).toBeInTheDocument();
  });

  it('says so plainly when nothing has been written up', () => {
    sheet({ entries: [] });
    expect(screen.getByText(/Scan a key tag to start the sheet/)).toBeInTheDocument();
  });
});
