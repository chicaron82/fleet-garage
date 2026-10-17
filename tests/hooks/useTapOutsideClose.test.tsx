// Tap outside Find a car / Scan a tag to close it (Aaron, 2026-10-16: *"tapping outside those two closes them out"*),
// without a scroll that ends outside, or a tap mid-read, closing it by accident.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTapOutsideClose } from '../../src/hooks/useTapOutsideClose';

function Sheet({ onClose, enabled = true }: { onClose: () => void; enabled?: boolean }) {
  const backdrop = useTapOutsideClose(onClose, enabled);
  return (
    <div data-testid="backdrop" {...backdrop}>
      <div data-testid="sheet">the car</div>
    </div>
  );
}

const tap = (el: HTMLElement) => { fireEvent.pointerDown(el); fireEvent.click(el); };

describe('useTapOutsideClose', () => {
  it('⭐ a tap on the dimmed area closes it', () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    tap(screen.getByTestId('backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('a tap inside the sheet does not', () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    tap(screen.getByTestId('sheet'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('⚠️ a press that starts in the sheet and lets go outside (a scroll, a drag) does not', () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    fireEvent.pointerDown(screen.getByTestId('sheet'));
    fireEvent.click(screen.getByTestId('backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('switched off (a tag being read), the tap is ignored', () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} enabled={false} />);
    tap(screen.getByTestId('backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
