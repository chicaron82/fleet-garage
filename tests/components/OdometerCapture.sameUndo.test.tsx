// "Still reads X" and Undo on the odo box (2026-11-07, docs/ticket-odo-same-reading-and-undo.md).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OdometerCapture } from '../../src/components/shared/OdometerCapture';

const AT = '2026-10-26T03:00:00+00:00';
const onSave = vi.fn(async () => true);
const onCorrect = vi.fn(async () => true);
const onConfirm = vi.fn(async () => true);
const onRestore = vi.fn(async () => true);
beforeEach(() => {
  for (const f of [onSave, onCorrect, onConfirm, onRestore]) { f.mockClear(); f.mockResolvedValue(true); }
});

const show = (currentKm: number | null, extra: Record<string, unknown> = {}) =>
  render(<OdometerCapture vehicleId="v1" resetKey="v1" currentKm={currentKm} currentAt={currentKm == null ? null : AT}
    onSave={onSave} onCorrect={onCorrect} onConfirm={onConfirm} onRestore={onRestore} {...extra} />);
const type = (v: string) => fireEvent.change(screen.getByLabelText('Odometer reading'), { target: { value: v } });

describe('"Still reads X"', () => {
  it('⭐ the same number offers a confirm that moves only the date; Log stays off', async () => {
    show(47420);
    type('47420');
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Still reads 47,420 km — confirm it today/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('v1', 47420));
    expect(await screen.findByText('✓ Still 47,420 km, seen today')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('without onConfirm, the old neutral line stays', () => {
    show(47420, { onConfirm: undefined });
    type('47420');
    expect(screen.getByText(/Already on file at 47,420 km — nothing to update/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Still reads/ })).toBeNull();
  });

  it('a confirm that did not land says so', async () => {
    onConfirm.mockResolvedValue(false);
    show(47420);
    type('47420');
    fireEvent.click(screen.getByRole('button', { name: /Still reads/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save');
  });
});

describe('Undo', () => {
  it('⭐ the wrong-car slip: Log, then Undo puts back the old number AND its date', async () => {
    show(47420);
    type('52869');
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('✓ 52,869 km saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('v1', 52869, 47420, AT));
    expect(await screen.findByText('Undone: back to 47,420 km')).toBeInTheDocument();
  });

  it('undoing a first reading goes back to "not logged"', async () => {
    show(null);
    type('52869');
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('v1', 52869, null, null));
    expect(await screen.findByText('Undone: back to not logged')).toBeInTheDocument();
  });

  it('a correction can land on the wrong car too: it gets the same Undo', async () => {
    show(47420);
    type('41000');
    fireEvent.click(screen.getByRole('button', { name: /record is wrong/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('v1', 41000, 47420, AT));
  });

  it('⚠️ an Undo the guard refused (a newer reading since) says so and keeps the saved line', async () => {
    onRestore.mockResolvedValue(false);
    show(47420);
    type('52869');
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not undo');
    expect(screen.getByText('✓ 52,869 km saved')).toBeInTheDocument();
  });

  it('no onRestore, no Undo', async () => {
    show(47420, { onRestore: undefined });
    type('52869');
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await screen.findByText('✓ 52,869 km saved');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
