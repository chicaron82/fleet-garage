// The pending-writes review queue — Effie's STAGED proposals ("Later" on the confirm
// card = log-and-go). Each is rendered with the SAME HoldProposalCard the chat uses, so
// here Confirm = APPROVE (runs the real write via useProposalConfirm, exactly as a card
// tap would) and Cancel = REJECT (discard the staged draft). Out of the FAB, on My Shift:
// the place you clear when you have a minute. Self-hides when empty.
// See migrations/090 + docs/ticket-misc-effie-pending-writes.md.
import { useCallback, useRef, useState } from 'react';
import { usePendingWrites, type PendingWrite } from '../../hooks/usePendingWrites';
import { useProposalConfirm } from '../../hooks/useProposalConfirm';
import { HoldProposalCard } from '../assistant/HoldProposalCard';
import { RejectReasonPicker } from './RejectReasonPicker';
import { isFastTrackSafe } from '../../lib/fastTrackSafe';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { useEffieMemory } from '../../hooks/useEffieMemory';
import type { RegisterAssetChoice } from '../../../api/_lib/holdProposal';

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

  // The single guarded approve — used by a card tap AND the "Approve all safe" bulk pass, so
  // the fast-track path reuses the EXACT same idempotency guards (no second write surface).
  const approve = useCallback(async (pw: PendingWrite, extra?: RegisterAssetChoice) => {
    if (inFlightRef.current.has(pw.id)) return; // no re-entrant double-tap
    inFlightRef.current.add(pw.id);
    try {
      // Skip the real write if a prior attempt already landed it (only its markResolved
      // failed) — retry ONLY the bookkeeping so we never write twice.
      if (!writtenRef.current.has(pw.id)) {
        await confirmProposal(pw.proposal, extra, pw.photos ?? []); // the real write, with any staged damage photos
        writtenRef.current.add(pw.id);
      }
      await markResolved(pw.id, 'approved'); // then record the outcome
    } finally {
      inFlightRef.current.delete(pw.id);
    }
  }, [confirmProposal, markResolved]);

  // Graduated autonomy, level 1: fast-track the "safe set" (backfills) in one bulk pass.
  const [bulkRunning, setBulkRunning] = useState(false);
  const approveAllSafe = useCallback(async (rows: PendingWrite[]) => {
    if (bulkRunning) return;
    setBulkRunning(true);
    try { for (const pw of rows) await approve(pw); } // sequential — reuses each row's guards
    finally { setBulkRunning(false); }
  }, [bulkRunning, approve]);

  if (pending.length === 0) return null;
  const open = !collapsed;
  const safeRows = pending.filter(pw => isFastTrackSafe(pw.proposal));

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
          {/* Fast-track: bulk-clear the safe set (backfills) in one tap; risky ones stay individual. */}
          {safeRows.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/60 dark:bg-gray-900/40 px-3 py-2">
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {safeRows.length} safe to fast-track <span className="text-gray-400 dark:text-gray-500">(backfills)</span>
              </span>
              <button
                type="button"
                disabled={bulkRunning}
                onClick={() => void approveAllSafe(safeRows)}
                className="rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 text-xs font-bold text-white transition cursor-pointer"
              >
                {bulkRunning ? 'Approving…' : `⚡ Approve all safe (${safeRows.length})`}
              </button>
            </div>
          )}

          {pending.map(pw => (
            rejectingId === pw.id ? (
              <RejectReasonPicker
                key={pw.id}
                onPick={(reasonId) => { void markResolved(pw.id, 'rejected', reasonId); setRejectingId(null); }}
                onCancel={() => setRejectingId(null)}
              />
            ) : (
              <div key={pw.id}>
                {isFastTrackSafe(pw.proposal) && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">✓ Safe to fast-track</p>
                )}
                {pw.wouldAutoClear === true && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400" title="The auto-clear gate would fire this once live (L2 shadow mode — nothing fires yet)">⚡ Would auto-clear (shadow)</p>
                )}
                <HoldProposalCard
                  proposal={pw.proposal}
                  onConfirm={(extra) => approve(pw, extra)}
                  onDismiss={() => setRejectingId(pw.id)}
                  dismissLabel="Reject"
                />
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
