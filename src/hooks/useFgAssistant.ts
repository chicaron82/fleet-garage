// Client side of the Effie (PerZeePhone) assistant. Holds the visible conversation, gets the
// signed-in crew member's Supabase access token, POSTs the turns to the /api/fg-chat
// proxy (which holds the API key), and reads back a { text, proposal } envelope. A
// proposal is a drafted hold the FAB renders as a confirm card — the proxy never
// writes; the write happens on the user's tap. Token in the header so the proxy's
// reads are RLS-scoped to this user — see api/fg-chat.ts.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadThread, saveThread, clearThread } from '../lib/effieThread';
import type { Proposal } from '../../api/_lib/holdProposal';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** A drafted hold awaiting the user's confirm tap (assistant turns only). */
  proposal?: Proposal | null;
  /** A damage photo the user attached to this turn (base64 data URL, user turns). */
  image?: string;
}

interface ChatEnvelope {
  text?: string;
  proposal?: Proposal | null;
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

  // Persist the thread whenever it settles so a reload doesn't wipe the chat.
  useEffect(() => { saveThread(messages); }, [messages]);

  const send = useCallback(
    async (raw: string, module?: string, image?: string) => {
      const typed = raw.trim();
      if ((!typed && !image) || loading) return;
      // A photo can arrive with no caption — give it one so the bubble + the message
      // history both carry non-empty text (the API rejects empty user content).
      const text = typed || 'Here\'s a photo of the damage.';
      setError(null);

      // Append the user turn (with any attached photo) + an empty assistant bubble.
      const history: ChatMessage[] = [...messages, { role: 'user', text, image }];
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
            // Don't send proposals back up — only the visible text turns.
            messages: history.map((m) => ({ role: m.role, content: m.text })),
            module, // the screen the user is on, for context-aware answers
            image, // a damage photo for THIS turn only (not resent in history)
            callSign: localStorage.getItem('fg_effie_callsign') || undefined,
          }),
        });

        const data = (await res.json().catch(() => null)) as ChatEnvelope | null;
        if (!res.ok) {
          // Surface the proxy's own message ("Assistant is not configured", etc.).
          throw new Error(data?.error || `Request failed (${res.status})`);
        }
        setMessages((prev) =>
          withLastAssistant(prev, data?.text?.trim() || '(no answer)', data?.proposal ?? null),
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

  // Clear a proposal once it's been confirmed or dismissed (so the card disappears).
  const clearProposal = useCallback((index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, proposal: null } : m)));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    clearThread();
  }, []);

  return { messages, loading, error, send, reset, clearProposal };
}

/** Replace the trailing assistant bubble's text + proposal. */
function withLastAssistant(prev: ChatMessage[], text: string, proposal: Proposal | null): ChatMessage[] {
  if (prev.length === 0) return prev;
  const next = [...prev];
  next[next.length - 1] = { role: 'assistant', text, proposal };
  return next;
}
