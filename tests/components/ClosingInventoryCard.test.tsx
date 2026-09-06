// ⚠️ WHY THIS EXISTS: shipping pass 2 I wrote "the card and the sheet have never been seen on a
// screen, because both need a real key-tag photo to fire." That was WRONG about my own component.
// The card is pure and prop-driven — no scan, no camera, no hook. I had mis-scoped the verification
// problem and parked something I could have checked in ten minutes.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClosingInventoryCard, ClosingInventoryExclusion } from '../../src/components/my-shift/ClosingInventoryCard';
import { ClosingInventorySheet } from '../../src/components/my-shift/ClosingInventorySheet';
import { rowTally, type InventoryEntry } from '../../src/lib/closingInventory';

const entry = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id: 'e1', at: 1, vehicleId: 'v1', plate: 'LUR306', unitNumber: '5426952', owningArea: '8199',
  rentalClass: 'C', status: 'A', row: '', note: '', ...over,
});

function card(over: Partial<InventoryEntry> = {}, why: string | null = null, suggestedRow: string | null = null) {
  const onChange = vi.fn(), onAdd = vi.fn(), onSkip = vi.fn();
  render(<ClosingInventoryCard entry={entry(over)} why={why} suggestedRow={suggestedRow}
    onChange={onChange} onAdd={onAdd} onSkip={onSkip} />);
  return { onChange, onAdd, onSkip };
}

