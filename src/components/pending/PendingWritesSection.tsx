// The pending-writes review queue — Effie's STAGED proposals ("Later" on the confirm
// card = log-and-go). Each is rendered with the SAME HoldProposalCard the chat uses, so
// here Confirm = APPROVE (runs the real write via useProposalConfirm, exactly as a card
// tap would) and Cancel = REJECT (discard the staged draft). Out of the FAB, on My Shift:
// the place you clear when you have a minute. Self-hides when empty.
// See migrations/090 + docs/ticket-misc-effie-pending-writes.md.
import { useRef, useState } from 'react';
import { usePendingWrites } from '../../hooks/usePendingWrites';
import { useProposalConfirm } from '../../hooks/useProposalConfirm';
import { HoldProposalCard } from '../assistant/HoldProposalCard';
import { RejectReasonPicker } from './RejectReasonPicker';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { useEffieMemory } from '../../hooks/useEffieMemory';

export function PendingWritesSection() {
  const { pending, markResolved } = usePendingWrites();
  const { user } = useAuth();
  const { addHold, addVehicle, updateVehicleFields, setCoverPhoto } = useVehicleHoldContext();
  const { addLostFoundItem } = useLostFoundContext();
  const effieMemory = useEffieMemory();
  const [collapsed, setCollapsed] = useState(false);

  // Idempotency guards for approve. An approval is TWO writes with no transaction
  // spanning them — the REAL write (confirmProposal) then the queue bookkeeping
  // (markResolved). If the real write lands but markResolved fails, the row stays
  // `pending` and re-appears on the next reload; tapping Confirm again must NOT run
  // the real write a second time (a double-registered car). Refs, not state, so a
  // fast double-tap is caught synchronously — before any re-render sees the change.
  const inFlightRef = useRef<Set<string>>(new Set()); // an approve currently running
  const writtenRef = useRef<Set<string>>(new Set());  // real write already landed this session
  // Which row is mid-reject — its card swaps to the reason picker (the correction-loop
  // signal) until a reason is picked or the reject is skipped/cancelled.
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // The exact write dispatch the confirm card uses. Photos come from the staged row
  // (passed as photosOverride on approve, below), not from any chat context. setOpen is
  // a no-op (no panel to close).
  const confirmProposal = useProposalConfirm({
    user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, addLostFoundItem,
    effieMemory, setOpen: () => {},
  });

  if (pending.length === 0) return null;
  const open = !collapsed;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/20 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-orange-800 dark:text-orange-300">Pending — Effie</span>
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {pending.length}
          </span>
        </div>
        <span className="text-xs text-orange-400 dark:text-orange-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-orange-200 dark:border-orange-800/40 p-3 space-y-3">
          {pending.map(pw => (
            rejectingId === pw.id ? (
              <RejectReasonPicker
                key={pw.id}
                onPick={(reasonId) => { void markResolved(pw.id, 'rejected', reasonId); setRejectingId(null); }}
                onCancel={() => setRejectingId(null)}
              />
            ) : (
              <HoldProposalCard
                key={pw.id}
                proposal={pw.proposal}
                onConfirm={async (extra) => {
                  if (inFlightRef.current.has(pw.id)) return; // no re-entrant double-tap
                  inFlightRef.current.add(pw.id);
                  try {
                    // Skip the real write if a prior attempt already landed it (only its
                    // markResolved failed) — retry ONLY the bookkeeping so we never write twice.
                    if (!writtenRef.current.has(pw.id)) {
                      await confirmProposal(pw.proposal, extra, pw.photos ?? []); // the real write, with any staged damage photos
                      writtenRef.current.add(pw.id);
                    }
                    await markResolved(pw.id, 'approved');       // then record the outcome
                  } finally {
                    inFlightRef.current.delete(pw.id);
                  }
                }}
                onDismiss={() => setRejectingId(pw.id)}
                dismissLabel="Reject"
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
