import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dismissKeyFor } from '../lib/openingQuickStart';

/**
 * The two facts the "Start opening duties" card needs beyond the roster: has he already logged the
 * duties today, and has he dismissed the card today. See lib/openingQuickStart for why those are
 * two separate exits rather than one.
 *
 * ⚠️ Starts as `logged: true` — i.e. HIDDEN — and reveals the card only once the query comes back
 * empty. The opposite default would flash a "Start opening duties" card on every load for a man who
 * finished them at 07:00, and a control that appears and then vanishes reads as a glitch. Erring
 * toward silence is also the safer half: a briefly-missing card costs one tap in the off-standard
 * tab; a briefly-present one invites a duplicate entry.
 */
export function useOpeningQuickStart(userId: string | undefined, todayISO: string) {
  const [logged, setLogged] = useState(true);
  // ⭐ DERIVED, NOT MIRRORED. Storing a boolean and re-syncing it in an effect would be state that
  // can drift from the day it describes (and eslint's set-state-in-effect rightly refused it). What
  // is stored instead is WHICH DAY was dismissed; `dismissed` is then a comparison, so an app left
  // open across midnight re-offers the card on its own with no rollover logic to get wrong.
  //
  // localStorage can throw outright (private windows, blocked site data), so every touch is guarded
  // and a failure simply means "not dismissed" — the card stays, which is the harmless direction.
  const [dismissedDay, setDismissedDay] = useState<string | null>(() => {
    try { return localStorage.getItem(dismissKeyFor(todayISO)) === '1' ? todayISO : null; }
    catch { return null; }
  });
  const dismissed = dismissedDay === todayISO;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('off_standard_entries')
        .select('id')
        .eq('user_id', userId!)
        .eq('date', todayISO)
        .eq('preset_reason', 'opening_duties')
        .limit(1);
      if (cancelled) return;
      // ⚠️ On an ERROR, stay hidden. An unreadable answer is not a "no" — treating a failed query
      // as "not logged" would surface the card during any blip and invite a second entry.
      setLogged(error ? true : (data ?? []).length > 0);
    }
    void load();
    return () => { cancelled = true; };
  }, [userId, todayISO]);

  const dismiss = useCallback(() => {
    setDismissedDay(todayISO);
    try { localStorage.setItem(dismissKeyFor(todayISO), '1'); } catch { /* session-only is fine */ }
  }, [todayISO]);

  return { logged, dismissed, dismiss };
}
