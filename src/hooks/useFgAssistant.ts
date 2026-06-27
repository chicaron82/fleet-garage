// Client side of the "Hey FG" assistant. Holds the visible conversation, gets the
// signed-in crew member's Supabase access token, POSTs the turns to the /api/fg-chat
// proxy (which holds the API key), and reads back a { text, proposal } envelope. A
// proposal is a drafted hold the FAB renders as a confirm card — the proxy never
// writes; the write happens on the user's tap. Token in the header so the proxy's
// reads are RLS-scoped to this user — see api/fg-chat.ts.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HoldProposal } from '../../api/_lib/holdProposal';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** A drafted hold awaiting the user's confirm tap (assistant turns only). */
  proposal?: HoldProposal | null;
}

interface ChatEnvelope {
  text?: string;
  proposal?: HoldProposal | null;
  error?: string;
}

export function useFgAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      setError(null);

      // Append the user turn + an empty assistant bubble to fill in.
      const history: ChatMessage[] = [...messages, { role: 'user', text }];
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
  }, []);

  return { messages, loading, error, send, reset, clearProposal };
}

/** Replace the trailing assistant bubble's text + proposal. */
function withLastAssistant(prev: ChatMessage[], text: string, proposal: HoldProposal | null): ChatMessage[] {
  if (prev.length === 0) return prev;
  const next = [...prev];
  next[next.length - 1] = { role: 'assistant', text, proposal };
  return next;
}
