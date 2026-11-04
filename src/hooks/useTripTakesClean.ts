// A trip to the airport takes a clean off Erin St's count. Aaron, 2026-11-03: *"Making a trip to the airport automatically
// removes 1 clean from the count"*. I asked whether anyone else Drains the same car; his answer: *"remember sole user. FG
// is wired to handle more but only I'm using it"*, so it is automatic, with no prompt.
// Ticket: docs/ticket-bay-on-deck-trip-clean-quick-holds.md.
//
// • Only a trip that is not a shuttle run and not marked Other (the caller decides; overflow sends never come through
//   here, and his 2026-11-03 ruling keeps them out: they may be cars already at the airport).
// • The trip is the thing: its own write never waits on this, and a count that cannot move says so instead of failing it.
// • Reset gives back only what THIS phone took, remembered by trip id, so a trip started at 0 cleans (or with no signal)
//   never invents a clean when it is reset. Remembered across a reload, because the trip itself survives one.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageTone } from '../lib/messageTone';
import { postLotSignedIn } from './useLotPin';

const KEY = 'fg.tripsThatTookAClean';
const NOTE_MS = 4000;

function readTook(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}
function writeTook(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(-20))); } catch { /* private mode: a Reset just won't give back */ }
}

export interface TripCleanNote { text: string; tone: MessageTone }

export function useTripTakesClean(by: string) {
  const [note, setNote] = useState<TripCleanNote | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = useCallback((text: string, tone: MessageTone) => {
    setNote({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  /** The trip has started: one clean off. */
  const take = useCallback(async (tripId: string) => {
    const r = await postLotSignedIn({ action: 'tripClean', delta: -1, by });
    if (r.ok) {
      writeTook([...readTook(), tripId]);
      say('1 clean off Erin St', 'success');
    } else if (r.status === 0) {
      say("Trip started. No signal, so Erin St's cleans didn't move. Tap −1 when you can.", 'notice');
    } else {
      say(`Trip started. ${r.error ?? "Erin St's cleans didn't move."}`, 'notice');
    }
  }, [by, say]);

  /** The trip was reset before it arrived: the clean it took goes back. Nothing, if it took none. */
  const giveBack = useCallback(async (tripId: string) => {
    const took = readTook();
    if (!took.includes(tripId)) return;
    const r = await postLotSignedIn({ action: 'tripClean', delta: 1, by });
    if (r.ok) {
      writeTook(took.filter(id => id !== tripId));
      say('Trip reset. The clean is back on Erin St.', 'success');
    } else {
      say("Trip reset, but the clean didn't go back on Erin St. Set the count on the Erin pill.", 'notice');
    }
  }, [by, say]);

  return { note, take, giveBack };
}
