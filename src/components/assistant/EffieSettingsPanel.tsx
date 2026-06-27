// Effie's in-panel settings overlay: call sign + voice picker.
// Slides up from inside the chat panel; persists to localStorage.
import { useEffect, useRef, useState } from 'react';
import { KOKORO_VOICES, type KokoroSynthesisApi, type KokoroVoice } from '../../hooks/useKokoroSynthesis';

const CALLSIGN_KEY = 'fg_effie_callsign';

interface Props {
  kokoro: KokoroSynthesisApi;
  onClose: () => void;
}

export function EffieSettingsPanel({ kokoro, onClose }: Props) {
  const [draft, setDraft] = useState<string>(() => {
    try { return localStorage.getItem(CALLSIGN_KEY) ?? ''; } catch { return ''; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const save = () => {
    const val = draft.trim();
    try {
      if (val) localStorage.setItem(CALLSIGN_KEY, val);
      else localStorage.removeItem(CALLSIGN_KEY);
    } catch { /* private mode */ }
    onClose();
  };

  const modelLabel = kokoro.modelState === 'loading' ? ' (downloading…)' :
    kokoro.modelState === 'error' ? ' (load failed — retry)' : '';

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-white dark:bg-gray-900 p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Effie settings</p>
        <button onClick={onClose} className="text-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">×</button>
      </div>

      {/* Call sign */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Call sign</label>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="Your name or title (e.g. Boss)"
          className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="text-[11px] text-gray-400">Effie will address you by this instead of your profile name.</p>
      </div>

      {/* Voice */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Effie's voice{modelLabel}
        </label>
        <div className="flex flex-col gap-1.5">
          {/* Toggle row */}
          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {kokoro.enabled ? 'Kokoro (on-device)' : 'Browser TTS (default)'}
            </span>
            <button
              onClick={() => {
                if (kokoro.modelState === 'error') {
                  // reset so the useEffect retries
                  kokoro.setEnabled(false);
                  setTimeout(() => kokoro.setEnabled(true), 0);
                } else {
                  kokoro.setEnabled(!kokoro.enabled);
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${kokoro.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${kokoro.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {/* Voice picker (only when Kokoro is on) */}
          {kokoro.enabled && (
            <div className="flex gap-2 pl-1">
              {KOKORO_VOICES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => kokoro.setVoice(id as KokoroVoice)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    kokoro.voice === id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {kokoro.enabled && kokoro.modelState === 'loading' && (
          <p className="text-[11px] text-blue-500 animate-pulse">Downloading Kokoro model (~82 MB) — cached after first load.</p>
        )}
        {kokoro.enabled && kokoro.modelState === 'error' && (
          <p className="text-[11px] text-red-500">Model failed to load. Toggle off and on to retry.</p>
        )}
      </div>

      <button
        onClick={save}
        className="mt-auto w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 cursor-pointer"
      >
        Save
      </button>
    </div>
  );
}
