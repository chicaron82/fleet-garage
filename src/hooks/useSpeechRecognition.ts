import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Minimal hand-typed surface of the Web Speech API (SpeechRecognition) — it isn't in
// lib.dom, and we'd rather not add @types/dom-speech-recognition for the few fields we
// touch. Chrome/Safari expose it prefixed as `webkitSpeechRecognition`.
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SRResultList {
  length: number;
  [i: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechRecognitionApi {
  supported: boolean;
  listening: boolean;
  interim: string; // the live, not-yet-final partial transcript (for display)
  start: () => void;
  stop: () => void;
}

/**
 * Thin React wrapper over the Web Speech API for voice input. `onFinal` fires with each
 * finalized transcript chunk; `interim` is the live partial for display. Browser-only —
 * `supported` is false where the API is absent, so the caller can hide the mic. The
 * recognizer is built once and torn down on unmount; `onFinal` is read through a ref so
 * a changing callback doesn't rebuild it.
 */
export function useSpeechRecognition(onFinal: (text: string) => void): SpeechRecognitionApi {
  const Ctor = useMemo(() => getCtor(), []);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let final = '';
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) final += text;
        else partial += text;
      }
      setInterim(partial);
      if (final.trim()) {
        onFinalRef.current(final.trim());
        setInterim('');
      }
    };
    rec.onerror = () => {
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    };
  }, [Ctor]);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    try {
      recRef.current.start();
      setListening(true);
    } catch {
      /* start() throws if already running — ignore */
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  return { supported: Ctor !== null, listening, interim, start, stop };
}
