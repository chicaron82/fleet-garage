import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../../src/hooks/useSpeechSynthesis';

const speak = vi.fn();
const cancel = vi.fn();
const w = window as unknown as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };

class FakeUtterance {
  rate = 1;
  constructor(public text: string) {}
}

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    speak.mockClear();
    cancel.mockClear();
    localStorage.clear();
    w.speechSynthesis = { speak, cancel };
    w.SpeechSynthesisUtterance = FakeUtterance;
  });
  afterEach(() => {
    delete w.speechSynthesis;
    delete w.SpeechSynthesisUtterance;
    vi.restoreAllMocks();
  });

  it('reports supported when the API is present, unsupported when not', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(true);
    delete w.speechSynthesis;
    const { result: r2 } = renderHook(() => useSpeechSynthesis());
    expect(r2.current.supported).toBe(false);
  });

  it('speak cancels any current utterance then speaks the text', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak('Nothing on LUR187.'));
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    const utter = speak.mock.calls[0][0] as FakeUtterance;
    expect(utter.text).toBe('Nothing on LUR187.');
  });

  it('does not speak empty text', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak('   '));
    expect(speak).not.toHaveBeenCalled();
  });

  it('enabled persists to localStorage and turning it off cancels speech', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem('fg_assistant_voice_readback')).toBe('1');
    act(() => result.current.setEnabled(false));
    expect(localStorage.getItem('fg_assistant_voice_readback')).toBe('0');
    expect(cancel).toHaveBeenCalled();
  });

  it('reads the persisted enabled state on mount', () => {
    localStorage.setItem('fg_assistant_voice_readback', '1');
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.enabled).toBe(true);
  });
});
