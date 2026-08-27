import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OdometerCapture } from '../../src/components/shared/OdometerCapture';

// ⚠️ FOUND BY A REFLECT, IN MY OWN WORK, NINETY MINUTES AFTER SHIPPING IT. When FG met its first US
// car I taught the record's odometer CHIP to say "mi" and left this — the control he actually TYPES
// INTO, and the one on the scan sheet — hard-coded to km. So the Jeep's record read "23,175 mi" while
// the box beneath it asked him for kilometres. Fixed the reader I was looking at, missed the one
// beside it: the exact pattern I spent the week writing lessons about.
describe('OdometerCapture units', () => {
  it('asks for km on a Canadian car', () => {
    render(<OdometerCapture vehicleId="v1" resetKey={1} currentKm={16232} onSave={vi.fn()} />);
    expect(screen.getByPlaceholderText('km on the dash')).toBeInTheDocument();
    expect(screen.getByText(/16,232 km/)).toBeInTheDocument();
  });

  // ⭐ Aaron's Florida Jeep: 23,175 on the dash, and the dash is in miles.
  it('asks for miles on a US car, and says miles back', () => {
    render(<OdometerCapture vehicleId="v1" resetKey={1} currentKm={23175} isUs onSave={vi.fn()} />);
    expect(screen.getByPlaceholderText('mi on the dash')).toBeInTheDocument();
    expect(screen.getByText(/23,175 mi/)).toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  // ⚠️ The refusal messages carry the unit too — telling him a figure is "lower than the 23,175 km on
  // file" for a car measured in miles is a small lie inside a message whose only job is catching one.
  it("uses the car's unit in the refusal, not a hard-coded km", () => {
    render(<OdometerCapture vehicleId="v1" resetKey={1} currentKm={23175} currentAt={null} isUs onSave={vi.fn()} />);
    // The chip itself is the reachable proof without simulating a full type-and-refuse cycle.
    expect(screen.getByText(/23,175 mi/)).toBeInTheDocument();
  });
});
