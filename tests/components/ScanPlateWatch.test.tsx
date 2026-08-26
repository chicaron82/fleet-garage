import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScanPlateWatch } from '../../src/components/scan-router/ScanPlateWatch';
import type { PlateWatch } from '../../src/lib/plateWatch';

// The ambush. Aaron, 2026-08-26, off a whiteboard in the washbay: "can I add a license plate to
// watch for? it doesn't exist in FG. so if I scanned it, it would tell me to hold it."

const watch: PlateWatch = {
  id: 'w1', plate: 'DFDA712',
  reason: 'HOLD PLS — off the washbay whiteboard (OUT 86 / IN 85)',
  createdAt: '2026-08-26T12:00:00Z', resolvedAt: null,
};

const onClear = vi.fn();
beforeEach(() => onClear.mockClear());

describe('ScanPlateWatch', () => {
  it('says HOLD, and says which car', () => {
    render(<ScanPlateWatch watch={watch} onClear={onClear} />);
    expect(screen.getByTestId('scan-plate-watch')).toHaveTextContent('HOLD THIS CAR');
    expect(screen.getByTestId('scan-plate-watch')).toHaveTextContent('DFDA712');
  });

  // ⚠️ HIS WORDS, VERBATIM. The board said "HOLD PLS. THX" — a reason code would lose the thing
  // that makes it actionable, and he is the one who wrote it.
  it('shows the reason exactly as it was written', () => {
    render(<ScanPlateWatch watch={watch} onClear={onClear} />);
    expect(screen.getByText(watch.reason)).toBeInTheDocument();
  });

  // ⭐ Announced, because this is the one thing on the sheet that changes what he does with the
  // car in his hand.
  it('announces itself rather than sitting quietly', () => {
    render(<ScanPlateWatch watch={watch} onClear={onClear} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears from right here — where he is standing when he acts on it', () => {
    render(<ScanPlateWatch watch={watch} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: /take it off watch/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('stands down while a clear is already in flight', () => {
    render(<ScanPlateWatch watch={watch} onClear={onClear} clearing />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClear).not.toHaveBeenCalled();
  });

  // A watch set with no note still has to stop him — the plate alone is the message.
  it('still shouts when no reason was written', () => {
    render(<ScanPlateWatch watch={{ ...watch, reason: '' }} onClear={onClear} />);
    expect(screen.getByTestId('scan-plate-watch')).toHaveTextContent('HOLD THIS CAR');
  });
});
