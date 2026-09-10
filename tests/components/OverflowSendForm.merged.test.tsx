import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverflowSendForm } from '../../src/components/movement/OverflowSendForm';

/**
 * ⭐ Aaron, 2026-09-09: "what say we combine the two sends… an airport trip would still be timed.
 * enter/scan plate. tap the quick start button. overflow would be enter/scan plate. tap where its
 * going. and it just logs where it was sent."
 *
 * And: "an overflow sent to the airport is redundant. airport is the default. if there's no room we
 * offload some to AV Flight and FastAir."
 */
const sendPlateTo = vi.fn<(p: string, d: string) => Promise<boolean>>();
const setDestination = vi.fn();

vi.mock('../../src/hooks/useOverflowSend', () => ({
  useOverflowSend: () => ({
    destination: 'AV Flight', setDestination, sends: [], reading: false, logging: false,
    err: '', toast: null, scanProgress: null,
    scanPhoto: vi.fn(), scanPhotos: vi.fn(), sendPlateTo,
    remove: vi.fn(), logSends: vi.fn(), reset: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/usePhotoIntake', () => ({
  usePhotoIntake: () => ({ photoError: '', takeMany: vi.fn() }),
}));
vi.mock('../../src/components/scan-router/KeytagReplateOffer', () => ({
  KeytagReplateOffer: () => null,
}));

beforeEach(() => { vi.clearAllMocks(); sendPlateTo.mockResolvedValue(true); });

describe('the spot chips', () => {
  it('⭐⭐ offer AV Flight and FastAir — and NOT Airport, which is where cars go by default', () => {
    render(<OverflowSendForm />);
    expect(screen.getByText('AV Flight')).toBeTruthy();
    expect(screen.getByText('FastAir')).toBeTruthy();
    expect(screen.queryByText('Airport')).toBeNull();
  });

  it('⭐⭐⭐ with a plate in hand, tapping a spot LOGS it — no staging, no second tap', async () => {
    render(<OverflowSendForm plate="LUR537" />);
    fireEvent.click(screen.getByText('LUR537 → FastAir'));
    await waitFor(() => expect(sendPlateTo).toHaveBeenCalledWith('LUR537', 'FastAir'));
  });

  it('names the car on the chip, so the tap says what it will do', () => {
    render(<OverflowSendForm plate="lur537" />);
    expect(screen.getByText('LUR537 → AV Flight')).toBeTruthy();
  });

  it('clears the shared plate once its car has been sent', async () => {
    const onPlateSent = vi.fn();
    render(<OverflowSendForm plate="LUR537" onPlateSent={onPlateSent} />);
    fireEvent.click(screen.getByText('LUR537 → AV Flight'));
    await waitFor(() => expect(onPlateSent).toHaveBeenCalled());
  });

  it('⚠️ leaves the plate alone when the write FAILED — nothing was sent', async () => {
    sendPlateTo.mockResolvedValue(false);
    const onPlateSent = vi.fn();
    render(<OverflowSendForm plate="LUR537" onPlateSent={onPlateSent} />);
    fireEvent.click(screen.getByText('LUR537 → AV Flight'));
    await waitFor(() => expect(sendPlateTo).toHaveBeenCalled());
    expect(onPlateSent).not.toHaveBeenCalled();
  });

  // ⚠️⚠️ FOUND BY PASS TWO, an hour after shipping. Tapping WITH a plate logged the car and left
  // `destination` untouched, so a stack attached afterwards went to whatever had been armed before.
  // Silent, and wrong in the direction that puts cars on the wrong list.
  it('⚠️⚠️ tapping a spot ARMS it for the stack too, not just logs the one car', async () => {
    render(<OverflowSendForm plate="LUR537" />);
    fireEvent.click(screen.getByText('LUR537 → FastAir'));
    expect(setDestination).toHaveBeenCalledWith('FastAir');
    await waitFor(() => expect(sendPlateTo).toHaveBeenCalled());
  });

  it('⭐ with NO plate the same chip only arms the destination for the stack path', () => {
    render(<OverflowSendForm />);
    fireEvent.click(screen.getByText('FastAir'));
    expect(setDestination).toHaveBeenCalledWith('FastAir');
    expect(sendPlateTo).not.toHaveBeenCalled();
  });
});

describe('what the merge removed and what it kept', () => {
  it('⚠️ its own scan button is GONE — the shared input above fills the plate now', () => {
    render(<OverflowSendForm plate="LUR537" />);
    expect(screen.queryByText(/Scan key tag/i)).toBeNull();
  });

  it('⭐ the STACK stays — a different gesture, and the reason the batch route is not lossy', () => {
    render(<OverflowSendForm />);
    expect(screen.getByText(/Attach a stack of key tags/)).toBeTruthy();
  });
});
