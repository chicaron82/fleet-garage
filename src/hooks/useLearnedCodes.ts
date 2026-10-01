import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { forgetLearnedClass, forgetTaughtModel } from '../context/learnedCodeWrite';
import type { LearnedClassRow, TaughtModelRow } from '../lib/modelCodeAudit';

// The two tables FG's model-code knowledge lives in, loaded for the Fleet page's audit list.
// I/O only — every rule about what is suspicious is in lib/modelCodeAudit, where it is tested.
//
// ⚠️ `error` is its own state, never an empty list. An audit that shows "nothing learned" because the
// read failed would be the silent-swallow bug (lookup, 2026-09-29) wearing an all-clear.

export interface LearnedCodes {
  learned: LearnedClassRow[];
  taught: TaughtModelRow[];
  loading: boolean;
  error: boolean;
  reload: () => void;
  /** Both throw when nothing was removed — the caller runs them through useWriteGuard. */
  forgetClass: (code: string) => Promise<void>;
  forgetModel: (code: string) => Promise<void>;
}

/** `enabled` keeps the two reads off the wire until the card is actually opened. */
export function useLearnedCodes(enabled: boolean): LearnedCodes {
  const [learned, setLearned] = useState<LearnedClassRow[]>([]);
  const [taught, setTaught] = useState<TaughtModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = async () => {
      setLoading(true);
      const [cls, mdl] = await Promise.all([
        supabase.from('class_code_rental_class').select('code, rental_class, pinned_at'),
        supabase.from('vehicle_class_codex').select('code, make, model'),
      ]);
      if (!live) return;
      if (cls.error || mdl.error || !cls.data || !mdl.data) { setError(true); setLoading(false); return; }
      setLearned(cls.data.map(r => ({
        code: String(r.code), rentalClass: String(r.rental_class ?? ''), pinned: r.pinned_at != null,
      })));
      setTaught(mdl.data.map(r => ({ code: String(r.code), make: String(r.make ?? ''), model: String(r.model ?? '') })));
      setError(false);
      setLoading(false);
    };
    void load().catch(() => { if (live) { setError(true); setLoading(false); } });
    return () => { live = false; };
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  const forgetClass = useCallback(async (code: string) => {
    await forgetLearnedClass(code);
    setLearned(prev => prev.filter(r => r.code.trim().toUpperCase() !== code.trim().toUpperCase()));
  }, []);

  const forgetModel = useCallback(async (code: string) => {
    await forgetTaughtModel(code);
    setTaught(prev => prev.filter(r => r.code.trim().toUpperCase() !== code.trim().toUpperCase()));
  }, []);

  return { learned, taught, loading, error, reload, forgetClass, forgetModel };
}
