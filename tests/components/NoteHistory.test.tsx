import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteHistory } from '../../src/components/vehicle/NoteHistory';
import type { VehicleChangeRow } from '../../src/lib/vehicleChanges';

const rows = vi.hoisted(() => ({ current: [] as VehicleChangeRow[] }));
vi.mock('../../src/hooks/useVehicleChanges', () => ({
  useVehicleChanges: () => rows.current,
}));

const noteRow = (changedAt: string, from: string | null, to: string | null): VehicleChangeRow =>
  ({ changedAt, op: 'UPDATE', changed: { note: { from, to } } });

beforeEach(() => { rows.current = []; });

describe('NoteHistory', () => {
  // ⭐ LZM533's real shape: the note is GONE from the car, which is exactly why he wanted the record.
  it('shows a cleared note with both of its dates', () => {
    rows.current = [
      noteRow('2026-08-27T00:01:25Z', 'Assigned to car star Fife', null),
      noteRow('2026-08-21T18:56:41Z', null, 'Assigned to car star Fife'),
    ];
    render(<NoteHistory vehicleId="geotab-veh-LZM533" />);
    expect(screen.getByText(/Assigned to car star Fife/)).toBeInTheDocument();
    expect(screen.getByText('Past notes')).toBeInTheDocument();
  });

  // ⚠️ Almost every car has never had a note. A heading with nothing under it on 700 records teaches
  // him to scroll past the one that matters.
  it('renders nothing at all when there is no past note', () => {
    const { container } = render(<NoteHistory vehicleId="v1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the only note is still on the car', () => {
    rows.current = [noteRow('2026-08-21T18:56:41Z', null, 'At Speedy')];
    const { container } = render(<NoteHistory vehicleId="v1" />);
    expect(container).toBeEmptyDOMElement();
  });

  // ⚠️ The change log is capped, so a clear can arrive without its start. Say so rather than guess.
  it('says "cleared" when the start fell outside the change window', () => {
    rows.current = [noteRow('2026-08-26T00:00:00Z', 'Older note', null)];
    render(<NoteHistory vehicleId="v1" />);
    expect(screen.getByText(/cleared/)).toBeInTheDocument();
  });

  it('lists several past notes', () => {
    rows.current = [
      noteRow('2026-08-20T00:00:00Z', 'Second', null),
      noteRow('2026-08-18T00:00:00Z', null, 'Second'),
      noteRow('2026-08-10T00:00:00Z', 'First', null),
      noteRow('2026-08-01T00:00:00Z', null, 'First'),
    ];
    render(<NoteHistory vehicleId="v1" />);
    expect(screen.getByText(/Second/)).toBeInTheDocument();
    expect(screen.getByText(/First/)).toBeInTheDocument();
  });
});
