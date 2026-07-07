// The pending-writes review queue — Effie's STAGED proposals ("Later" on the confirm
// card = log-and-go). Each is rendered with the SAME HoldProposalCard the chat uses, so
// here Confirm = APPROVE (runs the real write via useProposalConfirm, exactly as a card
// tap would) and Cancel = REJECT (discard the staged draft). Out of the FAB, on My Shift:
// the place you clear when you have a minute. Self-hides when empty.
// See migrations/090 + docs/ticket-misc-effie-pending-writes.md.
import { useState } from 'react';
import { usePendingWrites } from '../../hooks/usePendingWrites';
import { useProposalConfirm } from '../../hooks/useProposalConfirm';
import { HoldProposalCard } from '../assistant/HoldProposalCard';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { useEffieMemory } from '../../hooks/useEffieMemory';

export function PendingWritesSection() {
  const { pending, markResolved } = usePendingWrites();
  const { user } = useAuth();
  const { addHold, addVehicle, setCoverPhoto } = useVehicleHoldContext();
  const { addLostFoundItem } = useLostFoundContext();
  const effieMemory = useEffieMemory();
  const [collapsed, setCollapsed] = useState(false);

  // The exact write dispatch the confirm card uses. No chat photos in the queue
  // (messages: []), so photo-bearing holds are out of scope for staging — register/log
  // are the proven path (the ticket's deferral). setOpen is a no-op (no panel to close).
  const confirmProposal = useProposalConfirm({
    user, messages: [], addHold, addVehicle, setCoverPhoto, addLostFoundItem,
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
            <HoldProposalCard
              key={pw.id}
              proposal={pw.proposal}
              onConfirm={async (extra) => {
                await confirmProposal(pw.proposal, extra); // the real write
                await markResolved(pw.id, 'approved');     // then record the outcome
              }}
              onDismiss={() => void markResolved(pw.id, 'rejected')}
              dismissLabel="Reject"
            />
          ))}
        </div>
      )}
    </div>
  );
}
