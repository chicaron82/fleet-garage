import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanKeepTagPhoto } from '../../src/components/scan-router/ScanKeepTagPhoto';
import type { Vehicle } from '../../src/types';

// ⭐ A car flagged "Older plate" whose scan AGREES with the record: the photo in his hand IS the
// current tag. Aaron, 2026-09-24 — the follow-up to a3e8a55, which could not reach unit 5421649
// (re-plated to TM169N before the scan photo was kept). docs/September/ticket-keep-a-matching-scan-as-the-tag.md

const car = (over: Partial<Vehicle> = {}): Vehicle =>
  ({ id: 'v1', licensePlate: 'TM169N', unitNumber: '5421649', make: 'Nissan', model: 'Rogue',
     year: 2025, color: 'Gray', status: 'CLEAR', branchId: 'YWG',
     keytagPhotoUrl: 'https://cdn/old-tag.jpg', keytagAuditResult: 'stale', ...over } as Vehicle);

const PHOTO = 'data:image/jpeg;base64,NEW';

describe('ScanKeepTagPhoto — when it offers', () => {
  it('offers on a stale car whose scan matches the record', () => {
    render(<ScanKeepTagPhoto vehicle={car()} tagPlate="TM169N" tagPhoto={PHOTO} scanNonce={1} retakePhoto={vi.fn()} />);
    expect(screen.getByRole('button', { name: /keep this scan/i })).toBeInTheDocument();
  });

  it('not on the typed door — there is no photo to keep', () => {
    const { container } = render(
      <ScanKeepTagPhoto vehicle={car()} tagPlate="TM169N" tagPhoto={null} scanNonce={1} retakePhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('not when the scan reads a DIFFERENT plate — that is the re-plate offer\'s job', () => {
    const { container } = render(
      <ScanKeepTagPhoto vehicle={car()} tagPlate="LZM500" tagPhoto={PHOTO} scanNonce={1} retakePhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('not on a MISREAD — only an exact match is certainly the current tag', () => {
    const { container } = render(
      <ScanKeepTagPhoto vehicle={car({ licensePlate: 'LUR143' })} tagPlate="LURL43" tagPhoto={PHOTO}
        scanNonce={1} retakePhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('not on a car whose photo is fine', () => {
    const { container } = render(
      <ScanKeepTagPhoto vehicle={car({ keytagAuditResult: 'verified' })} tagPlate="TM169N" tagPhoto={PHOTO}
        scanNonce={1} retakePhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ⚠️⚠️ THE FLASH. Adopting a re-plate sets `stale` AFTER the scan, for the second or two before its
  // own retake clears it — and in that window this car looks exactly like one to offer on. The offer
  // is keyed to whether the car was stale WHEN THIS SCAN ARRIVED, so it stays out of that window.
  it('does not appear when the car only BECAME stale after this scan (mid-adopt)', () => {
    const { container, rerender } = render(
      <ScanKeepTagPhoto vehicle={car({ licensePlate: '0GK641', keytagAuditResult: null })} tagPlate="TM169N"
        tagPhoto={PHOTO} scanNonce={1} retakePhoto={vi.fn()} />);
    rerender(<ScanKeepTagPhoto vehicle={car({ keytagAuditResult: 'stale' })} tagPlate="TM169N"
      tagPhoto={PHOTO} scanNonce={1} retakePhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('…but a NEW scan of that car afterwards does offer', () => {
    const { rerender } = render(
      <ScanKeepTagPhoto vehicle={car({ keytagAuditResult: null })} tagPlate="TM169N"
        tagPhoto={PHOTO} scanNonce={1} retakePhoto={vi.fn()} />);
    rerender(<ScanKeepTagPhoto vehicle={car()} tagPlate="TM169N" tagPhoto={PHOTO} scanNonce={2} retakePhoto={vi.fn()} />);
    expect(screen.getByRole('button', { name: /keep this scan/i })).toBeInTheDocument();
  });
});

describe('ScanKeepTagPhoto — the tap', () => {
  it('keeps THIS scan\'s photo and confirms — even after the flag clears underneath it', async () => {
    const retakePhoto = vi.fn().mockResolvedValue(true);
    const { rerender } = render(
      <ScanKeepTagPhoto vehicle={car()} tagPlate="TM169N" tagPhoto={PHOTO} scanNonce={1} retakePhoto={retakePhoto} />);
    await userEvent.click(screen.getByRole('button', { name: /keep this scan/i }));
    expect(retakePhoto).toHaveBeenCalledWith('v1', PHOTO);
    // The retake clears `stale`, so the live car stops qualifying — the confirmation must stay.
    rerender(<ScanKeepTagPhoto vehicle={car({ keytagAuditResult: null })} tagPlate="TM169N"
      tagPhoto={PHOTO} scanNonce={1} retakePhoto={retakePhoto} />);
    expect(await screen.findByText(/tag photo updated/i)).toBeInTheDocument();
  });

  it('says so when it did not save, and does not claim success', async () => {
    render(<ScanKeepTagPhoto vehicle={car()} tagPlate="TM169N" tagPhoto={PHOTO} scanNonce={1}
      retakePhoto={vi.fn().mockResolvedValue(false)} />);
    await userEvent.click(screen.getByRole('button', { name: /keep this scan/i }));
    expect(await screen.findByText(/didn't save/i)).toBeInTheDocument();
    expect(screen.queryByText(/tag photo updated/i)).not.toBeInTheDocument();
  });
});
