/// <reference lib="webworker" />
// Kokoro-82M TTS synthesis, OFF the main thread. KokoroTTS.generate() runs a
// CPU-heavy WASM inference; on the main thread it froze the whole UI until a long
// reply finished synthesizing (the app was unresponsive, then unblocked the instant
// playback started — confirmed live 2026-07-05). Here the model load + generate run
// in a dedicated worker; the main thread only receives the finished audio and plays
// it. The worker inherits the page's cross-origin isolation, so SharedArrayBuffer
// (which onnxruntime-web's threaded WASM needs) is still available.
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

type KokoroVoice = 'af_sky' | 'af_nicole';
const MODEL_ID = 'onnx-community/Kokoro-82M-ONNX';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
const fileTotals: Record<string, number> = {};
const fileLoaded: Record<string, number> = {};

// Aggregate the model-download progress across files → a single 0–100 percent,
// posted to the main thread so the UI can show the loading bar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onProgress(p: Record<string, any>) {
  if (p.status !== 'progress' || !p.file) return;
  if (typeof p.loaded === 'number') fileLoaded[p.file] = p.loaded;
  if (typeof p.total === 'number' && p.total > 0) fileTotals[p.file] = p.total;
  const tot = Object.values(fileTotals).reduce((a, b) => a + b, 0);
  const lod = Object.values(fileLoaded).reduce((a, b) => a + b, 0);
  const progress = tot > 0 ? Math.round((lod / tot) * 100) : Math.round(p.progress ?? 0);
  ctx.postMessage({ type: 'progress', progress });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTTS(): Promise<any> {
  if (!ttsPromise) {
    ttsPromise = import('kokoro-js').then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback: onProgress }),
    );
  }
  return ttsPromise;
}

type InMsg =
  | { type: 'init' }
  | { type: 'generate'; id: number; text: string; voice: KokoroVoice };

ctx.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try { await getTTS(); ctx.postMessage({ type: 'ready' }); }
    catch (err) { ttsPromise = null; ctx.postMessage({ type: 'error', message: String(err) }); }
    return;
  }
  if (msg.type === 'generate') {
    try {
      const tts = await getTTS();
      const result: { audio: Float32Array; sampling_rate: number } = await tts.generate(msg.text, { voice: msg.voice });
      // Transfer the audio buffer (zero-copy) back to the main thread for playback.
      ctx.postMessage({ type: 'audio', id: msg.id, audio: result.audio, sampling_rate: result.sampling_rate }, [result.audio.buffer]);
    } catch (err) {
      ctx.postMessage({ type: 'error', id: msg.id, message: String(err) });
    }
  }
};
