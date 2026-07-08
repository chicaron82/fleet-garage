// The read-only provenance trail of Effie's inferred writes — the resolved (approved /
// rejected) rows of effie_pending_writes, newest first. The pending queue
// (usePendingWrites / PendingWritesSection) shows what's still actionable; this shows the
// HISTORY: who proposed what, from where, when, and who resolved it. recall→knowing pointed
// at the data itself. Read-only — no writes here; the provenance columns (migration 090) are
// the whole foundation, this just renders them. See docs/ticket-misc-effie-audit-surface.md.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Proposal } from '../../api/_lib/holdProposal';

export interface EffieWriteAuditRow {
  id: string;
  kind: string;
  proposal: Proposal;
  source: string;
  status: 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
  proposedBy: string;        // profiles.id — resolved to a name via useProfiles
  resolvedBy: string | null; // profiles.id — the approver/rejecter
}

export function useEffieWriteAudit(limit = 50) {
  const { user } = useAuth();
  const [rows, setRows] = useState<EffieWriteAuditRow[]>([]);

  // Not scoped to proposed_by — an audit shows the whole trail, not just your own writes
  // (RLS is allow-all, FG posture). setState only after the await.
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('effie_pending_writes')
      .select('id, kind, proposal, source, status, created_at, resolved_at, proposed_by, resolved_by')
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(limit);
    setRows((data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      proposal: r.proposal as unknown as Proposal, // jsonb round-trips to the Proposal object
      source: r.source,
      status: r.status as 'approved' | 'rejected',
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      proposedBy: r.proposed_by,
      resolvedBy: r.resolved_by,
    })));
  }, [user, limit]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  return { rows, reload };
}
