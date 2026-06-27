import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from '../../src/hooks/useSpeechRecognition';

// A drivable fake of the Web Speech API. The hook builds one on mount and stashes it;
// the test reaches it via FakeSR.last to fire onresult/onend, since the real recognizer
// is internal.
class FakeSR {
  static last: FakeSR | null = null;
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeSR.last = this;
  }
  start() {}
  stop() {
    this.onend?.();
  }
  abort() {}
}

function resultEvent(transcript: string, isFinal: boolean) {
  return { resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } };
}

const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    FakeSR.last = null;
    w.SpeechRecognition = FakeSR;
    delete w.webkitSpeechRecognition;
  });
  afterEach(() => {
    delete w.SpeechRecognition;
    vi.restoreAllMocks();
  });

  it('reports unsupported when the API is absent', () => {
    delete w.SpeechRecognition;
    const { result } = renderHook(() => useSpeechRecognition(() => {}));
    expect(result.current.supported).toBe(false);
  });

  it('start → listening; interim shows; final fires onFinal + clears interim; stop → not listening', () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition(onFinal));
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(result.current.listening).toBe(true);

    act(() => FakeSR.last!.onresult!(resultEvent('hold on LUR187', false)));
    expect(result.current.interim).toBe('hold on LUR187');
    expect(onFinal).not.toHaveBeenCalled();

    act(() => FakeSR.last!.onresult!(resultEvent('hold on LUR187', true)));
    expect(onFinal).toHaveBeenCalledWith('hold on LUR187');
    expect(result.current.interim).toBe('');

    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
  });

  it('always reads the latest onFinal callback (no stale closure)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useSpeechRecognition(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    act(() => result.current.start());
    act(() => FakeSR.last!.onresult!(resultEvent('anything on LFJ438', true)));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('anything on LFJ438');
  });
});
