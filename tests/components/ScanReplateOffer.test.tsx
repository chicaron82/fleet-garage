import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanReplateOffer } from '../../src/components/scan-router/ScanReplateOffer';
import type { Vehicle } from '../../src/types';

const car = (licensePlate: string): Vehicle =>
  ({ id: 'v1', licensePlate, unitNumber: '5769880', make: 'Chevrolet', model: 'Suburban',
     year: 2026, color: 'Black', status: 'CLEAR', branchId: 'YWG' } as Vehicle);

describe('ScanReplateOffer', () => {
  // ⭐⭐⭐ THE SAFETY PROPERTY. Offering to adopt a MISREAD would write a plate the car does not have
  // — the exact failure the plate-authoritative rule exists to prevent. Every real misread from this
  // fleet must render nothing at all.
  it('renders nothing for a misread', () => {
    for (const [tag, record] of [
      ['LURL43', 'LUR143'], ['OGK641', '0GK641'], ['OEJ761', '0EJ761'], ['LUR234', 'LUR254'],
    ]) {
      const { container, unmount } = render(
        <ScanReplateOffer vehicle={car(record)} tagPlate={tag} scanNonce={1} adoptPlate={vi.fn()} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('renders nothing when the plates agree, or the tag had none', () => {
    const { container, rerender } = render(
      <ScanReplateOffer vehicle={car('LUR143')} tagPlate="LUR143" scanNonce={1} adoptPlate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ScanReplateOffer vehicle={car('LUR143')} tagPlate={null} scanNonce={1} adoptPlate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Aaron's actual Suburban: Alberta 0GK641 → Manitoba plates, 2026-08-26.
  it('offers on a genuine re-plate, and names BOTH plates', () => {
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1} adoptPlate={vi.fn()} />);
    expect(screen.getByText(/LZM500/)).toBeInTheDocument();
    expect(screen.getByText(/0GK641/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new plates/i })).toBeInTheDocument();
  });

  it('adopts on tap and confirms', async () => {
    const adoptPlate = vi.fn().mockResolvedValue(true);
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1} adoptPlate={adoptPlate} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(adoptPlate).toHaveBeenCalledWith('v1', 'LZM500');
    expect(await screen.findByText(/Plate updated to/)).toBeInTheDocument();
  });

  // ⚠️ A refused write must NOT report success — R61/R62's defect, and the odometer's "✓ saved" on a
  // write that never happened. The write returns false when its own re-plate guard refuses.
  it('says so when the write is refused, and does not claim success', async () => {
    const adoptPlate = vi.fn().mockResolvedValue(false);
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1} adoptPlate={adoptPlate} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Didn't save/)).toBeInTheDocument();
    expect(screen.queryByText(/Plate updated to/)).not.toBeInTheDocument();
  });

  // A fresh scan of the same car must offer again rather than staying "done" from last time.
  it('re-offers on a new scan', async () => {
    const adoptPlate = vi.fn().mockResolvedValue(true);
    const { rerender } = render(
      <ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1} adoptPlate={adoptPlate} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Plate updated to/)).toBeInTheDocument();
    rerender(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={2} adoptPlate={adoptPlate} />);
    expect(screen.getByRole('button', { name: /new plates/i })).toBeInTheDocument();
  });
});
