import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Aaron, 2026-08-25: "to be able to edit the class and/or code right there (if needed) by tapping
// the 'CRHX - Q4'." He is standing at the car; the chip is where he NOTICES the wrong value, so it
// is where the fix belongs.
//
// ⭐ The component's own header used to argue against this — "display-only… a second edit path for
// one field is how two surfaces start disagreeing." That rule still holds and is not being broken:
// the chip opens THE SAME identity modal. A second DOOR to one path is not a second path.

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ recordKeyCount: vi.fn(), recordOdometer: vi.fn() }),
}));
vi.mock('../../src/hooks/useVehicleSightings', () => ({ useVehicleSightings: () => [] }));

import { VehicleRecordFacts } from '../../src/components/vehicle/VehicleRecordFacts';

const onEditCodes = vi.fn();
beforeEach(() => onEditCodes.mockClear());

// ⭐ The codes chip moved behind 🪪 Identity on 2026-09-12 (reference, not work — see the strip's
// header). Rendering it is now a two-step: mount, then open the collapsible.
const show = (ui: React.ReactElement) => {
  const r = render(ui);
  fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
  return r;
};

const chip = () => screen.getByTestId('vehicle-codes-chip');

describe('the codes chip', () => {
  it('shows both of the tag’s vocabularies together', () => {
    show(<VehicleRecordFacts vehicleId="v1" classCode="CRHX" rentalClass="E6" />);
    expect(chip()).toHaveTextContent('CRHX · E6');
  });

  it('opens the identity modal when tapped', () => {
    show(<VehicleRecordFacts vehicleId="v1" classCode="CRHX" rentalClass="Q4" onEditCodes={onEditCodes} />);
    expect(chip().tagName).toBe('BUTTON');
    fireEvent.click(chip());
    expect(onEditCodes).toHaveBeenCalledTimes(1);
  });

  // ⚠️ Read-only surfaces simply don't pass the callback — the chip must not LOOK tappable then,
  // because a control that does nothing is worse than plain text.
  it('stays plain text with no handler', () => {
    show(<VehicleRecordFacts vehicleId="v1" classCode="CRHX" rentalClass="Q4" />);
    expect(chip().tagName).toBe('SPAN');
    expect(chip().className).not.toContain('cursor-pointer');
  });

  it('says what a tap will do, since the chip has no visible label', () => {
    show(<VehicleRecordFacts vehicleId="v1" classCode="CRHX" rentalClass="Q4" onEditCodes={onEditCodes} />);
    expect(chip().getAttribute('title')).toContain('pins the code→class mapping');
  });

  // ⭐ Silent when absent: ~155 cars legitimately have no code, and a "set me" prompt on every one
  // of them is noise, not a nudge.
  it('renders nothing at all when the car has neither', () => {
    show(<VehicleRecordFacts vehicleId="v1" onEditCodes={onEditCodes} />);
    expect(screen.queryByTestId('vehicle-codes-chip')).toBeNull();
  });

  it('renders a lone code without inventing a class', () => {
    show(<VehicleRecordFacts vehicleId="v1" classCode="CRHX" onEditCodes={onEditCodes} />);
    expect(chip()).toHaveTextContent('CRHX');
    expect(chip()).not.toHaveTextContent('·');
  });
});
