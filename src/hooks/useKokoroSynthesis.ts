// Kokoro-82M TTS running fully in the browser via ONNX Runtime Web (WASM).
// The model downloads once (~82 MB at q8) and is cached by the browser.
// A module-level singleton avoids re-loading across hook re-mounts. Progress
// is tracked via a subscriber pattern so the hook can surface % to the UI.
import { useCallback, useEffect, useRef, useState } from 'react';

export type KokoroVoice = 'af_sky' | 'af_nicole';

export const KOKORO_VOICES: { id: KokoroVoice; label: string }[] = [
  { id: 'af_sky', label: 'Sky (default)' },
  { id: 'af_nicole', label: 'Nicole (alternate)' },
];

const VOICE_KEY = 'fg_effie_voice';
const ENABLED_KEY = 'fg_effie_kokoro_enabled';
const MODEL_ID = 'onnx-community/Kokoro-82M-ONNX';

function readVoice(): KokoroVoice {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    if (v === 'af_sky' || v === 'af_nicole') return v;
  } catch { /* private mode */ }
  return 'af_sky';
}

function readEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}

// Kokoro runs onnxruntime-web's threaded WASM, which needs SharedArrayBuffer —
// available only in a cross-origin-isolated context (COOP + COEP headers). Where
// that's absent (e.g. a deploy missing the headers), the model can't run, so
// callers should fall back to Web Speech instead of attempting a doomed load
// that fails silently.
function kokoroAvailable(): boolean {
  return typeof window !== 'undefined'
    && window.crossOriginIsolated === true
    && typeof SharedArrayBuffer !== 'undefined';
}

// Module-level singletons.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ttsPromise: Promise<any> | null = null;
// AudioContext is pre-warmed during the user gesture that enables Kokoro,
// so subsequent speak() calls (which arrive asynchronously) aren't blocked
// by the browser's autoplay policy.
let _audioCtx: AudioContext | null = null;

// Download progress tracking — subscriber pattern so the hook can reflect it.
let _moduleProgress: number | null = null;
const _progressSubs = new Set<() => void>();
const _fileTotals: Record<string, number> = {};
const _fileLoaded: Record<string, number> = {};

function _notifySubs() { _progressSubs.forEach((cb) => cb()); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _onProgress(p: Record<string, any>) {
  if (p.status === 'initiate' && p.file) {
    if (typeof p.total === 'number' && p.total > 0) _fileTotals[p.file] = p.total;
    _fileLoaded[p.file] = 0;
  } else if (p.status === 'progress' && p.file) {
    if (typeof p.loaded === 'number') _fileLoaded[p.file] = p.loaded;
    if (typeof p.total === 'number' && p.total > 0) _fileTotals[p.file] = p.total;
    const tot = Object.values(_fileTotals).reduce((a, b) => a + b, 0);
    const lod = Object.values(_fileLoaded).reduce((a, b) => a + b, 0);
    _moduleProgress = tot > 0 ? Math.round((lod / tot) * 100) : Math.round(p.progress ?? 0);
    _notifySubs();
  } else if (p.status === 'ready') {
    _moduleProgress = null;
    _notifySubs();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTTS(): Promise<any> {
  if (!_ttsPromise) {
    _ttsPromise = import('kokoro-js').then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: _onProgress,
      }),
    );
  }
  return _ttsPromise;
}

export interface KokoroSynthesisApi {
  enabled: boolean;
  /** True only in a cross-origin-isolated context (SharedArrayBuffer present).
   *  When false, Kokoro can't run — the caller should fall back to Web Speech. */
  available: boolean;
  setEnabled: (on: boolean) => void;
  voice: KokoroVoice;
  setVoice: (v: KokoroVoice) => void;
  modelState: 'idle' | 'loading' | 'ready' | 'error';
  /** 0–100 while downloading the model, null otherwise. */
  downloadProgress: number | null;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useKokoroSynthesis(): KokoroSynthesisApi {
  const [enabled, setEnabledState] = useState(readEnabled);
  const [available] = useState(kokoroAvailable);
  const [voice, setVoiceState] = useState<KokoroVoice>(readVoice);
  const [modelPhase, setModelPhase] = useState<'unloaded' | 'ready' | 'error'>('unloaded');
  const modelState: 'idle' | 'loading' | 'ready' | 'error' =
    !enabled ? 'idle' :
    !available ? 'error' :
    modelPhase === 'ready' ? 'ready' :
    modelPhase === 'error' ? 'error' : 'loading';

  const [downloadProgress, setDownloadProgress] = useState<number | null>(_moduleProgress);
  useEffect(() => {
    const update = () => setDownloadProgress(_moduleProgress);
    _progressSubs.add(update);
    return () => { _progressSubs.delete(update); };
  }, []);

  // Web Audio source node for the current utterance — used for cancel().
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!enabled || !available || modelPhase !== 'unloaded') return;
    let alive = true;
    getTTS()
      .then(() => { if (alive) setModelPhase('ready'); })
      .catch(() => {
        _ttsPromise = null;
        if (alive) setModelPhase('error');
      });
    return () => { alive = false; };
  }, [enabled, available, modelPhase]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (on) {
      // Pre-warm the AudioContext during this user gesture so that async speak()
      // calls later aren't blocked by the browser's autoplay policy.
      if (!_audioCtx) _audioCtx = new AudioContext();
      void _audioCtx.resume();
      setModelPhase((p) => p === 'error' ? 'unloaded' : p);
    } else {
      sourceRef.current?.stop();
      sourceRef.current = null;
    }
  }, []);

  const setVoice = useCallback((v: KokoroVoice) => {
    setVoiceState(v);
    try { localStorage.setItem(VOICE_KEY, v); } catch { /* private mode */ }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !available || !text.trim()) return;
      sourceRef.current?.stop();
      sourceRef.current = null;

      // generate() returns { audio: Float32Array, sampling_rate: number }
      // Play via Web Audio API — bypasses HTMLAudioElement autoplay restrictions
      // since the AudioContext was pre-warmed during the enable gesture.
      getTTS().then((tts) =>
        tts.generate(text.trim(), { voice }).then(
          (result: { audio: Float32Array; sampling_rate: number }) => {
            const ctx = _audioCtx;
            if (!ctx) return;
            const buffer = ctx.createBuffer(1, result.audio.length, result.sampling_rate);
            buffer.getChannelData(0).set(result.audio);
            const source = ctx.createBufferSource();
            sourceRef.current = source;
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.onended = () => { sourceRef.current = null; };
            source.start();
          },
        )
      ).catch(() => { /* model error — stay silent */ });
    },
    [enabled, available, voice],
  );

  const cancel = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }, []);

  return { enabled, available, setEnabled, voice, setVoice, modelState, downloadProgress, speak, cancel };
}
