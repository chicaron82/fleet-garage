// Kokoro-82M TTS running fully in the browser via ONNX Runtime Web (WASM).
// The model downloads once (~82 MB at q8) and is cached by the browser.
// A module-level singleton avoids re-loading across hook re-mounts. Progress
// is tracked via a subscriber pattern so the hook can surface % to the UI.
import { useCallback, useEffect, useState } from 'react';

export type KokoroVoice = 'af_sky' | 'af_nicole';

export const KOKORO_VOICES: { id: KokoroVoice; label: string }[] = [
  { id: 'af_sky', label: 'Sky (default)' },
  { id: 'af_nicole', label: 'Nicole (alternate)' },
];

const VOICE_KEY = 'fg_effie_voice';
const ENABLED_KEY = 'fg_effie_kokoro_enabled';

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

// Module-level singletons — shared across hook mounts.
// AudioContext is pre-warmed during the user gesture that enables Kokoro, so
// subsequent speak() calls (which arrive asynchronously) aren't blocked by the
// browser's autoplay policy.
let _audioCtx: AudioContext | null = null;
// The current Web Audio source, so a new utterance (or cancel) can stop it.
let _source: AudioBufferSourceNode | null = null;
// Utterance sequence: each speak() takes the next id; only that id's audio is
// played, so a superseded or cancelled utterance's late audio is dropped.
let _seq = 0;
let _current = 0;

// Synthesis runs OFF the main thread in a worker (kokoroWorker.ts) — that's the
// freeze fix. The main thread only inits the worker, sends text, and plays back the
// audio it returns.
let _worker: Worker | null = null;

// Download progress + model ready/error, surfaced to the hook via subscribers.
let _moduleProgress: number | null = null;
const _progressSubs = new Set<() => void>();
const _stateSubs = new Set<(s: 'ready' | 'error') => void>();
function _notifyProgress() { _progressSubs.forEach((cb) => cb()); }
function _notifyState(s: 'ready' | 'error') { _stateSubs.forEach((cb) => cb(s)); }

// Play the worker's synthesized audio on the main thread (cheap — the heavy
// synthesis already happened in the worker). Ignores audio from a superseded utterance.
function _playAudio(id: number, audio: Float32Array, sampleRate: number) {
  if (id !== _current) return;
  const ctx = _audioCtx;
  if (!ctx) return;
  _source?.stop();
  const buffer = ctx.createBuffer(1, audio.length, sampleRate);
  buffer.getChannelData(0).set(audio);
  const src = ctx.createBufferSource();
  _source = src;
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.onended = () => { if (_source === src) _source = null; };
  src.start();
}

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('./kokoroWorker.ts', import.meta.url), { type: 'module' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _worker.onmessage = (e: MessageEvent<any>) => {
      const m = e.data;
      if (m.type === 'progress') { _moduleProgress = m.progress; _notifyProgress(); }
      else if (m.type === 'ready') { _moduleProgress = null; _notifyProgress(); _notifyState('ready'); }
      else if (m.type === 'error') { _notifyState('error'); }
      else if (m.type === 'audio') { _playAudio(m.id, m.audio, m.sampling_rate); }
    };
  }
  return _worker;
}

export interface KokoroSynthesisApi {
  enabled: boolean;
  /** True only in a cross-origin-isolated context (SharedArrayBuffer present).
   *  When false, Kokoro can't run — the caller should fall back to Web Speech. */
  available: boolean;
  /** Whether the page is cross-origin isolated. When false, `available` is false
   *  too — but it's the FIXABLE kind (a fresh reload usually restores it, e.g.
   *  after a service-worker update served a header-less page), as opposed to a
   *  browser that genuinely lacks SharedArrayBuffer. Surfaced so the UI can tell
   *  "reload to fix" apart from "not supported here". */
  isolated: boolean;
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
  const [isolated] = useState(() => typeof window !== 'undefined' && window.crossOriginIsolated === true);
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

  // Load the model in the worker when enabled, and reflect its ready/error state.
  useEffect(() => {
    if (!enabled || !available) return;
    const onState = (s: 'ready' | 'error') => setModelPhase(s);
    _stateSubs.add(onState);
    if (modelPhase === 'unloaded') getWorker().postMessage({ type: 'init' });
    return () => { _stateSubs.delete(onState); };
  }, [enabled, available, modelPhase]);

  // Warm the AudioContext on the first user gesture when Kokoro is enabled. The
  // enable toggle normally does this, but on a fresh load where Kokoro was
  // already enabled (from localStorage) that gesture never fires — so _audioCtx
  // stays null and speak() silently no-ops (`if (!ctx) return`) until the user
  // toggles off/on. The autoplay policy needs a gesture to start/resume an
  // AudioContext, so we do it on the first pointer/key event instead of a
  // mandatory toggle. This is the "voice engine ready but silent, fixed by
  // toggling" bug — it recurred after every deploy because a reload re-nulls the
  // module singleton.
  useEffect(() => {
    if (!enabled || !available) return;
    if (_audioCtx && _audioCtx.state === 'running') return;
    const warm = () => {
      if (!_audioCtx) _audioCtx = new AudioContext();
      void _audioCtx.resume();
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
    };
    window.addEventListener('pointerdown', warm);
    window.addEventListener('keydown', warm);
    return () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
    };
  }, [enabled, available]);

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
      _current = ++_seq; // invalidate any in-flight audio
      _source?.stop();
      _source = null;
    }
  }, []);

  const setVoice = useCallback((v: KokoroVoice) => {
    setVoiceState(v);
    try { localStorage.setItem(VOICE_KEY, v); } catch { /* private mode */ }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !available || !text.trim()) return;
      // Claim this utterance's id, interrupt any current playback, and hand the text
      // to the worker. Synthesis happens off the main thread; _playAudio plays the
      // reply (and ignores it if a newer speak/cancel has since bumped _current).
      _current = ++_seq;
      _source?.stop();
      _source = null;
      getWorker().postMessage({ type: 'generate', id: _current, text: text.trim(), voice });
    },
    [enabled, available, voice],
  );

  const cancel = useCallback(() => {
    _current = ++_seq; // drop any audio still in flight from the worker
    _source?.stop();
    _source = null;
  }, []);

  return { enabled, available, isolated, setEnabled, voice, setVoice, modelState, downloadProgress, speak, cancel };
}
