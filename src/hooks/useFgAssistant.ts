// Client side of the Effie (PerZeePhone) assistant. Holds the visible conversation, gets the
// signed-in crew member's Supabase access token, POSTs the turns to the /api/fg-chat
// proxy (which holds the API key), and reads back a { text, proposal } envelope. A
// proposal is a drafted hold the FAB renders as a confirm card — the proxy never
// writes; the write happens on the user's tap. Token in the header so the proxy's
// reads are RLS-scoped to this user — see api/fg-chat.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadThread, loadThreadStamped, saveThread, clearThread, shouldAdoptThread, type StampedThread } from '../lib/effieThread';
import { loadServerThreadStamped, saveServerThread } from '../lib/effieThreadSync';
import type { Proposal } from '../../api/_lib/holdProposal';
import type { PhotoContext } from '../../api/_lib/photoRequest';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** A drafted hold awaiting the user's confirm tap (assistant turns only). */
  proposal?: Proposal | null;
  /** True once the proposal's write EXECUTED (tap-confirm success). Lives on the message —
   *  not just in the card's local state — so a remounted card (panel closed/reopened)
   *  renders its receipt instead of resurrecting a confirmable card for a write that
   *  already ran (the duplicate-registration gun). */
  proposalDone?: boolean;
  /** A photo the assistant is asking for — renders an inline upload button (assistant turns). */
  photoRequest?: PhotoContext | null;
  /** Photos the user attached to this turn (base64 data URLs, user turns). One or
   *  many — a batch of keytags or several damage angles read together. */
  images?: string[];
}

interface ChatEnvelope {
  text?: string;
  proposal?: Proposal | null;
  photoRequest?: PhotoContext | null;
  error?: string;
}

export function useFgAssistant() {
  // Restore the visible thread from the last session (thread continuity) — text
  // turns only; proposals + photos are never persisted (see lib/effieThread).
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => (loadThread() ?? []).map((m) => ({ role: m.role, text: m.text })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live-sync (docs/ticket-effie-thread-live-sync.md). The server thread is the shared source of
  // truth; localStorage is the instant/offline cache. The whole choreography reduces to ONE rule —
  // adopt an incoming thread only if its `at` is newer than the one on screen (threadAtRef) — which
  // covers mount hydration, focus re-hydrate, realtime push, AND self-echo (`==` is not `>`) with a
  // single comparison. hydratedRef gates the initial server SAVE (so the mount local-paint can't
  // overwrite a newer server thread before we've read it); skipSaveRef keeps an ADOPTED/restored
  // thread from being re-stamped + re-saved (which would echo-loop); loadingRef blocks adopting
  // mid-Effie-turn.
  const hydratedRef = useRef(false);
  const threadAtRef = useRef<number>(loadThreadStamped()?.at ?? 0);
  const loadingRef = useRef(false);
  const skipSaveRef = useRef(true); // the mount-restore render is already persisted — don't re-stamp it

  useEffect(() => { loadingRef.current = loading; }, [loading]);

  const adoptIfNewer = useCallback((incoming: StampedThread | null) => {
    if (!incoming || !shouldAdoptThread(incoming.at, threadAtRef.current, loadingRef.current)) return;
    threadAtRef.current = incoming.at;
    saveThread(incoming.messages, incoming.at); // keep the local cache in lockstep, same `at`
    skipSaveRef.current = true;                 // the resulting messages-effect must NOT re-save/re-stamp
    setMessages(incoming.messages.map((m) => ({ role: m.role, text: m.text })));
  }, []);

  // Mount hydration — adopt the server thread if it's newer than the local cache.
  useEffect(() => {
    let cancelled = false;
    void loadServerThreadStamped().then((server) => {
      if (cancelled) return;
      adoptIfNewer(server);
      hydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, [adoptIfNewer]);

  // Layer A — re-pull on focus/visibility so returning to a device makes it current without a reload.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadServerThreadStamped().then(adoptIfNewer); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [adoptIfNewer]);

  // Persist whenever the thread settles from a USER turn: localStorage always (instant + offline),
  // server after hydration — sharing ONE `at` with threadAtRef. Adopted/restored threads skip this
  // (skipSaveRef), so an incoming update never boomerangs back out as a fresh save.
  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    const at = Date.now();
    saveThread(messages, at);
    threadAtRef.current = at;
    if (hydratedRef.current) void saveServerThread(messages, at);
  }, [messages]);

  const send = useCallback(
    async (raw: string, module?: string, images?: string[]) => {
      const typed = raw.trim();
      const imgs = images ?? [];
      if ((!typed && imgs.length === 0) || loading) return;
      // The caller passes the caption in `raw` — a context caption ("Here's a photo of
      // the key tag."), typed text, or empty for a plain photo. Keep the bubble text as
      // given (empty → image-only bubble); the API can't take empty content, so the
      // request payload substitutes a neutral placeholder below.
      const text = typed;
      setError(null);

      // Append the user turn (with any attached photos) + an empty assistant bubble.
      const history: ChatMessage[] = [...messages, { role: 'user', text, images: imgs.length ? imgs : undefined }];
      setMessages([...history, { role: 'assistant', text: '' }]);
      setLoading(true);

      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error('not-authenticated');

        const res = await fetch('/api/fg-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            // Don't send proposals back up — only the visible text turns. A photo-only
            // turn has empty text; the API rejects empty content, so send a neutral
            // placeholder (the actual image rides in `image`).
            messages: history.map((m) => ({ role: m.role, content: m.text.trim() || 'Here\'s a photo.' })),
            module, // the screen the user is on, for context-aware answers
            images: imgs, // photos for THIS turn only (not resent in history)
            callSign: localStorage.getItem('fg_effie_callsign') || undefined,
          }),
        });

        const data = (await res.json().catch(() => null)) as ChatEnvelope | null;
        if (!res.ok) {
          // Surface the proxy's own message ("Assistant is not configured", etc.).
          throw new Error(data?.error || `Request failed (${res.status})`);
        }
        setMessages((prev) =>
          withLastAssistant(prev, data?.text?.trim() || '(no answer)', data?.proposal ?? null, data?.photoRequest ?? null),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong — try again.');
        setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  // Clear a proposal once it's been dismissed/staged/typed-confirmed (the card disappears).
  const clearProposal = useCallback((index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, proposal: null } : m)));
  }, []);

  // Record that a proposal's write executed (tap-confirm success). Keeps the proposal on
  // the message — the receipt renders from it — but flags it done so a remount can't offer
  // the confirm again.
  const markProposalDone = useCallback((index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, proposalDone: true } : m)));
  }, []);

  const reset = useCallback(() => {
    threadAtRef.current = Date.now(); // the clear is the newest action — a stale server thread must not re-adopt
    setMessages([]);
    setError(null);
    clearThread();
    void saveServerThread([]); // clearing the chat on one device clears it everywhere
  }, []);

  return { messages, loading, error, send, reset, clearProposal, markProposalDone };
}

/** Replace the trailing assistant bubble's text + proposal. */
function withLastAssistant(
  prev: ChatMessage[],
  text: string,
  proposal: Proposal | null,
  photoRequest: PhotoContext | null,
): ChatMessage[] {
  if (prev.length === 0) return prev;
  const next = [...prev];
  next[next.length - 1] = { role: 'assistant', text, proposal, photoRequest };
  return next;
}
