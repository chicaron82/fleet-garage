// Client access to Effie's pending-writes queue (see migrations/090 +
// docs/ticket-misc-effie-pending-writes.md). `stage` persists an inferred proposal for
// later ("Later" on the confirm card = log-and-go); `pending` + `markResolved` power the
// review queue (PendingWritesSection). The REAL write for an approval runs in the caller
// via useProposalConfirm (the same dispatch as the confirm-card tap) — this hook only
// stages the draft and records the outcome. Write-type-agnostic: it stores/returns the
// full serialized Proposal by kind, never special-casing one.
import { useCallback, useEffect, useState } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { useAuth } from '../context/AuthContext';
import type { Proposal } from '../../api/_lib/holdProposal';
import type { Json } from '../types/database.types';

/** Insert a staged-write row, falling back to the offline queue on a dead signal so a stage
 *  captured on a no-service corner isn't lost (it syncs on reconnect — see flushOfflineQueue).
 *  Returns whether it landed (online) or was queued (offline) — both count as "staged" — plus
 *  which, so the caller only reconciles against the server on a real online write. The payload
 *  MUST carry a client `id`: the drain upserts on it to dedup a lost-ack retry. */
export async function insertOrEnqueueStage(payload: Record<string, unknown>): Promise<{ ok: boolean; queued: boolean }> {
  const enqueue = () => ({ ok: enqueueOfflineAction({ table: 'effie_pending_writes', action: 'insert', payload }) !== null, queued: true });
  if (!navigator.onLine) return enqueue();
  const { error } = await writeWithRefresh(() => supabase.from('effie_pending_writes').insert(payload as never));
  if (!error) return { ok: true, queued: false };
  const isNetworkErr = !navigator.onLine || error.message?.includes('Fetch') || !error.code;
  return isNetworkErr ? enqueue() : { ok: false, queued: false };
}

export interface PendingWrite {
  id: string;
  kind: string;
  proposal: Proposal;
  source: string;
  createdAt: string;
  /** Damage photos (base64 data URLs) captured when a hold was staged, so they survive
   *  stage→approve. Undefined for staged writes with no attached photos. */
  photos?: string[];
}

export function usePendingWrites() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingWrite[]>([]);

  // setState only after the await (never synchronously in the effect body) — matches
  // useEffieMemory / ActiveSessionsContext.
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('effie_pending_writes')
      .select('id, kind, proposal, source, created_at, photos')
      .eq('proposed_by', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPending((data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      proposal: r.proposal as unknown as Proposal, // jsonb round-trips to the Proposal object
      source: r.source,
      createdAt: r.created_at,
      photos: (r.photos as string[] | null) ?? undefined,
    })));
  }, [user]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  /** Persist an inferred proposal for later review. Nothing is written to the real
   *  tables here — that only happens on approve (via useProposalConfirm). */
  const stage = useCallback(async (proposal: Proposal, source = 'effie-chat', photos?: string[]): Promise<boolean> => {
    if (!user) return false;
    // Client-generated id: lets the write survive an offline enqueue (the drain upserts on id).
    const id = crypto.randomUUID();
    const photoList = photos && photos.length > 0 ? photos : null;
    // Proposal is a typed union, not structural Json — cast at the jsonb boundary.
    const payload = { id, proposed_by: user.id, kind: proposal.kind, proposal: proposal as unknown as Json, source, photos: photoList };
    // Optimistic: show it in the queue immediately — log-and-go works even offline.
    const optimistic: PendingWrite = { id, kind: proposal.kind, proposal, source, createdAt: new Date().toISOString(), photos: photoList ?? undefined };
    setPending(prev => [optimistic, ...prev]);
    const { ok, queued } = await insertOrEnqueueStage(payload);
    if (!ok) { setPending(prev => prev.filter(p => p.id !== id)); return false; } // real failure → roll back
    if (!queued) await reload(); // online write → reconcile with server truth (idempotent: same id)
    return true;
  }, [user, reload]);

  /** Record a staged write's outcome. For an approval the caller runs the REAL write
   *  (useProposalConfirm) BEFORE calling this; for a rejection it's called alone. */
  const markResolved = useCallback(async (id: string, status: 'approved' | 'rejected'): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('effie_pending_writes')
      .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await reload();
    return !error;
  }, [user, reload]);

  return { pending, stage, markResolved, reload };
}