describe('ClosingInventoryCard', () => {
  it('shows the four columns the TAG already filled, so only the status is left to decide', () => {
    card();
    expect(screen.getByText('LUR306')).toBeInTheDocument();
    expect(screen.getByText(/8199 · 5426952 · C/)).toBeInTheDocument();
  });

  it('⭐ says WHY the status arrived — FG never presents a deduction as a reading', () => {
    card({ status: 'B' }, 'on a damage hold');
    expect(screen.getByText(/on a damage hold/)).toBeInTheDocument();
  });

  it('the row picker exists ONLY for an available car — a B\'s note is a reason, not a place', () => {
    card({ status: 'A', row: '5' });
    expect(screen.getByRole('button', { name: 'R-5' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'R-5' });
  });

  it('a B has no row picker at all', () => {
    card({ status: 'B' });
    expect(screen.queryByRole('button', { name: 'R-5' })).not.toBeInTheDocument();
  });

  it('⭐ "more…" reveals the overflow rows, which are hidden until asked for', () => {
    card({ status: 'A', row: '4' });
    expect(screen.queryByRole('button', { name: 'R-9' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'more…' }));
    expect(screen.getByRole('button', { name: 'R-9' })).toBeInTheDocument();
  });

  it('the notes placeholder asks the RIGHT question for the status', () => {
    card({ status: 'B' });
    expect(screen.getByPlaceholderText('chip? dent?')).toBeInTheDocument();
  });

  it('and a different question for a mechanical', () => {
    card({ status: 'M' });
    expect(screen.getByPlaceholderText('PM? low tire? check engine?')).toBeInTheDocument();
  });

  it('⚠️ an available car with NO row cannot be added — a row is where it IS', () => {
    card({ status: 'A', row: '' });
    expect(screen.getByRole('button', { name: 'Add to sheet' })).toBeDisabled();
  });

  it('…but a dirty car can be added with no row at all', () => {
    card({ status: 'D', row: '' });
    expect(screen.getByRole('button', { name: 'Add to sheet' })).toBeEnabled();
  });

  it('tapping a status chip reports the change rather than mutating', () => {
    const { onChange } = card({ status: 'A' });
    fireEvent.click(screen.getByRole('button', { name: 'D' }));
    expect(onChange).toHaveBeenCalledWith({ status: 'D' });
  });
});

describe('ClosingInventoryExclusion', () => {
  it('⭐ offers the skip in his own words, and an escape hatch from FG being wrong', () => {
    const onSkip = vi.fn(), onAnyway = vi.fn();
    render(<ClosingInventoryExclusion plate="LUR306" reason="on a sale hold"
      onSkip={onSkip} onAnyway={onAnyway} />);
    expect(screen.getByText(/no need to record \(sale \/ TB \/ BB\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(onAnyway).toHaveBeenCalled();
  });
});

describe('ClosingInventorySheet', () => {
  const rows: InventoryEntry[] = [
    entry({ plate: 'AAA111', status: 'A', row: '4' }),
    entry({ plate: 'BBB222', status: 'A', row: '5' }),
    entry({ plate: 'CCC333', status: 'A', row: '5' }),
    entry({ plate: 'DDD444', status: 'B', note: 'windshield chip' }),
  ];

  it('⭐⭐ the tally shows where cars ARE — in more than one row at once', () => {
    render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)} onRemove={vi.fn()} onEdit={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/R-4 1\/8/)).toBeInTheDocument();
    expect(screen.getByText(/R-5 2\/8/)).toBeInTheDocument();
  });

  it('an available car\'s note is its ROW; a B\'s note is the damage', () => {
    render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)} onRemove={vi.fn()} onEdit={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText('R-4')).toBeInTheDocument();
    expect(screen.getByText('windshield chip')).toBeInTheDocument();
  });

  it('empty sheet says so rather than rendering an empty table', () => {
    render(<ClosingInventorySheet entries={[]} tally={[]} onRemove={vi.fn()} onEdit={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/Nothing written up yet/)).toBeInTheDocument();
  });

  it('a row can be removed by plate', () => {
    const onRemove = vi.fn();
    render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)} onRemove={onRemove} onEdit={vi.fn()} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove CCC333' }));
    expect(onRemove).toHaveBeenCalledWith(2);
  });

  // ⭐ *"a new damage brought in after i've already recorded all the damages"* — the status of a car
  // can change AFTER it is written up, and re-scanning to fix it is not a workflow.
  it('a recorded row can be opened for editing, by plate', () => {
    const onEdit = vi.fn();
    render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)} onRemove={vi.fn()} onEdit={onEdit} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit DDD444' }));
    expect(onEdit).toHaveBeenCalledWith(3);
  });

  // ⚠️⚠️ 44px, AND HELD APART — the third instance of a documented mis-tap bug. Aaron on his phone,
  // 2026-09-04: *"the edit and x are tiny and too closer together. fat finger syndrome will make me
  // accidentally tap something I didn't mean to tap."* `PreferencesContext` already records the
  // header ℹ️ sitting `ml-0.5` from 📷 and opening a guide modal under a thumb reaching for the
  // scanner; the fix that worked for the bell was a divider and a gap.
  //
  // ⭐ The classes are asserted deliberately. It reads as brittle, and the alternative is a hit
  // target that silently shrinks back the next time this row is restyled — which is exactly how it
  // got to ~16px with 4px between.
  it('⚠️ gives each row action a 44px target, with a divider between them', () => {
    const { container } = render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)}
      onRemove={vi.fn()} onEdit={vi.fn()} onUndo={vi.fn()} />);
    const edit = screen.getByRole('button', { name: 'Edit AAA111' });
    const remove = screen.getByRole('button', { name: 'Remove AAA111' });
    for (const b of [edit, remove]) {
      expect(b.className).toMatch(/\bh-11\b/);   // 44px
      expect(b.className).toMatch(/\bw-11\b/);
    }
    // Something physically between them, not just margin — the bell's fix.
    expect(container.querySelector('span[aria-hidden="true"].w-px')).not.toBeNull();
  });

  // ⚠️ NOT the same control as the per-row ×. Undo means "I entered that wrong"; the × means a
  // driver took the car. Same effect on the sheet, different reason.
  it('undo-last is its own control, separate from removing a row', () => {
    const onUndo = vi.fn(), onRemove = vi.fn();
    render(<ClosingInventorySheet entries={rows} tally={rowTally(rows)} onRemove={onRemove} onEdit={vi.fn()} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole('button', { name: /Undo last/ }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });
});

// ⭐ The card doubles as the EDITOR for a row already on the sheet — one editor, not a second one
// free to drift from it. Only its two action labels change.
describe('ClosingInventoryCard as an editor', () => {
  it('takes the labels the caller gives it', () => {
    render(<ClosingInventoryCard entry={entry({ status: 'B', note: 'chip' })} why="already on the sheet"
      suggestedRow={null} addLabel="Save" skipLabel="Cancel"
      onChange={vi.fn()} onAdd={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to sheet' })).not.toBeInTheDocument();
  });

  it('still defaults to the scan-path labels when none are given', () => {
    render(<ClosingInventoryCard entry={entry()} why={null} suggestedRow={null}
      onChange={vi.fn()} onAdd={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add to sheet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });
});
