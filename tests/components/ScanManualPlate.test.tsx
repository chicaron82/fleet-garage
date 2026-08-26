import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanManualPlate } from '../../src/components/scan-router/ScanManualPlate';

// The way out when the camera can't help. Aaron asked for it 2026-08-25, standing at a car with a
// dead scanner: "how bout a fall back to enter plate if the scanner goes down too and it would
// count it as being seen." The airport flip had this since July; the header scanner — the surface
// he reaches for most — had no way out at all.

const onSubmit = vi.fn();
beforeEach(() => onSubmit.mockClear());

const input = () => screen.getByLabelText('Enter a plate manually');
const button = () => screen.getByRole('button', { name: 'Look up' });

describe('ScanManualPlate', () => {
  // ⭐ Always present, never an error-state rescue: a fallback you must FAIL first to discover is
  // one he'd sit waiting on during a slow read instead of typing past.
  it('is offered before anything has gone wrong', () => {
    render(<ScanManualPlate onSubmit={onSubmit} />);
    expect(input()).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/if the scan's down/)).toBeInTheDocument();
  });

  it('submits the typed plate', () => {
    render(<ScanManualPlate onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: 'lur489' } });
    fireEvent.click(button());
    expect(onSubmit).toHaveBeenCalledWith('LUR489');   // upper-cased as he types
  });

  it('takes Enter, because he is one-handed with a key tag in the other', () => {
    render(<ScanManualPlate onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: 'LFJ679' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('LFJ679');
  });

  it('clears itself after submitting, so the next car starts empty', () => {
    render(<ScanManualPlate onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: 'LUR489' } });
    fireEvent.click(button());
    expect(input()).toHaveValue('');
  });

  it('refuses an empty or whitespace-only entry', () => {
    render(<ScanManualPlate onSubmit={onSubmit} />);
    expect(button()).toBeDisabled();
    fireEvent.change(input(), { target: { value: '   ' } });
    expect(button()).toBeDisabled();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stands down while a photo read is already in flight', () => {
    render(<ScanManualPlate onSubmit={onSubmit} busy />);
    fireEvent.change(input(), { target: { value: 'LUR489' } });
    expect(button()).toBeDisabled();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
