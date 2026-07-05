// The confirm card for a drafted proposal — a hold, a register+hold, a lost & found
// log, a memory to remember, or a navigate offer. The AI proposed it (the proxy wrote
// nothing); only the Confirm tap here calls the real mutation via onConfirm. Owns its
// own submit/done/error state so the card becomes a receipt ("✓ Hold opened" / "✓
// Logged" / "✓ Saved") once it lands — the single write path for an AI-suggested action.
//
// Six kinds share three internal shells (Shell / Receipt / CardActions) so a new
// proposal kind is a body + two labels, not another hand-rolled card. Tones: amber =
// an ops write (hold, lost & found), blue = personal/no-write (memory, navigate).
import { useState } from 'react';
import { describeNewVehicle, type Proposal } from '../../../api/_lib/holdProposal';
import { lostItemLocationLabel } from '../../../api/_lib/lostItemProposal';

interface Props {
  proposal: Proposal;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

type Tone = 'amber' | 'blue';
type Status = 'idle' | 'submitting' | 'done' | 'error';

const SHELL_TONE: Record<Tone, string> = {
  amber: 'border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
  blue:  'border-blue-300/60 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10',
};
const KICKER_TONE: Record<Tone, string> = {
  amber: 'text-amber-700 dark:text-amber-400',
  blue:  'text-blue-700 dark:text-blue-400',
};
const CONFIRM_TONE: Record<Tone, string> = {
  amber: 'bg-amber-500 hover:bg-amber-400',
  blue:  'bg-blue-600 hover:bg-blue-500',
};

/** The card container: toned border/tint + the small uppercase kicker line. */
function Shell({ tone, kicker, children }: { tone: Tone; kicker: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${SHELL_TONE[tone]}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${KICKER_TONE[tone]}`}>{kicker}</p>
      {children}
    </div>
  );
}

/** The green "it landed" receipt the card becomes after a successful confirm. */
function Receipt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
      <CheckIcon />
      <span>{children}</span>
    </div>
  );
}

/** Error line + Cancel/Confirm pair with the shared submitting/retry behavior. */
function CardActions({ tone, status, errMsg, confirmLabel, workingLabel, onDismiss, onConfirm }: {
  tone: Tone;
  status: Status;
  errMsg: string;
  confirmLabel: string;
  workingLabel: string;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
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
          onClick={onConfirm}
          disabled={status === 'submitting'}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer ${CONFIRM_TONE[tone]}`}
        >
          {status === 'submitting' ? workingLabel : status === 'error' ? 'Retry' : confirmLabel}
        </button>
      </div>
    </>
  );
}

export function HoldProposalCard({ proposal, onConfirm, onDismiss }: Props) {
  const [status, setStatus] = useState<Status>('idle');
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
  // receipt state: the tap navigates and closes the panel, unmounting this card. Its
  // button pair is its own (no disabled states, offer wording), so no CardActions.
  if (proposal.kind === 'navigate') {
    return (
      <Shell tone="blue" kicker="Open screen">
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
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold text-white cursor-pointer ${CONFIRM_TONE.blue}`}
          >
            Take me there →
          </button>
        </div>
      </Shell>
    );
  }

  // Lost & found log — its own shape (no vehicle/holdType).
  if (proposal.kind === 'lost_item') {
    if (status === 'done') return <Receipt>Logged to lost &amp; found.</Receipt>;
    const meta = [
      proposal.location ? lostItemLocationLabel(proposal.location) : null,
      proposal.licensePlate ? `Plate ${proposal.licensePlate}` : null,
    ].filter(Boolean);
    return (
      <Shell tone="amber" kicker="Confirm — log found item">
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.description}</p>
        {meta.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{meta.join(' · ')}</p>}
        {proposal.notes && <p className="text-sm text-gray-600 dark:text-gray-300">{proposal.notes}</p>}
        <CardActions tone="amber" status={status} errMsg={errMsg} confirmLabel="Log item" workingLabel="Working…" onDismiss={onDismiss} onConfirm={confirm} />
      </Shell>
    );
  }

  // Memory — Effie's own "remember this about you". Blue: a personal note, not an ops write.
  if (proposal.kind === 'memory') {
    if (status === 'done') return <Receipt>Saved — I&apos;ll remember that.</Receipt>;
    return (
      <Shell tone="blue" kicker="Remember this?">
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.content}</p>
        <CardActions tone="blue" status={status} errMsg={errMsg} confirmLabel="Remember" workingLabel="Saving…" onDismiss={onDismiss} onConfirm={confirm} />
      </Shell>
    );
  }

  // Reminder — a note Effie leaves on the shift whiteboard for the user's next shift.
  // Blue: a personal note (surfaces on My Shift then, auto-clears after), not an ops write.
  if (proposal.kind === 'reminder') {
    if (status === 'done') return <Receipt>On your shift board for next shift.</Receipt>;
    return (
      <Shell tone="blue" kicker="Reminder — next shift">
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{proposal.text}</p>
        <CardActions tone="blue" status={status} errMsg={errMsg} confirmLabel="Leave note" workingLabel="Saving…" onDismiss={onDismiss} onConfirm={confirm} />
      </Shell>
    );
  }

  const isRegister = proposal.kind === 'register_and_hold';
  const plate = isRegister ? proposal.newVehicle.plate : proposal.vehicle.plate;
  const vehicleLabel = isRegister ? describeNewVehicle(proposal.newVehicle) : proposal.vehicle.label;

  if (status === 'done') {
    return (
      <Receipt>
        {isRegister ? 'Registered + held ' : 'Hold opened on '}
        <span className="font-semibold">{plate}</span>.
      </Receipt>
    );
  }

  return (
    <Shell tone="amber" kicker={isRegister ? 'Confirm — register + hold' : 'Confirm new hold'}>
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
      <CardActions
        tone="amber"
        status={status}
        errMsg={errMsg}
        confirmLabel={isRegister ? 'Register + hold' : 'Confirm hold'}
        workingLabel="Working…"
        onDismiss={onDismiss}
        onConfirm={confirm}
      />
    </Shell>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
