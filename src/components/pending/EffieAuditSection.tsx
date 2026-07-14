// Effie's write history — the read-only provenance trail (resolved rows of
// effie_pending_writes). Sits below the pending queue on My Shift: the queue is what's
// still actionable, this is the record of what's been approved/rejected — who proposed it,
// from where, when, and who resolved it. Collapsed by default (secondary to the queue),
// self-hides when empty. Read-only; no writes. See docs/ticket-misc-effie-audit-surface.md.
import { useState } from 'react';
import { useEffieWriteAudit, type EffieWriteAuditRow } from '../../hooks/useEffieWriteAudit';
import { useProfiles } from '../../context/ProfilesContext';
import type { Proposal } from '../../../api/_lib/holdProposal';

const KIND_LABELS: Record<string, string> = {
  register_vehicle: 'Register',
  register_and_hold: 'Register + hold',
  hold: 'Hold',
  update_vehicle: 'Backfill',
  update_and_hold: 'Backfill + hold',
  lost_item: 'Lost & found',
  memory: 'Memory',
  reminder: 'Reminder',
  overflow_log: 'Sends',
};

/** Best-effort one-line target for the row (the plate, or a lost-item description). */
function targetLabel(p: Proposal): string {
  if (p.kind === 'register_vehicle' || p.kind === 'register_and_hold') return p.newVehicle.plate;
  if (p.kind === 'hold') return p.vehicle.plate;
  if (p.kind === 'update_vehicle' || p.kind === 'update_and_hold') return p.plate;
  if (p.kind === 'lost_item') return p.licensePlate ?? p.description.slice(0, 28);
  return '';
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EffieAuditSection() {
  const { rows } = useEffieWriteAudit();
  const profiles = useProfiles();
  const [collapsed, setCollapsed] = useState(true); // history is secondary to the active queue

  if (rows.length === 0) return null;
  const open = !collapsed;
  const name = (id: string | null) => (id ? profiles.get(id)?.name ?? '—' : '—');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Effie — write history</span>
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gray-400 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {rows.length}
          </span>
        </div>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(r => (
            <AuditRow key={r.id} row={r} proposer={name(r.proposedBy)} resolver={name(r.resolvedBy)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({ row, proposer, resolver }: { row: EffieWriteAuditRow; proposer: string; resolver: string }) {
  const approved = row.status === 'approved';
  const target = targetLabel(row.proposal);
  const kindLabel = KIND_LABELS[row.kind] ?? row.kind;
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            approved
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {approved ? 'APPROVED' : 'REJECTED'}
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
            {kindLabel}{target ? ` · ${target}` : ''}
          </span>
        </div>
        <span className="text-[11px] text-gray-400 shrink-0">{fmtTime(row.resolvedAt ?? row.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        proposed by {proposer} · via {row.source} · {approved ? 'approved' : 'rejected'} by {resolver}
      </p>
    </div>
  );
}
