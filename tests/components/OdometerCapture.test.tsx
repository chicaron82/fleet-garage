import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OdometerCapture } from '../../src/components/shared/OdometerCapture';

// Odometer capture at the scan (2026-08-25). Migration 123 gave the column exactly ONE writer —
// the airport flip — whose sync hadn't fired since Aug 5, so it stood at 0 of 683 cars while the
// record card faithfully rendered a slot for it. Aaron, holding a Tesla screen reading 110,451 km:
// "let's do the odometer."

const onSave = vi.fn().mockResolvedValue(undefined);
beforeEach(() => onSave.mockClear());

const setup = (over: Partial<Parameters<typeof OdometerCapture>[0]> = {}) =>
  render(<OdometerCapture vehicleId="veh-1" resetKey={1} onSave={onSave} {...over} />);

describe('OdometerCapture', () => {
  it('says the odometer is unlogged when the car has none', () => {
    setup();
    expect(screen.getByText(/Odometer not logged/)).toBeInTheDocument();
  });

  it('logs the reading against the scanned car', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '110451' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('veh-1', 110451));
    expect(await screen.findByText(/110,451 km saved/)).toBeInTheDocument();
  });

  it('accepts the way a dash is actually transcribed', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '110,451' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('veh-1', 110451));
  });

  it('will not submit an empty or unparseable box', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  // ⭐ The write REFUSES a lower reading server-side (an odometer only moves forward, so a smaller
  // number is a misread or the wrong car). Saying so here turns a silent no-op into a caught typo.
  describe('a reading that goes backwards', () => {
    it('blocks the save and explains why', () => {
      setup({ currentKm: 110451, currentAt: '2026-08-25T20:00:00Z' });
      fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '11045' } });
      expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
      expect(screen.getByText(/Lower than the 110,451 km on file/)).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('allows an equal-or-higher reading', () => {
      setup({ currentKm: 110451, currentAt: '2026-08-25T20:00:00Z' });
      fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '110500' } });
      expect(screen.getByRole('button', { name: 'Log' })).not.toBeDisabled();
    });
  });

  // ⭐ A SCAN IS AN EVENT, NOT A VALUE. Re-scanning the same car yields an identical vehicleId, so a
  // value-keyed reset would silently no-op on the repeat and leave the previous number in the box —
  // the exact trap the prefillNonce was invented for (2026-07-21).
  it('clears on the next scan, including a re-scan of the SAME car', async () => {
    const { rerender } = setup({ resetKey: 1 });
    fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: '110451' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await screen.findByText(/saved/);

    // same vehicleId, new scan → must reset
    rerender(<OdometerCapture vehicleId="veh-1" resetKey={2} onSave={onSave} />);
    expect(screen.getByLabelText('Odometer reading')).toHaveValue('');
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  it('renders the last reading WITH its date — never a naked number', () => {
    setup({ currentKm: 47200, currentAt: '2026-04-12T12:00:00Z' });
    const line = screen.getByText(/47,200/);
    expect(line.textContent).toMatch(/47,200 km/);
    expect(line.textContent).not.toBe('47,200 km');   // a date rides along
  });
});

// ⭐ Aaron, 2026-09-02, first thing on an opening: *"is there a way for the field to be ready to
// accept the input instead of me having to tap the field so I can enter the reading?"* He has the
// dash in front of him and one hand free, and the tap that revealed the control already said what
// he wanted to do. The second tap was never carrying information.
//
// ⚠️⚠️ OPT-IN, and that is the whole care. The control has two homes that mean different things by
// "shown": the RECORD CARD reveals it because he tapped "tap to update"; the SCAN SHEET renders it
// unconditionally as one row in a beat that also holds the key count, the EV check and the routing
// buttons. Focusing there would throw a numeric keypad over that sheet on EVERY scan — hiding the
// actions, on a car he may not be reading an odometer from at all.
describe('ready to type', () => {
  const field = () => screen.getByLabelText('Odometer reading');

  it('puts the cursor in the box when a tap of his revealed it', () => {
    render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={19304} currentAt={null}
      autoFocus onSave={vi.fn()} />);
    expect(field()).toHaveFocus();
  });

  // ⚠️ The scan sheet passes nothing, and must keep getting nothing.
  it('does NOT steal focus where it was simply rendered', () => {
    render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={19304} currentAt={null}
      onSave={vi.fn()} />);
    expect(field()).not.toHaveFocus();
  });

  it('is focused ready to accept the reading, not pre-filled with one', () => {
    render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={19304} currentAt={null}
      autoFocus onSave={vi.fn()} />);
    expect(field()).toHaveValue('');
  });
});
