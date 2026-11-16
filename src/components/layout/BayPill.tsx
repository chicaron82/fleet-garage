// The car in the bay, in FG's top bar, on every screen but Lot Lookout. One tap finishes the clean, and the car on deck
// comes in. Aaron, 2026-11-15: *"if i happen to navigate away from the lot lookout module a pill would show in the
// header. tapping it finishes the clean and if something's already on deck starts it."* Ticket:
// docs/ticket-header-bay-pill.md.
//
// • The tap is HELD for PILL_UNDO_MS with Undo, the way the trip and timer pills end (usePillEnd): nothing is written
//   until it runs out, so a thumb that lands on the header costs nothing, and Erin St's count never moves +1 then −1.
// • The write is the card's own: useBayLog.exit, the same call, the same server exit (which pulls the on-deck car in).
// • What the tap sends is lib/bayPill: ✓ Clean, or close-as-held when a hold was flagged since the car came in.
// • No odo here. The reading is optional on a Clean, and the box lives on the card.
// • Hidden on Lot Lookout, where the card is. A held tap or its word stays until it lands, wherever he goes.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useBayLog } from '../../hooks/useBayLog';
import { useBayStandby } from '../../hooks/useBayStandby';
import { bayPillPlan, type BayPillPlan } from '../../lib/bayPill';
import { bayHeldSince, inTheBay } from '../../lib/lotBayLog';
import { initialsOf } from '../../lib/lotLookout';
import { hapticLight } from '../../lib/haptics';
import { PILL_UNDO_MS } from '../../lib/pillEnd';
import type { Module, Screen } from '../../types';
import { CHIP } from './ActiveSessionPill';

const SAID_MS = 2500;
interface Said { text: string; ok: boolean }

export function BayPill({ activeModule, onNavigate }: { activeModule: Module; onNavigate: (s: Screen) => void }) {
  const { user } = useAuth();
  const by = initialsOf(user?.name ?? null) || 'FG';
  const bay = useBayLog(by);
  const next = useBayStandby(by);
  const { holds } = useVehicleHoldContext();
  const [held, setHeld] = useState<BayPillPlan | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const open = bay.loaded ? inTheBay(bay.rows) : null;
  const plan = open ? bayPillPlan(open, bayHeldSince(open, holds), next.standby?.plate ?? null) : null;
  if (!held && !said && (!plan || activeModule === 'lot-lookout')) return null;

  const say = (s: Said) => {
    setSaid(s);
    setTimeout(() => setSaid(p => (p === s ? null : p)), SAID_MS);
  };
  const tap = () => {
    // A failed write's chip opens the card, where the exit can be tried again with the reason on screen.
    if (said && !said.ok) { setSaid(null); onNavigate({ name: 'lot-lookout' }); return; }
    if (!open || !plan || held) return;
    hapticLight();
    const { id } = open;
    setHeld(plan);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void bay.exit(id, plan.exit).then(err => {
        setHeld(null);
        say(err ? { text: '⚠ Not saved', ok: false } : { text: plan.done, ok: true });
      });
    }, PILL_UNDO_MS);
  };
  const undo = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    hapticLight();
    setHeld(null);
  };

  if (held) {
    return (
      <button type="button" onClick={undo} aria-label={held.heldLabel}
        className={`${CHIP} bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900`}>
        <span className="font-mono tabular-nums">{held.chip}</span>
        <span className="underline underline-offset-2">Undo</span>
      </button>
    );
  }
  if (said) {
    return (
      <button type="button" onClick={tap} aria-label={said.ok ? said.text : 'The bay did not save. Open Lot Lookout to finish it'}
        className={`${CHIP} ${said.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
        {said.text}
      </button>
    );
  }
  return (
    <button type="button" onClick={tap} aria-label={plan!.label}
      className={`${CHIP} bg-fg-yellow hover:bg-fg-yellow-hi text-black`}>
      <span className="font-mono tabular-nums">{plan!.face}</span>
    </button>
  );
}
