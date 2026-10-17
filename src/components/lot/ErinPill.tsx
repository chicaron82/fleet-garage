// Erin St's count in FG's top bar, on every screen: "Erin 7/3". Tap it for the sheet that updates it.
//
// ⭐ Aaron, 2026-10-16, after a real shift with the count living on My Day's card: *"i was doing everything. logging
// odo, and flagging. so having to switch back to my day and scroll to the bottom to update the cleans and dirties after
// each vehicle and driver drain was a lot of taps and swipes"*. His one five-second thing: *"the erin st count. easily
// updated and tap to copy"*. And it reads the way he says it out loud: *"when asked what the count is, i reply with
// "7/3" (7 clean, 3 dirties)"*.
//
// Hidden until Erin St's row exists (migration 153), so a missing table never puts an error in the top bar. A count
// over 30 min old reads amber, his ruling for both counts (*"If nothing is being sent up for over 30min"*).
import { useState } from 'react';
import { isBayStale } from '../../lib/lotBay';
import { initialsOf } from '../../lib/lotLookout';
import { hapticLight } from '../../lib/haptics';
import { useLotBay } from '../../hooks/useLotBay';
import { useAuth } from '../../context/AuthContext';
import { ErinCountSheet } from './ErinCountSheet';

export function ErinPill() {
  const erin = useLotBay();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const bay = erin.bay;
  if (!bay) return null;
  const old = (at: string | null) => isBayStale(at, erin.nowMs);
  const dirties = bay.dirties ?? '–';
  return (
    <>
      <button type="button" onClick={() => { hapticLight(); setOpen(true); }}
        aria-label={`Erin St: ${bay.cleans} cleans, ${dirties} dirties. Tap to update`}
        className="flex items-baseline gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-2 pr-2.5 py-0.5 cursor-pointer active:scale-95 transition">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Erin</span>
        <span className="font-mono text-sm font-bold tabular-nums">
          <span className={old(bay.cleansAt) ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}>{bay.cleans}</span>
          <span className="text-gray-400 dark:text-gray-500">/</span>
          <span className={old(bay.dirtiesAt) ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}>{dirties}</span>
        </span>
      </button>
      {open && <ErinCountSheet erin={erin} by={initialsOf(user?.name ?? null)} onClose={() => setOpen(false)} />}
    </>
  );
}
