// Client access to Effie's pending-writes queue (see migrations/090 +
// docs/ticket-misc-effie-pending-writes.md). `stage` persists an inferred proposal for
// later ("Later" on the confirm card = log-and-go); `pending` + `markResolved` power the
// review queue (PendingWritesSection). The REAL write for an approval runs in the caller
// via useProposalConfirm (the same dispatch as the confirm-card tap) — this hook only
// stages the draft and records the outcome. Write-type-agnostic: it stores/returns the
// full serialized Proposal by kind, never special-casing one.
import { useCallback, useEffect, useState } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction, getOfflineQueue } from '../lib/offlineQueue';
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
  /** Photos (base64 data URLs) carried with a staged write so they survive stage→approve.
   *  TWO uses, disambiguated by proposal kind — no collision, since a given kind only ever
   *  carries one: (a) DAMAGE photos on hold-bearing kinds (attached via addHold on approve);
   *  (b) the KEY-TAG photo on batch-staged register_vehicle/update_vehicle kinds, which have
   *  no hold — attached via attachKeytagPhotoIfMissing on approve (ticket-universal-keytag-
   *  capture Phase 3). Undefined for staged writes with no photo. */
  photos?: string[];
  /** Shadow-mode auto-clear verdict (graduated autonomy L2): true = the deterministic gate
   *  would auto-clear this backfill; false = it wouldn't; null/undefined = not evaluated.
   *  Observe-only — nothing fires. See src/lib/autoClearGate. */
  wouldAutoClear?: boolean | null;
}

/** Stages captured OFFLINE and still in the local queue (not yet synced to the DB) — so the
 *  pending list shows them even without signal. Read from the same offline queue the drain
 *  replays; a queued insert is always still `pending` by definition. Exported for testing. */
export function offlineStagedPending(userId: string): PendingWrite[] {
  return getOfflineQueue()
    .filter((a) => a.table === 'effie_pending_writes' && a.action === 'insert')
    .map((a) => a.payload as { id: string; proposed_by?: string; kind: string; proposal: unknown; source: string; photos?: string[] | null; created_at?: string; would_auto_clear?: boolean | null })
    .filter((p) => p.proposed_by === userId)
    .map((p) => ({
      id: p.id, kind: p.kind, proposal: p.proposal as Proposal, source: p.source,
      createdAt: p.created_at ?? new Date().toISOString(), photos: p.photos ?? undefined,
      wouldAutoClear: p.would_auto_clear ?? null,
    }));
}

export function usePendingWrites() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingWrite[]>([]);

  // setState only after the await (never synchronously in the effect body) — matches
  // useEffieMemory / ActiveSessionsContext.
  const reload = useCallback(async () => {
    if (!user) return;
    let dbRows: PendingWrite[] = [];
    try {
      const { data } = await supabase
        .from('effie_pending_writes')
        .select('id, kind, proposal, source, created_at, photos, would_auto_clear')
        .eq('proposed_by', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      dbRows = (data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind,
        proposal: r.proposal as unknown as Proposal, // jsonb round-trips to the Proposal object
        source: r.source,
        createdAt: r.created_at,
        photos: (r.photos as string[] | null) ?? undefined,
        wouldAutoClear: r.would_auto_clear ?? null,
      }));
    } catch { /* offline — fall back to the locally-queued stages below */ }
    // Merge stages captured offline (queued, not yet synced) so the queue shows them even
    // without signal; dedup by id against the DB rows once a sync has landed them.
    const seen = new Set(dbRows.map((r) => r.id));
    const queued = offlineStagedPending(user.id).filter((q) => !seen.has(q.id));
    setPending([...queued, ...dbRows]);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  /** Persist an inferred proposal for later review. Nothing is written to the real
   *  tables here — that only happens on approve (via useProposalConfirm). */
  const stage = useCallback(async (proposal: Proposal, source = 'effie-chat', photos?: string[], wouldAutoClear?: boolean | null): Promise<boolean> => {
    if (!user) return false;
    // Client-generated id: lets the write survive an offline enqueue (the drain upserts on id).
    const id = crypto.randomUUID();
    const photoList = photos && photos.length > 0 ? photos : null;
    // Proposal is a typed union, not structural Json — cast at the jsonb boundary. created_at
    // is client-set so an offline-queued row carries a real timestamp (matches the DB default).
    // would_auto_clear is the SHADOW verdict (L2, observe-only) — null unless a backfill producer
    // evaluated the deterministic gate. Nothing fires from it; see src/lib/autoClearGate.
    const payload = { id, proposed_by: user.id, kind: proposal.kind, proposal: proposal as unknown as Json, source, photos: photoList, created_at: new Date().toISOString(), would_auto_clear: wouldAutoClear ?? null };
    const { ok } = await insertOrEnqueueStage(payload);
    // reload merges the DB + the local offline queue, so the staged row shows whether it landed
    // online or is buffered offline — no separate optimistic path to drift.
    if (ok) await reload();
    return ok;
  }, [user, reload]);

  /** Record a staged write's outcome. For an approval the caller runs the REAL write
   *  (useProposalConfirm) BEFORE calling this; for a rejection it's called alone. A
   *  reject can carry a REASON (the correction-loop signal) — stored only on rejects. */
  const markResolved = useCallback(async (id: string, status: 'approved' | 'rejected', reason?: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('effie_pending_writes')
      .update({
        status,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        // Reason belongs only to a reject; never stamp one on an approval.
        reject_reason: status === 'rejected' ? (reason ?? null) : null,
      })
      .eq('id', id);
    if (!error) await reload();
    return !error;
  }, [user, reload]);

  return { pending, stage, markResolved, reload };
}
