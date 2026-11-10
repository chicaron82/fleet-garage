// The note on the car (src/components/vehicle/VehicleNote.tsx, docs/ticket-vehicle-note-fresh-and-fold.md). Aaron,
// 2026-11-10: *"adding a note when one already exists is clearing the previous note first then adding the new one"*.
// A new note on a noted car starts EMPTY, with the current one shown above it; ✏️ Fix this one is the typo path.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const setVehicleNote = vi.fn<(id: string, note: string | null) => Promise<void>>();
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ setVehicleNote }) }));
vi.mock('../../src/hooks/useVehicleChanges', () => ({ useVehicleChanges: () => [] }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: () => {} }));
const { VehicleNote } = await import('../../src/components/vehicle/VehicleNote');

beforeEach(() => { setVehicleNote.mockReset(); setVehicleNote.mockResolvedValue(); });
const box = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const save = () => screen.getByRole('button', { name: 'Save note' });

describe('📝 a note on a car that already has one', () => {
  it('⭐ opens EMPTY, with the current note above it, and saves the new words', async () => {
    render(<VehicleNote vehicleId="v1" note="sent to Speedy for windshield" noteAt="2026-11-01T15:00:00Z" />);
    fireEvent.click(screen.getByRole('button', { name: /sent to Speedy/ }));
    expect(box().value).toBe('');
    expect(screen.getByText('Now:')).toBeInTheDocument();
    expect(screen.getByText(/It moves to Past notes when you save/)).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: 'Sent to auction Nov 10' } });
    fireEvent.click(save());
    await waitFor(() => expect(setVehicleNote).toHaveBeenCalledWith('v1', 'Sent to auction Nov 10'));
  });

  it('✏️ Fix this one fills the box with the old words, the typo path', async () => {
    render(<VehicleNote vehicleId="v1" note="sent to Speedy for windshild" />);
    fireEvent.click(screen.getByRole('button', { name: /sent to Speedy/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fix this one instead/ }));
    expect(box().value).toBe('sent to Speedy for windshild');
    expect(screen.queryByText('Now:')).toBeNull();
    fireEvent.change(box(), { target: { value: 'sent to Speedy for windshield' } });
    fireEvent.click(save());
    await waitFor(() => expect(setVehicleNote).toHaveBeenCalledWith('v1', 'sent to Speedy for windshield'));
  });

  it('⚠️ an empty Save never clears the note by accident; Clear is still its own button', async () => {
    render(<VehicleNote vehicleId="v1" note="At Car Star Fife" />);
    fireEvent.click(screen.getByRole('button', { name: /At Car Star Fife/ }));
    expect(save()).toBeDisabled();
    fireEvent.change(box(), { target: { value: '   ' } });
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(setVehicleNote).toHaveBeenCalledWith('v1', null));
  });

  it('Cancel leaves the note as it was', () => {
    render(<VehicleNote vehicleId="v1" note="At Car Star Fife" />);
    fireEvent.click(screen.getByRole('button', { name: /At Car Star Fife/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setVehicleNote).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /At Car Star Fife/ })).toBeInTheDocument();
  });
});

describe('📝 a car with no note', () => {
  it('is unchanged: Leave a note opens an empty box with no Now line and no Fix', async () => {
    render(<VehicleNote vehicleId="v1" note={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Leave a note/ }));
    expect(box().value).toBe('');
    expect(screen.queryByText('Now:')).toBeNull();
    expect(screen.queryByRole('button', { name: /Fix this one/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    fireEvent.change(box(), { target: { value: 'keys in cupholder' } });
    fireEvent.click(save());
    await waitFor(() => expect(setVehicleNote).toHaveBeenCalledWith('v1', 'keys in cupholder'));
  });
});
