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

  // ⭐⭐ THE SCAN'S PHOTO IS THE NEW TAG (2026-09-24, unit 5421649 → TM169N). Aaron: *"Having to retake
  // a photo of the tag instead of using the one from the scan is too much friction."* Adopting from a
  // scan that photographed the tag must keep THAT photo — through the deliberate-replace path, which
  // also clears the 'stale' flag the adopt sets.
  it('keeps the scan\'s own photo as the new tag photo, after the plate is adopted', async () => {
    const calls: string[] = [];
    const adoptPlate = vi.fn(async () => { calls.push('adopt'); return true; });
    const retakePhoto = vi.fn(async () => { calls.push('retake'); return true; });
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1}
      adoptPlate={adoptPlate} tagPhoto="data:image/jpeg;base64,NEW" retakePhoto={retakePhoto} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Plate updated to/)).toBeInTheDocument();
    expect(retakePhoto).toHaveBeenCalledWith('v1', 'data:image/jpeg;base64,NEW');
    expect(calls).toEqual(['adopt', 'retake']);          // the photo only follows a plate that landed
    expect(screen.getByText(/tag photo too/i)).toBeInTheDocument();
  });

  it('never replaces the photo when the plate write is refused', async () => {
    const retakePhoto = vi.fn().mockResolvedValue(true);
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1}
      adoptPlate={vi.fn().mockResolvedValue(false)} tagPhoto="data:NEW" retakePhoto={retakePhoto} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Didn't save/)).toBeInTheDocument();
    expect(retakePhoto).not.toHaveBeenCalled();
  });

  it('says so when the plate landed but the photo did not', async () => {
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1}
      adoptPlate={vi.fn().mockResolvedValue(true)} tagPhoto="data:NEW"
      retakePhoto={vi.fn().mockResolvedValue(false)} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Plate updated to/)).toBeInTheDocument();
    expect(screen.getByText(/photo didn't save/i)).toBeInTheDocument();
  });

  it('with no scan photo (typed door) nothing is retaken — the old behaviour', async () => {
    const retakePhoto = vi.fn().mockResolvedValue(true);
    render(<ScanReplateOffer vehicle={car('0GK641')} tagPlate="LZM500" scanNonce={1}
      adoptPlate={vi.fn().mockResolvedValue(true)} tagPhoto={null} retakePhoto={retakePhoto} />);
    await userEvent.click(screen.getByRole('button', { name: /new plates/i }));
    expect(await screen.findByText(/Plate updated to/)).toBeInTheDocument();
    expect(retakePhoto).not.toHaveBeenCalled();
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
