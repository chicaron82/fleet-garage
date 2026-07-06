import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// The hook offloads synthesis to a Web Worker (kokoroWorker.ts) — the freeze fix.
// jsdom has no Worker, so stub it with a fake that answers init→ready and
// generate→audio, recording the generate request (text + voice) for assertions.
// Responses are async (setTimeout) so the transient 'loading' state is observable.
const mockGenerate = vi.fn(); // records what the worker was asked to synthesize

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(msg: { type: string; id?: number; text?: string; voice?: string }) {
    setTimeout(() => {
      if (msg.type === 'init') {
        this.onmessage?.({ data: { type: 'progress', progress: 60 } } as MessageEvent);
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
      } else if (msg.type === 'generate') {
        mockGenerate(msg.text, { voice: msg.voice });
        this.onmessage?.({
          data: { type: 'audio', id: msg.id, audio: new Float32Array([0.1, 0.2]), sampling_rate: 22050 },
        } as MessageEvent);
      }
    }, 0);
  }
  terminate() {}
}
vi.stubGlobal('Worker', FakeWorker);

// Keep kokoro-js mocked too (harmless) in case the worker module is ever touched.
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: vi.fn() } }));

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
Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, writable: true, configurable: true });

import { useKokoroSynthesis } from '../../src/hooks/useKokoroSynthesis';

describe('useKokoroSynthesis', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true, writable: true });
    mockResume.mockResolvedValue(undefined);
    mockCreateBuffer.mockReturnValue({ getChannelData: () => new Float32Array(2) });
    mockCreateBufferSource.mockReturnValue({
      buffer: null as unknown,
      connect: mockConnect,
      start: mockStart,
      stop: mockStop,
      onended: null as unknown,
    });
  });

  // --- disabled / unavailable state (no worker created) ---

  it('starts disabled with af_sky voice and idle model state', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.enabled).toBe(false);
    expect(result.current.available).toBe(true);
    expect(result.current.voice).toBe('af_sky');
    expect(result.current.modelState).toBe('idle');
    expect(result.current.downloadProgress).toBeNull();
  });

  it('is unavailable without cross-origin isolation — modelState error, speak stays silent', () => {
    Object.defineProperty(window, 'crossOriginIsolated', { value: false, configurable: true, writable: true });
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.available).toBe(false);
    act(() => result.current.setEnabled(true));
    expect(result.current.modelState).toBe('error');
    act(() => result.current.speak('LUR187 cleared for gate 4.'));
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('reads persisted voice from localStorage on mount', () => {
    localStorage.setItem('fg_effie_voice', 'af_nicole');
    const { result } = renderHook(() => useKokoroSynthesis());
    expect(result.current.voice).toBe('af_nicole');
  });

  it('setVoice writes to localStorage', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setVoice('af_nicole'));
    expect(result.current.voice).toBe('af_nicole');
    expect(localStorage.getItem('fg_effie_voice')).toBe('af_nicole');
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

  // --- worker-backed model load + speak ---

  it('modelState transitions loading → ready when the worker reports ready', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    expect(result.current.modelState).toBe('loading');
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    expect(result.current.downloadProgress).toBeNull();
  });

  it('setEnabled writes to localStorage', () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem('fg_effie_kokoro_enabled')).toBe('1');
    act(() => result.current.setEnabled(false));
    expect(localStorage.getItem('fg_effie_kokoro_enabled')).toBe('0');
    expect(result.current.enabled).toBe(false);
  });

  it('persisted enabled=true loads the model on mount', async () => {
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

  it('speak sends the text + active voice to the worker and plays the returned audio', async () => {
    const { result } = renderHook(() => useKokoroSynthesis());
    act(() => { result.current.setEnabled(true); result.current.setVoice('af_nicole'); });
    await waitFor(() => expect(result.current.modelState).toBe('ready'));
    act(() => result.current.speak('LUR187 cleared for gate 4.'));
    await waitFor(() =>
      expect(mockGenerate).toHaveBeenCalledWith('LUR187 cleared for gate 4.', { voice: 'af_nicole' }),
    );
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
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
