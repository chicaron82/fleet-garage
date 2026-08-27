import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeytagRetake } from '../../src/components/vehicle/KeytagRetake';

const retake = vi.hoisted(() => vi.fn());
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ retakeKeytagPhoto: retake }),
}));
vi.mock('../../src/lib/image', () => ({ compressImage: async () => 'data:image/jpeg;base64,xxx' }));

const pick = async (label: RegExp) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await userEvent.click(screen.getByRole('button', { name: label }));
  await userEvent.upload(input, new File(['x'], 'tag.jpg', { type: 'image/jpeg' }));
};

beforeEach(() => retake.mockReset());

describe('KeytagRetake', () => {
  it('offers both a camera and a gallery route', () => {
    render(<KeytagRetake vehicleId="v1" />);
    expect(screen.getByRole('button', { name: /retake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose/i })).toBeInTheDocument();
  });

  it('replaces the tag and tells the host', async () => {
    retake.mockResolvedValue(true);
    const onReplaced = vi.fn();
    render(<KeytagRetake vehicleId="v1" onReplaced={onReplaced} />);
    await pick(/retake/i);
    expect(retake).toHaveBeenCalledWith('v1', 'data:image/jpeg;base64,xxx');
    expect(onReplaced).toHaveBeenCalled();
  });

  // ⚠️ A refused write must not report success and must not close the modal — the "✓ saved on a write
  // that never happened" defect, which has now appeared on three different surfaces.
  it('says so when the write fails, and does NOT signal the host', async () => {
    retake.mockResolvedValue(false);
    const onReplaced = vi.fn();
    render(<KeytagRetake vehicleId="v1" onReplaced={onReplaced} />);
    await pick(/retake/i);
    expect(await screen.findByText(/Didn't save/)).toBeInTheDocument();
    expect(onReplaced).not.toHaveBeenCalled();
  });

  // ⚠️ The input is cleared on every pick, so retrying with the SAME file still fires a change event.
  // Without that, a retry after a failure silently does nothing and looks like a dead button.
  it('lets the same photo be retried after a failure', async () => {
    retake.mockResolvedValue(false);
    render(<KeytagRetake vehicleId="v1" />);
    await pick(/retake/i);
    await pick(/retake/i);
    expect(retake).toHaveBeenCalledTimes(2);
  });

  it('writes nothing when no file is chosen', async () => {
    render(<KeytagRetake vehicleId="v1" />);
    await userEvent.click(screen.getByRole('button', { name: /retake/i }));
    expect(retake).not.toHaveBeenCalled();
  });
});
