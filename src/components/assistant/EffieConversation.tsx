// Effie's conversation body — the transcript + composer, shared by every surface that
// renders the chat (the FAB panel today; the full-screen module next — see
// docs/ticket-misc-effie-module.md). All conversation state lives in EffieContext (one
// thread, one voice, one draft); this component is the window onto it plus the
// surface-local bits: speech-to-text, file picking, and the proposal confirm path
// (which needs the data contexts, so it lives here below the providers, not in
// EffieProvider which mounts above them).
//
// Renders a fragment (transcript, composer) so the parent shell's flex-column layout
// applies to them directly — identical DOM shape to when they lived inside the FAB.
import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { useEffie } from '../../context/EffieContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useProposalConfirm } from '../../hooks/useProposalConfirm';
import { usePendingWritesContext } from '../../context/PendingWritesContext';
import { HoldProposalCard } from './HoldProposalCard';
import { EffieImageStrip } from './EffieImageStrip';
import { moduleGreeting } from '../../lib/assistantGreeting';
import { photosForProposalConfirm } from '../../lib/photosForProposal';
import { stripForSpeech } from '../../lib/speechText';
import { photoCaptionFor, photoButtonLabel } from '../../../api/_lib/photoRequest';
import { isAffirmation } from '../../lib/affirmation';
import { SendIcon, CameraIcon, PaperclipIcon, MicIcon, TypingDots } from './AssistantIcons';
import type { Screen } from '../../types';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { PhotoError } from '../../components/shared/PhotoError';

