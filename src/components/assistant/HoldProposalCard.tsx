// The confirm card for a drafted hold. The AI proposed it (the proxy wrote
// nothing); only the Confirm tap here calls the real addHold via onConfirm. Owns
// its own submit/done/error state so the card becomes a receipt ("✓ Hold opened")
// once it lands — the single write path for an AI-suggested hold.
import { useState } from 'react';
import type { HoldProposal } from '../../../api/_lib/holdProposal';

interface Props {
  proposal: HoldProposal;
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
      setErrMsg(e instanceof Error ? e.message : 'Could not open the hold.');
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
        <CheckIcon />
        <span>
          Hold opened on <span className="font-semibold">{proposal.vehicle.plate}</span>.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Confirm new hold
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        {proposal.holdType} hold — {proposal.vehicle.label}
      </p>
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
          {status === 'submitting' ? 'Opening…' : status === 'error' ? 'Retry' : 'Confirm hold'}
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
