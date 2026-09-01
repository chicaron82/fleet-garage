import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OdometerCapture } from '../../src/components/shared/OdometerCapture';

// Aaron, 2026-09-01, standing at a 2024 Kia Niro EV with the key tag in one hand and the dash in
// front of him: FG said 34,028 km, the dash said 28,921. Someone had read the TRIP METER — 3402.8 —
// and written it on a gas sheet without the decimal, and FG took it as the car's FIRST reading, so
// nothing could compare it to anything. Then the forward-only guard cemented it: the only direction
// that repairs a too-high number is the one direction the guard exists to refuse.
//
// ⚠️ AND THE FIX MUST NOT UNDO THE GUARD. His own ruling, 2026-08-26: a free-typing override
// "would weaken the backwards guard for genuine readings, which is the thing it is genuinely good
// at." So Log stays forward-only; the correction is a SEPARATE control with its own words.

const onSave = vi.fn().mockResolvedValue(undefined);
const onCorrect = vi.fn().mockResolvedValue(true);
beforeEach(() => { onSave.mockClear(); onCorrect.mockClear(); onCorrect.mockResolvedValue(true); });

const show = (currentKm: number | null, withCorrect = true) =>
  render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={currentKm} currentAt={null}
    onSave={onSave} onCorrect={withCorrect ? onCorrect : undefined} />);

const type = (v: string) => fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: v } });
const correctBtn = () => screen.getByRole('button', { name: /record is wrong/i });
const noCorrectBtn = () => screen.queryByRole('button', { name: /record is wrong/i });

describe('correcting a wrong odometer on file', () => {
  // ⭐ THE DISCOVERABILITY REQUIREMENT, and it is a requirement because of what happened to the
  // Clear: built 2026-08-26 for this exact class of problem, shipped green, and he found it a week
  // later by accident — "I never noticed the clear until today 😅". A repair he has to already know
  // about is not a repair, so this one appears the moment he types a number that needs it.
  it('surfaces itself the moment a lower number is typed — nothing to discover', () => {
    show(34028);
    expect(noCorrectBtn()).toBeNull();      // nothing typed yet
    type('28921');
    expect(correctBtn()).toBeInTheDocument();
  });

  it('names the number it will write, so he reads it before he taps', () => {
    show(34028);
    type('28921');
    expect(correctBtn()).toHaveTextContent('28,921');
  });

  it('corrects the car it was given, with the typed value', async () => {
    show(34028);
    type('28921');
    fireEvent.click(correctBtn());
    await waitFor(() => expect(onCorrect).toHaveBeenCalledWith('v1', 28921));
  });

  // ⚠️ THE WARNING COMES FIRST AND STAYS. The first answer to a lower number is still "you may have
  // misread" — that is the common case and the guard is good at it. The correction is the SECOND
  // answer, for when he has looked again and the record is what is wrong.
  it('still warns "check the reading" beside the correction, not instead of it', () => {
    show(34028);
    type('28921');
    expect(screen.getByText(/Lower than the 34,028 km on file — check the reading/i)).toBeInTheDocument();
    expect(correctBtn()).toBeInTheDocument();
  });

  // ⚠️ Log must NOT become a way down. If it ever enables on a lower value, the guard is gone and
  // a genuine misread writes itself silently — the exact thing his 2026-08-26 ruling protected.
  it('leaves Log disabled — the ordinary path is still forward-only', () => {
    show(34028);
    type('28921');
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('offers nothing for a HIGHER reading — that is an ordinary log', () => {
    show(28921);
    type('34028');
    expect(noCorrectBtn()).toBeNull();
  });

  it('offers nothing for the SAME reading — there is nothing to correct', () => {
    show(28921);
    type('28921');
    expect(noCorrectBtn()).toBeNull();
  });

  it('offers nothing on a car with no reading on file — a first reading is just a log', () => {
    show(null);
    type('28921');
    expect(noCorrectBtn()).toBeNull();
  });

  it('offers nothing when the host does not supply a correction path', () => {
    show(34028, false);
    type('28921');
    expect(noCorrectBtn()).toBeNull();
  });

  // ⚠️ R61/R62: never a success message for a write that did not land. A correction that silently
  // failed while the screen said "saved" leaves the wrong number on a car he believes he fixed.
  it('does NOT claim success when the write fails', async () => {
    onCorrect.mockResolvedValue(false);
    show(34028);
    type('28921');
    fireEvent.click(correctBtn());
    await waitFor(() => expect(onCorrect).toHaveBeenCalled());
    expect(screen.queryByText(/saved/i)).toBeNull();
    expect(correctBtn()).toBeInTheDocument();   // still offered — he can try again
  });

  it('confirms only after the write actually landed', async () => {
    show(34028);
    type('28921');
    fireEvent.click(correctBtn());
    await waitFor(() => expect(screen.getByText(/28,921 km saved/i)).toBeInTheDocument());
  });
});
