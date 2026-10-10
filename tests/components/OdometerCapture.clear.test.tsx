import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OdometerCapture, CLEAR_ARM_MS } from '../../src/components/shared/OdometerCapture';

// Aaron, 2026-08-26, mid-shift: "I attached an odo reading to the wrong vehicle. how do I clear the
// one I added to LUR195" — and the honest answer was that he couldn't. Save is disabled at or below
// the current reading, and there was no clear, so a wrong number was permanently locked in. It took
// a database write to fix.
//
// ⭐ The guard is right about the world and wrong about the user: an odometer never goes down, but a
// mis-typed ENTRY absolutely does, and the check cannot tell those apart.

const onSave = vi.fn().mockResolvedValue(undefined);
const onClear = vi.fn().mockResolvedValue(true);
beforeEach(() => { onSave.mockClear(); onClear.mockClear(); onClear.mockResolvedValue(true); });
afterEach(() => { vi.useRealTimers(); });

const clearBtn = () => screen.getByRole('button', { name: /clear/i });
/** Arm, then confirm — the two taps a real clear takes since 2026-10-10. */
const clearTwice = () => { fireEvent.click(clearBtn()); fireEvent.click(clearBtn()); };
const show = (currentKm: number | null, withClear = true) =>
  render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={currentKm} currentAt={null}
    onSave={onSave} onClear={withClear ? onClear : undefined} />);

describe('clearing a mis-typed odometer', () => {
  it('offers a clear when there is a reading to clear', () => {
    show(8810);
    expect(clearBtn()).toBeInTheDocument();
  });

  it('clears the car it was given', async () => {
    show(8810);
    clearTwice();
    await waitFor(() => expect(onClear).toHaveBeenCalledWith('v1'));
  });

  // ⚠️ A control that does nothing is worse than no control — an unlogged car has nothing to clear.
  it('offers nothing on a car with no reading', () => {
    show(null);
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
    expect(screen.getByText(/Odometer not logged/i)).toBeInTheDocument();
  });

  // Read-only hosts simply do not pass the handler.
  it('offers nothing when the host gives no clear handler', () => {
    show(8810, false);
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('stands down while a clear is in flight', async () => {
    let release!: (v: boolean) => void;
    onClear.mockReturnValue(new Promise<boolean>(res => { release = res; }));
    show(8810);
    clearTwice();
    await waitFor(() => expect(clearBtn()).toBeDisabled());
    release(true);
  });

  // ⭐⭐ THE GUARD MUST SURVIVE. Clearing exists so the backwards rule does NOT have to be relaxed —
  // a lower reading is still a misread or the wrong car, and Log stays refused.
  it('does not weaken the forward-only rule', () => {
    show(8810);
    const input = screen.getByLabelText('Odometer reading');
    fireEvent.change(input, { target: { value: '8000' } });
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '8810' } });
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();   // equal is not forward
    fireEvent.change(input, { target: { value: '8900' } });
    expect(screen.getByRole('button', { name: 'Log' })).toBeEnabled();
  });

  // ⭐⭐ ONE TAP DOES NOT CLEAR (2026-10-10, docs/October/ticket-scan-card-header-chips.md). This
  // case used to assert the opposite — "takes one tap — no confirmation step". On the scan sheet the
  // button sits on the path of his thumb, and a scroll-tap must not be able to wipe a reading.
  it('⚠️ a single tap arms it and writes nothing', () => {
    show(8810);
    fireEvent.click(clearBtn());
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /tap again to clear/i })).toHaveTextContent('Tap again');
  });

  it('the second tap clears, exactly once', async () => {
    show(8810);
    clearTwice();
    await waitFor(() => expect(onClear).toHaveBeenCalledExactlyOnceWith('v1'));
  });

  // An arm nobody confirms must not sit loaded under his thumb waiting for the next stray tap.
  it('an unconfirmed arm stands down on its own', () => {
    vi.useFakeTimers();
    show(8810);
    fireEvent.click(clearBtn());
    expect(clearBtn()).toHaveTextContent('Tap again');          // control: it WAS armed
    act(() => { vi.advanceTimersByTime(CLEAR_ARM_MS + 1); });
    expect(clearBtn()).toHaveTextContent('Clear');
    fireEvent.click(clearBtn());                                 // so this tap only re-arms
    expect(onClear).not.toHaveBeenCalled();
  });

  // The scan sheet re-uses this control for the NEXT car: an arm must not carry over to it.
  it('a new scan disarms it', () => {
    const { rerender } = render(<OdometerCapture vehicleId="v1" resetKey={1} currentKm={8810} currentAt={null}
      onSave={onSave} onClear={onClear} />);
    fireEvent.click(clearBtn());
    expect(clearBtn()).toHaveTextContent('Tap again');
    rerender(<OdometerCapture vehicleId="v2" resetKey={2} currentKm={500} currentAt={null}
      onSave={onSave} onClear={onClear} />);
    expect(clearBtn()).toHaveTextContent('Clear');
    fireEvent.click(clearBtn());
    expect(onClear).not.toHaveBeenCalled();
  });

  // ⭐⭐ FOUND BY THIS FILE, and worth its own case. The write's rule is `incoming > stored`, so an
  // EQUAL reading is refused there — but the button's guard was a strict `<`, so it stayed ENABLED.
  // Tapping Log returned early without writing while the component flipped to "✓ 8,810 km saved":
  // a success message for a write that never happened. The button now matches the write.
  it('refuses a reading equal to the one on file — the write does', () => {
    show(8810);
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '8810' } });
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
  });

  it('never claims a save it did not make', () => {
    show(8810);
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '8810' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByText(/km saved/i)).toBeNull();
  });

  // ⚠️ Two refusals, said differently: "lower" is a possible misread and earns red; "same" is not a
  // mistake at all. Calling an equal value "lower" would be a small lie inside a message whose only
  // job is catching one.
  it('says SAME for an equal reading and LOWER for a lower one', () => {
    show(8810);
    const input = screen.getByLabelText('Odometer reading');
    fireEvent.change(input, { target: { value: '8810' } });
    expect(screen.getByText(/Already on file at 8,810 km/i)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '8000' } });
    expect(screen.getByText(/Lower than the 8,810 km on file/i)).toBeInTheDocument();
  });
});