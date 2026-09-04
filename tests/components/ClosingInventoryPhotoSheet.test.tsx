// The photo-ready sheet — step 4 of the closing checklist, *"send inventory photo to counter."*
//
// ⭐ It is pure and prop-driven on purpose (no clock, no auth, no session), which is exactly what
// makes it testable without a scanner. The lesson from the card: a component I called unverifiable
// because its SURFACE needed a key-tag photo turned out to render alone in ten minutes.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClosingInventoryPhotoSheet, type PhotoSheetMeta } from '../../src/components/my-shift/ClosingInventoryPhotoSheet';
import { rowTally, type InventoryEntry } from '../../src/lib/closingInventory';

const entry = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  vehicleId: 'v1', plate: 'LUR306', unitNumber: '5426952', owningArea: '8199',
  rentalClass: 'C', status: 'A', row: '', note: '', ...over,
});

const meta: PhotoSheetMeta = {
  branch: 'YWG',
  dateLabel: 'Wednesday, September 3, 2026',
  timeLabel: '23:05',
  loggedBy: 'Aaron',
};

function sheet(entries: InventoryEntry[], onClose = vi.fn()) {
  render(
    <ClosingInventoryPhotoSheet
      entries={entries} tally={rowTally(entries)} meta={meta} onClose={onClose} />,
  );
  return { onClose };
}

describe('ClosingInventoryPhotoSheet', () => {
  it('names the form it is standing in for, and who wrote it up when', () => {
    sheet([entry()]);
    expect(screen.getByText('Location Daily Vehicle Inventory')).toBeInTheDocument();
    expect(screen.getByText(/Form 8073-16 · PM · YWG/)).toBeInTheDocument();
    expect(screen.getByText(/23:05 · Aaron/)).toBeInTheDocument();
  });

  it('⭐ prints the unit number the way the KEY TAG groups it, so the sheet can be checked against the tag', () => {
    sheet([entry({ unitNumber: '5426952' })]);
    expect(screen.getByText('542 6952')).toBeInTheDocument();
  });

  it('⚠️ leaves a hand-entered car\'s missing columns BLANK rather than inventing a unit number', () => {
    sheet([entry({ vehicleId: null, unitNumber: null, owningArea: null, rentalClass: null, plate: 'LUR999' })]);
    expect(screen.getByText('LUR999')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('⭐ numbers the lines like the paper, so a 57-car write-up can be counted at a glance', () => {
    sheet([entry({ plate: 'AAA111' }), entry({ plate: 'BBB222' }), entry({ plate: 'CCC333' })]);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('⭐ an AVAILABLE car\'s note is its LOCATION — the status-dependent Notes column', () => {
    sheet([entry({ status: 'A', row: '5' })]);
    expect(screen.getByText('R-5')).toBeInTheDocument();
  });

  it('a held car carries the hold\'s own words instead of a row', () => {
    sheet([entry({ status: 'B', row: '', note: 'chip on rear bumper' })]);
    expect(screen.getByText('chip on rear bumper')).toBeInTheDocument();
    expect(screen.queryByText(/^R-/)).not.toBeInTheDocument();
  });

  it('totals the sheet by status in the words on the form', () => {
    sheet([entry({ status: 'A', row: '5' }), entry({ plate: 'X', status: 'A', row: '5' }), entry({ plate: 'Y', status: 'D' })]);
    expect(screen.getByText(/3 vehicles/)).toBeInTheDocument();
    expect(screen.getByText(/2 available · 1 dirty/)).toBeInTheDocument();
  });

  it('⚠️ reports where the available cars ARE — not the carried row', () => {
    sheet([
      entry({ status: 'A', row: '4' }),
      entry({ plate: 'X', status: 'A', row: '5' }),
      entry({ plate: 'Y', status: 'A', row: '5' }),
    ]);
    expect(screen.getByText(/Available by row: R-4 1\/8 · R-5 2\/8/)).toBeInTheDocument();
  });

  it('⚠️ says on the sheet itself that sale / turnback / buy-back cars are not written up', () => {
    sheet([entry()]);
    expect(screen.getByText(/Sale \/ turnback \/ buy-back cars are not written up/)).toBeInTheDocument();
  });

  it('⚠️ omits Mileage, AM Check and Arrived Overnight — they belong to the morning pass', () => {
    sheet([entry()]);
    expect(screen.queryByText(/Mileage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AM Check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Arrived Overnight/i)).not.toBeInTheDocument();
  });

  it('closes on the control and on Escape', () => {
    const { onClose } = sheet([entry()]);
    fireEvent.click(screen.getByLabelText('Close the sheet'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
