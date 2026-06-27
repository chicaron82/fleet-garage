import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';

// Client side of the schedule-photo import (Phase 1). POSTs the photo to the
// /api/fg-schedule-parse endpoint (which holds the API key) and reads back a typed
// ParsedSchedule. READ-ONLY — nothing is written here; the preview is the product.
type ImportStatus = 'idle' | 'parsing' | 'done' | 'error';

export function useScheduleImport() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [schedule, setSchedule] = useState<ParsedSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (image: string) => {
    setStatus('parsing');
    setError(null);
    setSchedule(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/fg-schedule-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      });
      const data = (await res.json().catch(() => null)) as { schedule?: ParsedSchedule; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || `Parse failed (${res.status})`);
      setSchedule(data?.schedule ?? { staff: [] });
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the schedule.');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setSchedule(null);
    setError(null);
  }, []);

  return { status, schedule, error, parse, reset };
}
