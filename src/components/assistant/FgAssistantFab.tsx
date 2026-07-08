// Effie (PerZeePhone) — the floating action button + chat panel SHELL. The conversation
// itself (transcript + composer + confirm path) lives in EffieConversation, and all its
// state (thread, voice, draft) in EffieContext — shared with Effie's full-screen module
// (docs/ticket-misc-effie-module.md). This file owns only the FAB affordance: the
// button, the corner panel chrome (header / read-back toggle / settings), and the
// client-side allowlist gate.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEffie } from '../../context/EffieContext';
import { EffieConversation } from './EffieConversation';
import { EffieSettingsPanel } from './EffieSettingsPanel';
import { SparkleIcon, CloseIcon, SpeakerIcon, SpeakerOffIcon, ExpandIcon } from './AssistantIcons';
import type { Screen } from '../../types';

export function FgAssistantFab({ module, onNavigate }: { module: string; onNavigate?: (screen: Screen) => void }) {
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { tts, memory } = useEffie();

  // The login id = the part before @fleet-garage.internal in the auth email —
  // the SAME identifier the server gate checks (api/fg-chat getUser → email). Gate
  // on this, not the profile employee_id, so client + server never disagree.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoginId((data.session?.user.email ?? '').split('@')[0].toLowerCase());
    });
  }, []);

  // Only show the FAB to allowlisted accounts (the assistant runs on a personal
  // API key). Mirrors the server's isAllowed gate in api/_lib/assistantAccess —
  // empty/unset allowlist = open to all. The server still enforces regardless;
  // this just hides a button that would 403. Guard sits after all hooks.
  const allowIds = ((import.meta.env.VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS as string | undefined) ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowed = allowIds.length === 0 || (loginId !== null && allowIds.includes(loginId));
  if (!allowed) return null;
  // On Effie's own home tab the FAB is redundant clutter — the full module owns the
  // conversation there. Hide it; the shared thread lives on regardless (EffieContext).
  if (module === 'effie') return null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask Effie"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition cursor-pointer"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400"><SparkleIcon small /></span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Effie</p>
                <p className="text-[11px] text-gray-400">Your lot concierge — ask anything.</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onNavigate && (
                <button
                  onClick={() => { setOpen(false); onNavigate({ name: 'effie' }); }}
                  aria-label="Open Effie's full screen"
                  title="Expand to Effie's home"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  <ExpandIcon />
                </button>
              )}
              {tts.supportedOrEnabled && (
                <button
                  onClick={() => tts.kokoro.enabled ? tts.kokoro.setEnabled(false) : tts.webTts.setEnabled(!tts.webTts.enabled)}
                  aria-label={tts.enabled ? 'Turn off read-back' : 'Read answers aloud'}
                  title={tts.enabled ? 'Read-back on' : 'Read-back off'}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition cursor-pointer ${
                    tts.enabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {tts.enabled ? <SpeakerIcon /> : <SpeakerOffIcon />}
                </button>
              )}
              <button
                onClick={() => setShowSettings((s) => !s)}
                aria-label="Effie settings"
                title="Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-base"
              >
                ⚙️
              </button>
            </div>
          </div>

          {showSettings && (
            <EffieSettingsPanel
              kokoro={tts.kokoro}
              memories={memory.memories}
              onForget={memory.remove}
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* Kokoro download progress — visible while the model is loading */}
          {tts.kokoro.modelState === 'loading' && (
            <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-blue-500">Downloading Effie's voice…</span>
                {tts.kokoro.downloadProgress !== null && (
                  <span className="text-[11px] tabular-nums text-blue-500">{tts.kokoro.downloadProgress}%</span>
                )}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${tts.kokoro.downloadProgress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          <EffieConversation module={module} onNavigate={onNavigate} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
