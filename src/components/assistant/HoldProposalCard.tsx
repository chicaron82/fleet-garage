// The confirm card for a drafted proposal — a hold, a register+hold, a lost & found
// log, or a memory to remember. The AI proposed it (the proxy wrote nothing); only
// the Confirm tap here calls the real mutation via onConfirm. Owns its own
// submit/done/error state so the card becomes a receipt ("✓ Hold opened" / "✓
// Logged" / "✓ Saved") once it lands — the single write path for an AI-suggested action.
import { useState } from 'react';
import { describeNewVehicle, type Proposal } from '../../../api/_lib/holdProposal';
import { lostItemLocationLabel } from '../../../api/_lib/lostItemProposal';

interface Props {
  proposal: Proposal;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export function HoldProposalCard({ proposal, onConfirm, onDismiss }: Props) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const confirm = async () => {
    setStatus('submitting');
    try {
      await onConfirm();
      setStatus('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not complete that.');
      setStatus('error');
    }
  };

  // Navigate offer — confirming just changes screens (no write), so it has no submit/
  // receipt state: the tap navigates and closes the panel, unmounting this card.
  if (proposal.kind === 'navigate') {
    return (
      <div className="rounded-xl border border-blue-300/60 bg-blue-50 px-3 py-2.5 dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">Open screen</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.label}</p>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            Not now
          </button>
          <button
            onClick={() => void onConfirm()}
            className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
          >
            Take me there →
          </button>
        </div>
      </div>
    );
  }

  // Lost & found log — its own shape (no vehicle/holdType), so render it before the
  // hold-centric path below. Shares the submit/done/error machinery above.
  if (proposal.kind === 'lost_item') {
    if (status === 'done') {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
          <CheckIcon />
          <span>Logged to lost &amp; found.</span>
        </div>
      );
    }
    const meta = [
      proposal.location ? lostItemLocationLabel(proposal.location) : null,
      proposal.licensePlate ? `Plate ${proposal.licensePlate}` : null,
    ].filter(Boolean);
    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Confirm — log found item
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.description}</p>
        {meta.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{meta.join(' · ')}</p>}
        {proposal.notes && <p className="text-sm text-gray-600 dark:text-gray-300">{proposal.notes}</p>}
        {status === 'error' && <p className="mt-1 text-xs text-red-500">{errMsg}</p>}
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={onDismiss}
            disabled={status === 'submitting'}
            className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={status === 'submitting'}
            className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
          >
            {status === 'submitting' ? 'Working…' : status === 'error' ? 'Retry' : 'Log item'}
          </button>
        </div>
      </div>
    );
  }

  // Memory — Effie's own "remember this about you" (#2). Blue, not amber: it's a
  // personal note, not an ops write. Shares the submit/done/error machinery above.
  if (proposal.kind === 'memory') {
    if (status === 'done') {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
          <CheckIcon />
          <span>Saved — I&apos;ll remember that.</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-blue-300/60 bg-blue-50 px-3 py-2.5 dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">Remember this?</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.content}</p>
        {status === 'error' && <p className="mt-1 text-xs text-red-500">{errMsg}</p>}
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={onDismiss}
            disabled={status === 'submitting'}
            className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={status === 'submitting'}
            className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 cursor-pointer"
          >
            {status === 'submitting' ? 'Saving…' : status === 'error' ? 'Retry' : 'Remember'}
          </button>
        </div>
      </div>
    );
  }

  const isRegister = proposal.kind === 'register_and_hold';
  const plate = isRegister ? proposal.newVehicle.plate : proposal.vehicle.plate;
  const vehicleLabel = isRegister ? describeNewVehicle(proposal.newVehicle) : proposal.vehicle.label;

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
        <CheckIcon />
        <span>
          {isRegister ? 'Registered + held ' : 'Hold opened on '}
          <span className="font-semibold">{plate}</span>.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {isRegister ? 'Confirm — register + hold' : 'Confirm new hold'}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        {isRegister ? 'Register ' : `${proposal.holdType} hold — `}
        {vehicleLabel}
      </p>
      {isRegister && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          New to the fleet — {proposal.holdType} hold on registration.
        </p>
      )}
      {proposal.damageDescription && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{proposal.damageDescription}</p>
      )}
      {status === 'error' && <p className="mt-1 text-xs text-red-500">{errMsg}</p>}
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onDismiss}
          disabled={status === 'submitting'}
          className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={status === 'submitting'}
          className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
        >
          {status === 'submitting'
            ? 'Working…'
            : status === 'error'
              ? 'Retry'
              : isRegister
                ? 'Register + hold'
                : 'Confirm hold'}
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
