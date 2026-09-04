// The three standing numbers above the write-up.
//
// ⚠️ WHY THIS EXISTS: `Logged · Available · Carrying` was in the greenlit mock and never got wired.
// The hook had computed `carriedRow` since pass 2 and nothing consumed it, so the surface's central
// mechanic was invisible. Aaron found the gap by remembering the mock across a compaction.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClosingInventoryStrip } from '../../src/components/my-shift/ClosingInventoryStrip';

function strip(over: Partial<Parameters<typeof ClosingInventoryStrip>[0]> = {}) {
  render(<ClosingInventoryStrip logged={0} available={0} carriedStatus={null} carriedRow="" {...over} />);
}

describe('ClosingInventoryStrip', () => {
  it('counts what has been logged and how much of it is available', () => {
    strip({ logged: 12, available: 9 });
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  // ⭐ Before the first car there is nothing carrying at all — a zero would be a claim, a dash is not.
  it('says nothing is carrying before the first car', () => {
    strip();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('⭐ shows the status AND the row an available car is carrying', () => {
    strip({ logged: 3, available: 3, carriedStatus: 'A', carriedRow: '5' });
    expect(screen.getByText('Available · R-5')).toBeInTheDocument();
  });

  // ⚠️ A row on a non-available carry would be a lie — a dirty car's note is a reason, not a place,
  // which is exactly why the hook only updates the row carry for an `A`.
  it('never shows a row against a status that cannot have one', () => {
    strip({ logged: 4, available: 1, carriedStatus: 'D', carriedRow: '5' });
    expect(screen.getByText('Dirty')).toBeInTheDocument();
    expect(screen.queryByText(/R-5/)).not.toBeInTheDocument();
  });

  it('names the three columns the mock named', () => {
    strip();
    for (const label of ['Logged', 'Available', 'Carrying']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
