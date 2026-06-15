import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShareText } from '../../src/hooks/useShareText';

// useShareText is the single source for FG's share-as-text behaviour: native
// share sheet when offered, clipboard + "copied" confirmation otherwise. The
// inline ShareAction and every export sheet route through it so the dance can't
// drift. These cases ARE that contract.

describe('useShareText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the native share sheet when available and does not flag copied', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareFn, clipboard: { writeText } });

    const { result } = renderHook(() => useShareText());
    await act(async () => { await result.current.share({ title: 'T', text: 'B' }); });

    expect(shareFn).toHaveBeenCalledWith({ title: 'T', text: 'B' });
    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.copied).toBe(false);
  });

  it('falls back to clipboard and flags copied when there is no native share', async () => {
    // @ts-expect-error — removing the optional DOM API for the test
    delete navigator.share;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useShareText());
    await act(async () => { await result.current.share({ title: 'T', text: 'the body' }); });

    expect(writeText).toHaveBeenCalledWith('the body');
    expect(result.current.copied).toBe(true);
  });

  it('falls back to clipboard when the native share rejects', async () => {
    const shareFn = vi.fn().mockRejectedValue(new Error('cancelled'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareFn, clipboard: { writeText } });

    const { result } = renderHook(() => useShareText());
    await act(async () => { await result.current.share({ title: 'T', text: 'the body' }); });

    expect(writeText).toHaveBeenCalledWith('the body');
    expect(result.current.copied).toBe(true);
  });

  it('clears copied after the reset window', async () => {
    vi.useFakeTimers();
    // @ts-expect-error — removing the optional DOM API for the test
    delete navigator.share;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { result } = renderHook(() => useShareText(1000));
    await act(async () => { await result.current.share({ title: 'T', text: 'B' }); });
    expect(result.current.copied).toBe(true);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });
});
