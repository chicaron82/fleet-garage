// Effie (PerZeePhone) — the floating action button + chat panel for the Fleet
// Garage shop assistant. All model/key work lives in the proxy (api/fg-chat.ts)
// + hooks; this is the surface: FAB, chat panel, proposal cards.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { useFgAssistant } from '../../hooks/useFgAssistant';
import { useEffieMemory } from '../../hooks/useEffieMemory';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useKokoroSynthesis } from '../../hooks/useKokoroSynthesis';
import { useProposalConfirm } from '../../hooks/useProposalConfirm';
import { HoldProposalCard } from './HoldProposalCard';
import { EffieSettingsPanel } from './EffieSettingsPanel';
import { moduleGreeting } from '../../lib/assistantGreeting';
import { compressImage } from '../../lib/image';
import { stripForSpeech } from '../../lib/speechText';
import { photoCaptionFor, photoButtonLabel, type PhotoContext } from '../../../api/_lib/photoRequest';
import { isAffirmation } from '../../lib/affirmation';
import {
  SparkleIcon, CloseIcon, SendIcon, CameraIcon, MicIcon, SpeakerIcon, SpeakerOffIcon, TypingDots,
} from './AssistantIcons';
import type { Screen } from '../../types';

export function FgAssistantFab({ module, onNavigate }: { module: string; onNavigate?: (screen: Screen) => void }) {
  const { user } = useAuth();
  const { addHold, addVehicle, setCoverPhoto } = useVehicleHoldContext();
  const { addLostFoundItem } = useLostFoundContext();
  const effieMemory = useEffieMemory();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [pendingPhotoContext, setPendingPhotoContext] = useState<PhotoContext | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { messages, loading, error, send, clearProposal } = useFgAssistant();
  const speech = useSpeechRecognition((t) => setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t)));
  const webTts = useSpeechSynthesis();
  const kokoro = useKokoroSynthesis();
  // Kokoro takes priority when it can actually run (needs cross-origin isolation
  // for SharedArrayBuffer). If the user turned it on but this context can't run it
  // — e.g. a deploy missing the COOP/COEP headers — fall back to Web Speech so
  // Effie still talks instead of failing silently.
  const kokoroActive = kokoro.enabled && kokoro.available;
  const kokoroFellBack = kokoro.enabled && !kokoro.available && webTts.supported;
  const ttsEnabled = kokoroActive || webTts.enabled || kokoroFellBack;
  const ttsSpeak = kokoroActive ? kokoro.speak : webTts.speak;
  const ttsCancel = kokoroActive ? kokoro.cancel : webTts.cancel;
  const ttsSupportedOrEnabled = kokoro.enabled || webTts.supported;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Seed to the RESTORED thread's tail (thread continuity restores messages at
  // mount) so a reload never re-speaks a stale answer aloud — only turns that land
  // after mount are read. Empty thread → -1, the original behavior.
  const spokenRef = useRef(messages.length - 1);

  // The login id = the part before @fleet-garage.internal in the auth email —
  // the SAME identifier the server gate checks (api/fg-chat getUser → email). Gate
  // on this, not the profile employee_id, so client + server never disagree.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoginId((data.session?.user.email ?? '').split('@')[0].toLowerCase());
    });
  }, []);

  // Keep the latest turn in view as the answer streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Read the assistant's answer aloud once it lands, if read-back is on (each turn once).
  useEffect(() => {
    if (loading) return;
    const i = messages.length - 1;
    const m = messages[i];
    if (m && m.role === 'assistant' && m.text && ttsEnabled && spokenRef.current !== i) {
      spokenRef.current = i;
      ttsSpeak(stripForSpeech(m.text)); // no "asterisk asterisk" from stray markdown
    }
  }, [messages, loading, ttsEnabled, ttsSpeak]);

  // The confirm handler → the only write path for an AI-drafted proposal (the proxy
  // never wrote). The per-kind write dispatch lives in useProposalConfirm; shared
  // instances (auth user, effie-memory store) are passed so they don't fork.
  const confirmProposal = useProposalConfirm({
    user, messages, addHold, addVehicle, setCoverPhoto, addLostFoundItem, effieMemory, onNavigate, setOpen,
  });

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

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(await compressImage(file));
    e.target.value = ''; // let the same file be picked again
  };

  const submit = () => {
    const text = draft.trim();
    if ((!text && !image) || loading) return;
    // Typed-confirmation fallback: if Effie's last turn drafted a proposal and the user
    // types a bare "confirm/yes" (no photo), execute it — same as tapping the card. On
    // success the card is cleared; on failure it's left so the operator can retry by tap.
    const lastIdx = messages.length - 1;
    const pending = messages[lastIdx]?.role === 'assistant' ? messages[lastIdx].proposal : null;
    if (pending && !image && isAffirmation(text)) {
      setDraft('');
      void confirmProposal(pending).then(() => clearProposal(lastIdx)).catch(() => { /* keep card for tap-retry */ });
      return;
    }
    speech.stop();
    ttsCancel();
    const img = image ?? undefined;
    // A typed caption always wins. A photo attached via a contextual upload button gets
    // its context caption ("Here's a photo of the key tag."); a plain photo goes
    // captionless (empty → image-only bubble, neutral text to the API).
    const caption = text || (img && pendingPhotoContext ? photoCaptionFor(pendingPhotoContext) : '');
    setDraft('');
    setImage(null);
    setPendingPhotoContext(null);
    void send(caption, module, img);
  };

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
              {ttsSupportedOrEnabled && (
                <button
                  onClick={() => kokoro.enabled ? kokoro.setEnabled(false) : webTts.setEnabled(!webTts.enabled)}
                  aria-label={ttsEnabled ? 'Turn off read-back' : 'Read answers aloud'}
                  title={ttsEnabled ? 'Read-back on' : 'Read-back off'}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition cursor-pointer ${
                    ttsEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {ttsEnabled ? <SpeakerIcon /> : <SpeakerOffIcon />}
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
              kokoro={kokoro}
              memories={effieMemory.memories}
              onForget={effieMemory.remove}
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* Kokoro download progress — visible while the model is loading */}
          {kokoro.modelState === 'loading' && (
            <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-blue-500">Downloading Effie's voice…</span>
                {kokoro.downloadProgress !== null && (
                  <span className="text-[11px] tabular-nums text-blue-500">{kokoro.downloadProgress}%</span>
                )}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${kokoro.downloadProgress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                  {moduleGreeting(module, (user?.name ?? '').split(' ')[0])}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-sm text-white'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }
                  >
                    {m.image && (
                      <img src={m.image} alt="Attached damage photo" className="mb-1.5 max-h-40 rounded-lg object-cover" />
                    )}
                    {/* Strip markdown for DISPLAY too (not just TTS) — the prompt asks
                        Effie to write plain, but she sometimes slips **bold**; this is the
                        deterministic guarantee that the bubble never shows literal asterisks. */}
                    {stripForSpeech(m.text) || (loading && i === messages.length - 1 ? <TypingDots /> : '')}
                  </div>
                </div>
                {m.role === 'assistant' && m.proposal && (
                  <HoldProposalCard
                    proposal={m.proposal}
                    onConfirm={(extra) => confirmProposal(m.proposal!, extra)}
                    onDismiss={() => clearProposal(i)}
                  />
                )}
                {m.role === 'assistant' && m.photoRequest && i === messages.length - 1 && !image && (
                  <button
                    onClick={() => { setPendingPhotoContext(m.photoRequest!); fileRef.current?.click(); }}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 cursor-pointer"
                  >
                    <CameraIcon />
                    {photoButtonLabel(m.photoRequest)}
                  </button>
                )}
              </div>
            ))}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
            {image && (
              <div className="mb-2 flex items-center gap-2">
                <img src={image} alt="Attached" className="h-12 w-12 rounded-lg border border-gray-200 object-cover dark:border-gray-700" />
                <button
                  onClick={() => setImage(null)}
                  className="text-xs text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  Remove photo
                </button>
              </div>
            )}
            {speech.listening && (
              <div className="mb-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                </span>
                <span className="truncate">{speech.interim || 'Listening…'}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              <button
                onClick={() => { setPendingPhotoContext(null); fileRef.current?.click(); }}
                aria-label="Attach a photo — camera or gallery"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer"
              >
                <CameraIcon />
              </button>
              {speech.supported && (
                <button
                  onClick={() => {
                    ttsCancel();
                    if (speech.listening) speech.stop();
                    else speech.start();
                  }}
                  aria-label={speech.listening ? 'Stop listening' : 'Speak'}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition cursor-pointer ${
                    speech.listening
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  <MicIcon />
                </button>
              )}
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="Ask, speak, or attach a photo…"
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={submit}
                disabled={(!draft.trim() && !image) || loading}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