export function EffieConversation({ module, onNavigate, onClose, emptyGreeting }: {
  module: string;
  onNavigate?: (screen: Screen) => void;
  /** Called when a confirmed proposal wants the surface dismissed (e.g. a navigate).
   *  The FAB closes its panel; the module can pass nothing. */
  onClose?: () => void;
  /** The empty-thread greeting. Defaults to the module-context greeting (the FAB); Effie's
   *  home passes a warmer welcome. Only shown when there's no conversation yet. */
  emptyGreeting?: string;
}) {
  const { user } = useAuth();
  const { addHold, addVehicle, updateVehicleFields, setCoverPhoto } = useVehicleHoldContext();
  const { addLostFoundItem } = useLostFoundContext();
  const { messages, loading, error, send, clearProposal, markProposalDone, tts, memory, composer } = useEffie();
  const { draft, setDraft, images, setImages, pendingPhotoContext, setPendingPhotoContext } = composer;
  const speech = useSpeechRecognition((t) => setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t)));
  const scrollRef = useRef<HTMLDivElement>(null);
  const { photoError, takeMany } = usePhotoIntake();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);     // gallery / files — multi-select attach
  const cameraRef = useRef<HTMLInputElement>(null);   // live camera — one shot, direct (no chooser)
  // In-flight guard for the TYPED confirm ("yes" ↵). The card's buttons disable
  // themselves while submitting, but the typed path has no button — without this, a
  // second "yes" during the write's flight fires the proposal's write twice (the same
  // double-write class as the card-resurrection and queue-approve bugs).
  const typedConfirmInFlightRef = useRef(false);

  // Keep the latest turn in view as the answer streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Focus the input when the conversation appears (mounting = the surface opened).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The confirm handler → the only write path for an AI-drafted proposal (the proxy
  // never wrote). The per-kind write dispatch lives in useProposalConfirm; shared
  // instances (auth user, effie-memory store) are passed so they don't fork.
  const confirmProposal = useProposalConfirm({
    user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, addLostFoundItem,
    effieMemory: memory, onNavigate,
    setOpen: (open) => { if (!open) onClose?.(); },
  });
  // "Later" on a card → stage the proposal to the pending queue (reviewed on My Shift).
  const { stage: stagePendingWrite } = usePendingWritesContext();

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // let the same file(s) be picked again
    if (files.length === 0) return;
    const compressed = await takeMany(files);
    if (compressed.length) setImages((prev) => [...prev, ...compressed]); // append — a second attach adds, not replaces
  };

  const submit = () => {
    const text = draft.trim();
    if ((!text && images.length === 0) || loading) return;
    // Typed-confirmation fallback: if Effie's last turn drafted a proposal and the user
    // types a bare "confirm/yes" (no photo), execute it — same as tapping the card. On
    // success the card is cleared; on failure it's left so the operator can retry by tap.
    const lastIdx = messages.length - 1;
    const pending = messages[lastIdx]?.role === 'assistant' ? messages[lastIdx].proposal : null;
    if (pending && images.length === 0 && isAffirmation(text)) {
      if (typedConfirmInFlightRef.current || messages[lastIdx].proposalDone) return; // no double-fire
      typedConfirmInFlightRef.current = true;
      setDraft('');
      // Same kind-aware photo scope as the card tap — a typed "yes" to a register must still
      // attach the key tag the operator uploaded earlier in the conversation.
      void confirmProposal(pending, undefined, photosForProposalConfirm(pending.kind, messages, lastIdx))
        .then(() => clearProposal(lastIdx))
        .catch(() => { /* keep card for tap-retry */ })
        .finally(() => { typedConfirmInFlightRef.current = false; });
      return;
    }
    speech.stop();
    tts.cancel();
    const imgs = images.length ? images : undefined;
    // A typed caption always wins. Photos attached via a contextual upload button get
    // the context caption ("Here's a photo of the key tag."); plain photos go
    // captionless (empty → image-only bubble, neutral text to the API).
    const caption = text || (imgs && pendingPhotoContext ? photoCaptionFor(pendingPhotoContext) : '');
    setDraft('');
    setImages([]);
    setPendingPhotoContext(null);
    void send(caption, module, imgs);
  };

  return (
    <>
      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              {emptyGreeting ?? moduleGreeting(module, (user?.name ?? '').split(' ')[0])}
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
                {m.images && m.images.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {m.images.map((src, k) => (
                      <img key={k} loading="lazy" src={src} alt={`Attached photo ${k + 1}`} className="max-h-40 rounded-lg object-cover" />
                    ))}
                  </div>
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
                done={!!m.proposalDone}
                onConfirm={async (extra) => {
                  // Scope photos by the proposal's kind: a register/backfill reaches back for the
                  // key-tag photo (may be several turns back after a conversational draft); a hold
                  // keeps the tight prompting-turn scope (never sweeps up an earlier keytag photo).
                  await confirmProposal(m.proposal!, extra, photosForProposalConfirm(m.proposal!.kind, messages, i)); // throws → card shows its error state
                  markProposalDone(i); // recorded on the MESSAGE so a remount renders the receipt, not a re-confirmable card
                }}
                onDismiss={() => clearProposal(i)}
                onStage={(p) => { void stagePendingWrite(p, 'effie-chat', messages.flatMap((mm) => mm.images ?? [])); clearProposal(i); }}
              />
            )}
            {m.role === 'assistant' && m.photoRequest && i === messages.length - 1 && images.length === 0 && (
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
        <EffieImageStrip
          images={images}
          onRemove={(idx) => setImages((prev) => prev.filter((_, i) => i !== idx))}
        />
        {speech.listening && (
          <div className="mb-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            <span className="truncate">{speech.interim || 'Listening…'}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Gallery/files (multi) and live camera (direct, single) — split so each modality is one
              tap. Both feed onPickImage, which appends, so live snaps + gallery picks accumulate. */}
          <PhotoError message={photoError} />
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickImage} className="hidden" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} className="hidden" />
          <button
            onClick={() => { setPendingPhotoContext(null); cameraRef.current?.click(); }}
            aria-label="Take a live photo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer"
          >
            <CameraIcon />
          </button>
          <button
            onClick={() => { setPendingPhotoContext(null); fileRef.current?.click(); }}
            aria-label="Attach a photo from the gallery"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer"
          >
            <PaperclipIcon />
          </button>
          {speech.supported && (
            <button
              onClick={() => {
                tts.cancel();
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
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter drops a newline (standard chat composer).
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={2}
            placeholder="Ask, speak, or attach a photo…"
            className="flex-1 resize-none rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={submit}
            disabled={(!draft.trim() && images.length === 0) || loading}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );
}
