import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// Client side of the key-tag read. POSTs a key-tag photo to /api/keytag-read (which holds
// the API key) and reads back the structured fields (KeytagRead). READ-ONLY — nothing is
// written; the preview of what it read is the product. Mirrors useScheduleImport.
type ReadStatus = 'idle' | 'reading' | 'done' | 'error';

export function useKeytagRead() {
  const [status, setStatus] = useState<ReadStatus>('idle');
  const [read, setRead] = useState<KeytagRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readKeytag = useCallback(async (image: string) => {
    setStatus('reading');
    setError(null);
    setRead(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/keytag-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      });
      const data = (await res.json().catch(() => null)) as { read?: KeytagRead; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || `Read failed (${res.status})`);
      setRead(data?.read ?? {});
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the key tag.');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setRead(null);
    setError(null);
  }, []);

  return { status, read, error, readKeytag, reset };
}
