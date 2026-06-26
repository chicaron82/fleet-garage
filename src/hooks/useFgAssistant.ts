// Client side of the "Hey FG" assistant. Holds the visible conversation, gets
// the signed-in crew member's Supabase access token, POSTs the turns to the
// /api/fg-chat proxy (which holds the API key), and streams the reply text back
// into the last assistant bubble as it arrives. The token goes in the header so
// the proxy's reads are RLS-scoped to this user — see api/fg-chat.ts.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
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

      // Append the user turn + an empty assistant bubble we'll stream into.
      const history: ChatMessage[] = [...messages, { role: 'user', text }];
      setMessages([...history, { role: 'assistant', text: '' }]);
      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('not-authenticated');

        const res = await fetch('/api/fg-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.text })),
          }),
        });
        if (!res.ok) {
          // Surface the proxy's own message ("Assistant is not configured", etc.)
          // instead of a generic shrug — the difference between debuggable and blind.
          const detail = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(detail?.error || `Request failed (${res.status})`);
        }
        if (!res.body) throw new Error('No response from the assistant.');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => withLastAssistant(prev, acc));
        }
        if (!acc.trim()) setMessages((prev) => withLastAssistant(prev, '(no answer)'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong — try again.');
        setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, send, reset };
}

/** Replace the trailing assistant bubble's text (the one we're streaming into). */
function withLastAssistant(prev: ChatMessage[], text: string): ChatMessage[] {
  if (prev.length === 0) return prev;
  const next = [...prev];
  next[next.length - 1] = { role: 'assistant', text };
  return next;
}
