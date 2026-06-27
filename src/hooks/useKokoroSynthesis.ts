// Kokoro-82M TTS running fully in the browser via ONNX Runtime Web (WASM).
// The model downloads once (~82 MB at q8) and is cached by the browser.
// A module-level singleton avoids re-loading the model across hook re-mounts.
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

// Module-level promise — load Kokoro once and share across all hook instances.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ttsPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTTS(): Promise<any> {
  if (!_ttsPromise) {
    _ttsPromise = import('kokoro-js').then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm' }),
    );
  }
  return _ttsPromise;
}

export interface KokoroSynthesisApi {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  voice: KokoroVoice;
  setVoice: (v: KokoroVoice) => void;
  modelState: 'idle' | 'loading' | 'ready' | 'error';
  speak: (text: string) => void;
  cancel: () => void;
}

export function useKokoroSynthesis(): KokoroSynthesisApi {
  const [enabled, setEnabledState] = useState(readEnabled);
  const [voice, setVoiceState] = useState<KokoroVoice>(readVoice);
  // 'unloaded' | 'ready' | 'error' — the actual resolved phase.
  // modelState is derived: when enabled + unloaded, we're implicitly 'loading'.
  const [modelPhase, setModelPhase] = useState<'unloaded' | 'ready' | 'error'>('unloaded');
  const modelState: 'idle' | 'loading' | 'ready' | 'error' =
    !enabled ? 'idle' :
    modelPhase === 'ready' ? 'ready' :
    modelPhase === 'error' ? 'error' : 'loading';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Kick off model load when enabled for the first time. All setState calls
  // happen inside async callbacks — never synchronously in the effect body.
  useEffect(() => {
    if (!enabled || modelPhase !== 'unloaded') return;
    let alive = true;
    getTTS()
      .then(() => { if (alive) setModelPhase('ready'); })
      .catch(() => {
        _ttsPromise = null; // allow retry on next enable
        if (alive) setModelPhase('error');
      });
    return () => { alive = false; };
  }, [enabled, modelPhase]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (!on) {
      audioRef.current?.pause();
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    } else {
      // Reset phase so the effect retries if the user re-enables after an error.
      setModelPhase((p) => p === 'error' ? 'unloaded' : p);
    }
  }, []);

  const setVoice = useCallback((v: KokoroVoice) => {
    setVoiceState(v);
    try { localStorage.setItem(VOICE_KEY, v); } catch { /* private mode */ }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return;
      // Cancel any in-flight utterance before starting a new one.
      audioRef.current?.pause();
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }

      getTTS().then((tts) => {
        return tts.generate(text.trim(), { voice }).then((audio: { toWav: () => Uint8Array }) => {
          // Cast via ArrayBuffer to satisfy strict Blob typing (Uint8Array<ArrayBufferLike>
          // vs ArrayBuffer — runtime is identical, only the generic differs).
          const wav = audio.toWav() as Uint8Array;
          const blob = new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          const el = new Audio(url);
          audioRef.current = el;
          el.onended = () => { URL.revokeObjectURL(url); blobUrlRef.current = null; };
          void el.play();
        });
      }).catch(() => { /* model not ready or network error — stay silent */ });
    },
    [enabled, voice],
  );

  const cancel = useCallback(() => {
    audioRef.current?.pause();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
  }, []);

  return { enabled, setEnabled, voice, setVoice, modelState, speak, cancel };
}
