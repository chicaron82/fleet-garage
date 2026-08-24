import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldPickerDetail } from '../../src/components/holds/HoldHistorySection';
import type { Hold } from '../../src/types';

// The real LUR184 shape: every hold carrying the SAME description, one of them a different panel.
const h = (zones: string[], notes: string): Hold => ({
  id: 'x', vehicleId: 'v1', damageDescription: 'Windshield chip', holdTypes: ['damage'],
  status: 'RELEASED', notes, flaggedAt: '2026-04-24T16:28:00Z', damageZones: zones,
  resolvedTypes: [], photos: [],
} as unknown as Hold);

describe('the picker row detail — what tells two holds apart', () => {
  it('⚠️ shows the ZONE, the only thing separating three identical descriptions', () => {
    // LUR184, 2026-08-24: three rows all reading "Windshield chip", differing only by date. One was
    // a rear-bumper scratch. Aaron resolved it off the record because he could not tell, and the car
    // then read CLEAR while still carrying the damage — the amnesia FG exists to prevent.
    render(<HoldPickerDetail hold={h(['rear-bumper'], '')} />);
    expect(screen.getByText('Rear bumper')).toBeTruthy();
  });

  it('shows the note too — the second field that told them apart', () => {
    render(<HoldPickerDetail hold={h([], 'Re-held on return from exception rental')} />);
    expect(screen.getByText('"Re-held on return from exception rental"')).toBeTruthy();
  });

  it('renders every panel when a hold carries several', () => {
    render(<HoldPickerDetail hold={h(['front-bumper', 'driver-rear-door'], '')} />);
    expect(screen.getByText('Front bumper')).toBeTruthy();
    expect(screen.getByText('Driver rear door')).toBeTruthy();
  });

  it('stays quiet when there is nothing extra to say', () => {
    const { container } = render(<HoldPickerDetail hold={h([], '   ')} />);
    expect(container.textContent).toContain('Damage');       // types + date still there
    expect(container.querySelectorAll('span.rounded-full')).toHaveLength(0);
    expect(container.textContent).not.toContain('"');
  });
});
