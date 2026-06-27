import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock kokoro-js — avoids the ~82 MB model download and ONNX runtime.
// vi.mock is hoisted so it covers the dynamic import('kokoro-js') inside getTTS().
const mockGenerate = vi.fn();
const mockTts = { generate: mockGenerate };
const mockFromPretrained = vi.fn();
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: mockFromPretrained } }));

// Stub AudioContext — jsdom does not provide it.
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockConnect = vi.fn();
const mockResume = vi.fn();
const mockCreateBuffer = vi.fn();
const mockCreateBufferSource = vi.fn();

class FakeAudioContext {
  destination = {};
  resume = mockResume;
  createBuffer = mockCreateBuffer;
  createBufferSource = mockCreateBufferSource;
}
Object.defineProperty(window, 'AudioContext', {
  value: FakeAudioContext,
  writable: true,
  configurable: true,
});

import { useKokoroSynthesis } from '../../src/hooks/useKokoroSynthesis';

// NOTE: _ttsPromise is a module-level singleton in useKokoroSynthesis.
// Tests that need a fresh load (the loading→ready test) must run before any test
// that resolves the singleton. Tests are ordered accordingly:
//   1. disabled-state tests (no getTTS() call)
//   2. loading→ready test (consumes mockImplementationOnce; resolves the singleton)
//   3. enabled-state tests (use the already-resolved singleton via waitFor)

describe('useKokoroSynthesis', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Base implementations — stay set across clearAllMocks (which only clears call history).
    mockFromPretrained.mockResolvedValue(mockTts);
    mockResume.mockResolvedValue(undefined);
    mockGenerate.mockResolvedValue({ audio: new Float32Array([0.1, 0.2]), sampling_rate: 22050 });
    mockCreateBuffer.mockReturnValue({ getChannelData: () => new Float32Array(2) });
    mockCreateBufferSource.mockReturnValue({
      buffer: null as unknown,
      connect: mockConnect,
      start: mockStart,
      stop: mockStop,
      onended: null as unknown,
    });
  });

  // --- disabled-state tests (no model load) ---

  it('starts disabled with af_sky voice and idle model state', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.enabled).toBe(false);
    expect(result.current.voice).toBe('af_sky');
    expect(result.current.modelState).toBe('idle');
    expect(result.current.downloadProgress).toBeNull();
  });

  it('reads persisted voice from localStorage on mount', () => {
    localStorage.setItem('fg_effie_voice', 'af_nicole');
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.voice).toBe('af_nicole');
  });

  it('reads persisted enabled state from localStorage on mount', () => {
    // Keep this test free of model-loading side-effects by not calling setEnabled;
    // the persisted-true path does trigger loading, so it comes after the loading test.
    localStorage.setItem('fg_effie_kokoro_enabled', '0');
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.enabled).toBe(false);
  });

  it('setVoice writes to localStorage', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setVoice('af_nicole'));
    expect(result.current.voice).toBe('af_nicole');
    expect(localStorage.getItem('fg_effie_voice')).toBe('af_nicole');
  });

  it('modelState is idle when disabled', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.modelState).toBe('idle');
  });

  it('speak is a no-op when disabled', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.speak('Ready on gate 4.'));
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('cancel is harmless when nothing is playing', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(() => act(() => result.current.cancel())).not.toThrow();
  });

  // --- model loading test (resolves the _ttsPromise singleton) ---

  it('modelState transitions loading → ready when the model resolves', async () => {
    // Use a pending promise so we can observe the loading state before it resolves.
    let resolveLoad!: (v: unknown) => void;
    let capturedCb!: (p: Record<string, unknown>) => void;
    mockFromPretrained.mockImplementationOnce(
      (_id: string, opts: { progress_callback: (p: Record<string, unknown>) => void }) => {
        capturedCb = opts.progress_callback;
        capturedCb({ status: 'initiate', file: 'model.onnx', total: 1000 });
        capturedCb({ status: 'progress', file: 'model.onnx', loaded: 600, total: 1000 });
        return new Promise((r) => { resolveLoad = r; });
      },
    );

    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    expect(result.current.modelState).toBe('loading');

    await waitFor(() => expect(result.current.downloadProgress).toBe(60));

    // The library fires status:'ready' through the callback when fully loaded,
    // then the promise resolves — simulate both.
    act(() => { capturedCb({ status: 'ready' }); resolveLoad(mockTts); });
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    expect(result.current.downloadProgress).toBeNull();
  });

  // --- enabled-state tests (singleton already resolved from above) ---

  it('setEnabled writes to localStorage', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem('fg_effie_kokoro_enabled')).toBe('1');
    act(() => result.current.setEnabled(false));
    expect(localStorage.getItem('fg_effie_kokoro_enabled')).toBe('0');
    expect(result.current.enabled).toBe(false);
  });

  it('persisted enabled=true triggers model loading on mount', async () => {
    localStorage.setItem('fg_effie_kokoro_enabled', '1');
    const { result } = renderHook(() => useKokoroSynthesis());
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
  });

  it('speak is a no-op for empty or whitespace text', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    act(() => result.current.speak('   '));
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('speak calls generate with the text and active voice', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => { result.current.setEnabled(true); result.current.setVoice('af_nicole'); });
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    act(() => result.current.speak('LUR187 cleared for gate 4.'));
    await waitFor(() =>
      expect(mockGenerate).toHaveBeenCalledWith('LUR187 cleared for gate 4.', { voice: 'af_nicole' }),
    );
    expect(mockStart).toHaveBeenCalled();
  });

  it('cancel stops the active audio source', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    act(() => result.current.speak('heads up'));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    act(() => result.current.cancel());
    expect(mockStop).toHaveBeenCalled();
  });
});
