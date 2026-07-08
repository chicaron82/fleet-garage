// Effie's home — the full-screen module (docs/ticket-misc-effie-module.md, pass 2b). Renders
// the SAME shared conversation as the FAB (EffieConversation, backed by EffieContext), so the
// live thread flows between them; the FAB vanishes while this tab is open. Distinct-but-still-FG
// surface: her blue/sparkle identity, a soft tinted backdrop, and a warm home welcome — vs the
// operational grids of My Shift / Fleet. Aaron owns the aesthetic; this is the first pass.
//
// NOTE (follow-up): the read-back toggle + settings gear + kokoro progress are duplicated from
// the FAB shell. Both surfaces are permanent, so extracting a shared <EffieChrome> is the tidy
// next step — deferred so pass 2b stays focused.
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEffie } from '../../context/EffieContext';
import { EffieConversation } from './EffieConversation';
import { EffieSettingsPanel } from './EffieSettingsPanel';
import { SparkleIcon, SpeakerIcon, SpeakerOffIcon } from './AssistantIcons';
import type { Screen } from '../../types';

export function EffieModule({ onNavigate }: { onNavigate?: (screen: Screen) => void }) {
  const { user } = useAuth();
  const { tts, memory } = useEffie();
  const [showSettings, setShowSettings] = useState(false);

  const firstName = (user?.name ?? '').split(' ')[0];
  const greeting = firstName
    ? `Hey ${firstName} — welcome to my corner. Ask me anything, snap a key tag, log a find, check on a car… I'm all yours.`
    : 'Welcome to my corner. Ask me anything, snap a key tag, log a find, check on a car… I\'m all yours.';

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-blue-50/70 to-white dark:from-blue-950/20 dark:to-gray-950">
      {/* Header — Effie's identity */}
      <div className="flex items-center justify-between gap-2 border-b border-blue-100/70 bg-white/70 px-4 py-3 backdrop-blur dark:border-blue-900/30 dark:bg-gray-900/60">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <SparkleIcon small />
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Effie</p>
            <p className="text-[11px] text-blue-500 dark:text-blue-400">Your lot concierge · home base</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {tts.supportedOrEnabled && (
            <button
              onClick={() => tts.kokoro.enabled ? tts.kokoro.setEnabled(false) : tts.webTts.setEnabled(!tts.webTts.enabled)}
              aria-label={tts.enabled ? 'Turn off read-back' : 'Read answers aloud'}
              title={tts.enabled ? 'Read-back on' : 'Read-back off'}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer ${
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-base"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Kokoro download progress — visible while the model is loading */}
      {tts.kokoro.modelState === 'loading' && (
        <div className="border-b border-blue-100/70 px-4 py-2 dark:border-blue-900/30">
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

      {showSettings && (
        <EffieSettingsPanel
          kokoro={tts.kokoro}
          memories={memory.memories}
          onForget={memory.remove}
          onClose={() => setShowSettings(false)}
        />
      )}

      <EffieConversation module="effie" onNavigate={onNavigate} emptyGreeting={greeting} />
    </div>
  );
}
