// Client access to Effie's durable per-operator memory (#2): the operator's saved
// facts, scoped to their profile. `add` is the confirm-tap write path (FgAssistantFab);
// `memories` + `remove` power the settings-panel management surface — the "curate,
// don't accumulate" + "wrong memory is worse than none" guards. The server injects
// these into Effie's context each turn (see api/fg-chat.ts).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { useAuth } from '../context/AuthContext';

export interface EffieMemory {
  id: string;
  content: string;
  createdAt: string;
}

export function useEffieMemory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<EffieMemory[]>([]);

  // Only setState after the await (async) — never synchronously in the effect body,
  // which would trip react-hooks/set-state-in-effect.
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('effie_memory')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMemories((data ?? []).map((r) => ({ id: r.id, content: r.content, createdAt: r.created_at })));
  }, [user]);

  // Load-on-mount / on user change — the fetch setStates after its await; the rule
  // still flags the call, so suppress it exactly like ActiveSessionsContext.refresh.
  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  const add = useCallback(async (content: string): Promise<boolean> => {
    if (!user) return false;
    // Idempotent: an exact duplicate (case/whitespace-insensitive) is a success,
    // not a second row — both copies would otherwise inject into Effie's context.
    const norm = content.trim().toLowerCase();
    if (memories.some((m) => m.content.trim().toLowerCase() === norm)) return true;
    // Submit-locked on the content: the state-based dedup above can't see a
    // same-frame double-tap (memories only updates next render). A dropped
    // re-entrant call reports success — the first call is inserting it.
    const ok = await withSubmitLock(`effie-mem:${user.id}:${norm}`, async () => {
      const { error } = await supabase.from('effie_memory').insert({ user_id: user.id, content });
      if (!error) await reload();
      return !error;
    });
    return ok ?? true;
  }, [user, memories, reload]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('effie_memory').delete().eq('id', id);
    if (!error) await reload();
    return !error;
  }, [reload]);

  return { memories, add, remove, reload };
}
