import { useCallback, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// Client side of the key-tag read. POSTs a key-tag photo to /api/keytag-read (which holds
// the API key) and reads back the structured fields (KeytagRead). READ-ONLY — nothing is
// written; the preview of what it read is the product. Mirrors useScheduleImport.
type ReadStatus = 'idle' | 'reading' | 'done' | 'error';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Never let a raw error body reach the UI. A message that looks like JSON (or is suspiciously
// long) is an upstream dump, not something to show Aaron mid-shift — replace it with a plain line.
// Short, human server messages ("Not signed in.", the busy line) pass through untouched.
const friendlyError = (m: string): string =>
  !m || m.includes('{') || m.includes('"') || m.length > 120 ? 'Could not read the tag — try again.' : m;

export function useKeytagRead() {
  const [status, setStatus] = useState<ReadStatus>('idle');
  const [read, setRead] = useState<KeytagRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ⚠️ A REF ALONGSIDE THE STATE, and it is not redundant. Callers read the message inside the same
  // async handler that awaited readKeytag — a closure created BEFORE setError ran — so the state
  // they see is always the stale one (empty). The overlay's `error ?? 'Could not read that key tag'`
  // therefore showed the generic fallback for EVERY failure, including "the scanner is busy right
  // now, try again in a moment", which is transient and worth retrying. He re-photographed a tag
  // that was never the problem (found at /reflect 59; the 19-hour outage surfaced it).
  const errorRef = useRef<string | null>(null);

  const readKeytag = useCallback(async (image: string): Promise<KeytagRead | null> => {
    setStatus('reading');
    errorRef.current = null;
    setError(null);
    setRead(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      // The server already retries Anthropic; this second layer catches a still-busy 503 (or a
      // network blip on the way to /api) so a transient overload self-heals without Aaron re-tapping.
      // Non-transient failures (bad photo, auth) break out immediately — retrying those is just delay.
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await fetch('/api/keytag-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image }),
        }).catch(() => null); // network failure → treat as a retryable blip
        if (res && res.ok) {
          const data = (await res.json().catch(() => null)) as { read?: KeytagRead } | null;
          const read = data?.read ?? {};
          setRead(read);
          setStatus('done');
          return read; // returned so a caller can chain (resolve/stage) without waiting on state
        }
        const data = res ? ((await res.json().catch(() => null)) as { error?: string; retryable?: boolean } | null) : null;
        const transient = !res || res.status === 503 || res.status === 529 || data?.retryable === true;
        if (transient && attempt < MAX_ATTEMPTS) {
          await sleep(600 * attempt); // 600ms, then 1200ms — brief, keeps the "Reading…" spinner honest
          continue;
        }
        throw new Error(transient
          ? 'The scanner is busy right now — try again in a moment.'
          : (data?.error || `Read failed (${res?.status ?? '?'})`));
      }
      throw new Error('The scanner is busy right now — try again in a moment.');
    } catch (e) {
      const msg = friendlyError(e instanceof Error ? e.message : 'Could not read the key tag.');
      errorRef.current = msg;
      setError(msg);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setRead(null);
    setError(null);
  }, []);

  return { status, read, error, errorRef, readKeytag, reset };
}
