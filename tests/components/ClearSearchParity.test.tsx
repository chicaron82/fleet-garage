import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VehicleLookup } from '../../src/components/shared/VehicleLookup';

// ⭐⭐ A CAPABILITY-PARITY GAP, found the way they always are — by him using the app.
// Aaron, 2026-09-15: *"some search fields don't have the x to clear, fleet, the header's look up,
// and the scan header's own manual type fallback"*.
//
// The clear button was never missing from FG: `HoldsView` and `NewHoldForm` have had one. It just
// never spread — 10 components carry a search input and 2 had a clear. No file was defective; the
// gap only exists when you COMPARE surfaces, which is why no test could have caught it.
//
// ⚠️ The header 🔍 and the scan sheet's typed fallback are the SAME component in the same overlay,
// so this one file covers two of his three reports — and lands on the flip and closing sheets too.
describe('VehicleLookup — the typed door can be cleared', () => {
  it('⚠️ shows NO × while the field is empty — nothing to clear', () => {
    render(<VehicleLookup onPick={() => {}} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  it('⭐ shows the × once there is text, and clearing empties the field', () => {
    render(<VehicleLookup onPick={() => {}} />);
    const input = screen.getByLabelText(/Look up a vehicle/);
    fireEvent.change(input, { target: { value: 'LUR327' } });
    expect((input as HTMLInputElement).value).toBe('LUR327');

    const clear = screen.getByLabelText('Clear search');
    // ⚠️ mouseDown, not click: the input's onBlur closes the suggestion list on a delay, so a real
    // click would fire blur first and move the layout under the thumb before the tap landed.
    fireEvent.mouseDown(clear);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('⚠️ the × goes away again once the field is empty', () => {
    render(<VehicleLookup onPick={() => {}} />);
    const input = screen.getByLabelText(/Look up a vehicle/);
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.mouseDown(screen.getByLabelText('Clear search'));
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  // ⚠️ Same aria-label as HoldsView's and NewHoldForm's. Two clear buttons that differ is how a
  // house style stops being one — and it is the label a screen reader and a test both key on.
  it('uses the same aria-label the existing ones use', () => {
    render(<VehicleLookup onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Look up a vehicle/), { target: { value: 'A' } });
    expect(screen.getByLabelText('Clear search').textContent).toBe('×');
  });
});
