// The read-only /lot/view shows his notes and the Erin line (Aaron, 2026-11-04: notes *"can be seen via the read-only
// link"*), and never a way to write: no + Note, no Flag it (docs/ticket-bay-erin-exit-notes-existing-hold.md).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BayLogList } from '../../src/components/lot/BayLogList';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, exit: BayLogRow['exit'], note: string | null = null): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate: `LUR${id}`, unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: '2026-11-04', started_at: `2026-11-04T17:0${id}:00.000Z`, exit, exited_at: `2026-11-04T17:2${id}:00.000Z`, note, hold_id: null,
});

describe('BayLogList on the read-only link', () => {
  it('⭐ shows the note and the Erin line, and offers nothing to write', () => {
    render(<BayLogList readOnly heading="Today" rows={[row(1, 'erin', 'Row 6, pickup at 2'), row(2, 'bhold')]} />);
    expect(screen.getByText('📝 Row 6, pickup at 2')).toBeInTheDocument();
    expect(screen.getByText('Erin')).toBeInTheDocument();
    expect(screen.getByText('1 for Erin St')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
