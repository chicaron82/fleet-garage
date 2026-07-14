import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DamageRead } from '../../api/_lib/damageRead';

// Client side of the damage read. POSTs a damage photo to /api/damage-read (which holds the
// API key) and reads back a one-line damage description (DamageRead). READ-ONLY — nothing is
// written; the draft description is the product, edited by the operator before it seeds a
// staged hold. Mirrors useKeytagRead.
type ReadStatus = 'idle' | 'reading' | 'done' | 'error';

export function useDamageRead() {
  const [status, setStatus] = useState<ReadStatus>('idle');
  const [read, setRead] = useState<DamageRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readDamage = useCallback(async (image: string): Promise<DamageRead | null> => {
    setStatus('reading');
    setError(null);
    setRead(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/damage-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      });
      const data = (await res.json().catch(() => null)) as { read?: DamageRead; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || `Read failed (${res.status})`);
      const read = data?.read ?? {};
      setRead(read);
      setStatus('done');
      return read; // returned so a caller can chain without waiting on state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the damage photo.');
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setRead(null);
    setError(null);
  }, []);

  return { status, read, error, readDamage, reset };
}
