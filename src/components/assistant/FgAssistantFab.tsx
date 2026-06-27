// "Hey FG" — the floating action button + chat panel. Tap the FAB, ask about a
// vehicle in plain language ("anything on LUR187?"), and the assistant looks it
// up and answers. Tier 1 is read-only (vehicle lookups); guided actions and
// vision come later, behind confirm gates. All the model/key work lives in the
// proxy (api/fg-chat.ts) + the hook — this is just the surface.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useFgAssistant } from '../../hooks/useFgAssistant';
import { HoldProposalCard } from './HoldProposalCard';
import type { HoldType } from '../../types';
import type { Proposal } from '../../../api/_lib/holdProposal';

export function FgAssistantFab() {
  const { user } = useAuth();
  const { addHold, addVehicle } = useVehicleHoldContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [loginId, setLoginId] = useState<string | null>(null);
  const { messages, loading, error, send, clearProposal } = useFgAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The login id = the part before @fleet-garage.internal in the auth email —
  // the SAME identifier the server gate checks (api/fg-chat getUser → email). Gate
  // on this, not the profile employee_id, so client + server never disagree.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoginId((data.session?.user.email ?? '').split('@')[0].toLowerCase());
    });
  }, []);

  // Keep the latest turn in view as the answer streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Only show the FAB to allowlisted accounts (the assistant runs on a personal
  // API key). Mirrors the server's isAllowed gate in api/_lib/assistantAccess —
  // empty/unset allowlist = open to all. The server still enforces regardless;
  // this just hides a button that would 403. Guard sits after all hooks.
  const allowIds = ((import.meta.env.VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS as string | undefined) ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowed = allowIds.length === 0 || (loginId !== null && allowIds.includes(loginId));
  if (!allowed) return null;

  // Confirm a drafted proposal → the REAL writes happen here (the proxy never wrote;
  // this tap is the only write path). 'hold' → addHold on the existing vehicle;
  // 'register_and_hold' → addVehicle (defaults to HELD) then addHold on the new id.
  // Both reuse the battle-tested mutations (status flip, mgmt ntfy, dedup) for free.
  const confirmProposal = async (proposal: Proposal) => {
    if (!user) throw new Error('Not signed in.');
    const holdTypes: HoldType[] = [proposal.holdType as HoldType];
    if (proposal.kind === 'register_and_hold') {
      const nv = proposal.newVehicle;
      const vehicleId = await addVehicle({
        unitNumber: nv.unitNumber,
        licensePlate: nv.plate,
        make: nv.make,
        model: nv.model,
        year: nv.year,
        color: nv.color,
        branchId: user.branchId,
        isTesla: nv.make === 'Tesla',
        hasMobileCable: null,
        hasJ1772Adapter: null,
      });
      await addHold(vehicleId, proposal.damageDescription, '', user.id, undefined, holdTypes);
      return;
    }
    await addHold(proposal.vehicle.vehicleId, proposal.damageDescription, '', user.id, undefined, holdTypes);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || loading) return;
    setDraft('');
    void send(text);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask FG"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition cursor-pointer"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <span className="text-blue-600 dark:text-blue-400"><SparkleIcon small /></span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ask FG</p>
              <p className="text-[11px] text-gray-400">Try: "anything on LUR187?"</p>
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                Ask about any vehicle by plate or unit number.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-sm text-white'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }
                  >
                    {m.text || (loading && i === messages.length - 1 ? <TypingDots /> : '')}
                  </div>
                </div>
                {m.role === 'assistant' && m.proposal && (
                  <HoldProposalCard
                    proposal={m.proposal}
                    onConfirm={() => confirmProposal(m.proposal!)}
                    onDismiss={() => clearProposal(i)}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="Ask about a vehicle…"
              className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || loading}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SparkleIcon({ small }: { small?: boolean }) {
  const size = small ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L23 12l-6.714 2.143L14 21l-2.286-6.857L5 12l6.714-2.143L14 3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
    </span>
  );
}
