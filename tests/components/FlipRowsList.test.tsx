import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlipRowsList } from '../../src/components/my-shift/FlipRowsList';
import type { FlipRow } from '../../src/lib/airportFlip';
import type { AirportFlip } from '../../src/hooks/useAirportFlip';

// Split out of AirportFlipSection 2026-08-25 (the file was two lines under the 330 cap).
// The extraction was a pure move, so these tests exist to PROVE it was pure — the list's
// behaviour had never been pinned while it lived inline, which is exactly how a "harmless"
// refactor ships a regression nobody notices until they're standing at the airport.

const row = (over: Partial<FlipRow> & { id: string }): FlipRow => ({
  plate: 'ABC123', unit: '5420211', odo: '42000', fuel: '7/8', isEv: false,
  damaged: false, rentalClass: 'Q4', notes: '', checked: true, sent: false,
  at: 0, deleted: false, ...over,
});

const makeFlip = (rows: FlipRow[], over: Partial<AirportFlip> = {}): AirportFlip => ({
  rows,
  add: vi.fn(), update: vi.fn(), remove: vi.fn(), toggleChecked: vi.fn(),
  reportForSend: vi.fn(() => ''), markSent: vi.fn(),
  checkedUnsentCount: rows.filter(r => r.checked && !r.sent).length,
  ...over,
});

describe('FlipRowsList', () => {
  it('renders nothing at all when the shift has no rows', () => {
    const { container } = render(<FlipRowsList flip={makeFlip([])} onCopy={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps unsent rows open — those are the ones still needing a decision', () => {
    render(<FlipRowsList flip={makeFlip([row({ id: 'a', plate: 'AAA111' })])} onCopy={vi.fn()} />);
    expect(screen.getByText(/AAA111/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('collapses SENT rows behind a summary so a full shift does not bury the scan button', () => {
    const flip = makeFlip([
      row({ id: 'a', plate: 'AAA111' }),
      row({ id: 'b', plate: 'BBB222', sent: true }),
      row({ id: 'c', plate: 'CCC333', sent: true }),
    ]);
    render(<FlipRowsList flip={flip} onCopy={vi.fn()} />);

    expect(screen.getByText(/AAA111/)).toBeInTheDocument();   // unsent: visible
    expect(screen.queryByText(/BBB222/)).not.toBeInTheDocument(); // sent: hidden
    expect(screen.getByText('✓ 2 sent')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✓ 2 sent'));
    expect(screen.getByText(/BBB222/)).toBeInTheDocument();
    expect(screen.getByText(/CCC333/)).toBeInTheDocument();
  });

  it('shows the by-class tally — Aaron\'s own count, not the counter copy-out', () => {
    const flip = makeFlip([
      row({ id: 'a', rentalClass: 'Q4' }),
      row({ id: 'b', rentalClass: 'Q4' }),
      row({ id: 'c', rentalClass: 'P4' }),
    ]);
    render(<FlipRowsList flip={flip} onCopy={vi.fn()} />);
    expect(screen.getByText('Turned around:')).toBeInTheDocument();
    expect(screen.getByText('Q4 ×2')).toBeInTheDocument();
    expect(screen.getByText('P4 ×1')).toBeInTheDocument();
  });

  it('disables the copy-out when nothing is checked, and fires onCopy when something is', () => {
    const onCopy = vi.fn();
    const { rerender } = render(
      <FlipRowsList flip={makeFlip([row({ id: 'a', checked: false })])} onCopy={onCopy} />,
    );
    expect(screen.getByRole('button', { name: /Copy 0 for the counter/ })).toBeDisabled();

    rerender(<FlipRowsList flip={makeFlip([row({ id: 'a', checked: true })])} onCopy={onCopy} />);
    const btn = screen.getByRole('button', { name: /Copy 1 for the counter/ });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('a sent row offers no remove button — it is done, and un-sending it is not a thing', () => {
    render(<FlipRowsList flip={makeFlip([row({ id: 'b', sent: true })])} onCopy={vi.fn()} />);
    fireEvent.click(screen.getByText('✓ 1 sent'));
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('removing an unsent row calls through to the store', () => {
    const flip = makeFlip([row({ id: 'a' })]);
    render(<FlipRowsList flip={flip} onCopy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(flip.remove).toHaveBeenCalledWith('a');
  });
});
