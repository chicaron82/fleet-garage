// The odo on the bay log (2026-11-26, docs/ticket-bay-log-odo-shown.md). Aaron: *"can we add the odo reading entered to
// the lot lookout abs read-only?"*. One component draws both lists, so both get it; a row without one shows nothing.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BayLogList } from '../../src/components/lot/BayLogList';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, odometer: number | null): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate: `LUR${id}`, unit_number: null, car: 'Kia Seltos · Gray', odometer, took_dirty: true, redo_of: null,
  shift_day: '2026-11-26', started_at: `2026-11-26T15:0${id}:00.000Z`, exit: 'clean', exited_at: `2026-11-26T15:1${id}:00.000Z`, note: null, hold_id: null,
});

describe('BayLogList, the odo', () => {
  it('⭐ the read-only link shows a row\'s odo under the car, with thousands and km', () => {
    render(<BayLogList readOnly heading="Today" rows={[row(1, 48213)]} />);
    expect(screen.getByText('odo 48,213 km')).toBeInTheDocument();
  });

  it('⭐ his own list shows it too', () => {
    render(<BayLogList heading="Today" rows={[row(1, 1234567)]} />);
    expect(screen.getByText('odo 1,234,567 km')).toBeInTheDocument();
  });

  it('⭐ a row with no reading shows nothing at all: no blank, no dash', () => {
    const { container } = render(<BayLogList readOnly heading="Today" rows={[row(1, null), row(2, 9000)]} />);
    expect(container.querySelectorAll('[data-odo]')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/odo\s*(–|-|—|km|$)/);
  });
});
