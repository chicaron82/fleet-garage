// A trip to the airport takes a clean off Erin St's count. Aaron, 2026-11-03: *"Making a trip to the airport automatically
// removes 1 clean from the count"*. I asked whether anyone else Drains the same car; his answer: *"remember sole user. FG
// is wired to handle more but only I'm using it"*, so it is automatic, with no prompt.
// Ticket: docs/ticket-bay-on-deck-trip-clean-quick-holds.md.
// ✈ 2026-11-09 (docs/ticket-trip-marks-sent-up.md): *"if I make a trip to the airport and it's a car that was cleaned
// today, it changes it to sent up and minus 1 from the cleans"*. The same trip marks that car's Clean on today's list.
//
// • Only a trip that is not a shuttle run and not marked Other (the caller decides; overflow sends never come through
//   here, and his 2026-11-03 ruling keeps them out: they may be cars already at the airport).
// • The trip is the thing: its own write never waits on this, and a count that cannot move says so instead of failing it.
// • Reset gives back only what THIS phone took, remembered by trip id, so a trip started at 0 cleans (or with no signal)
//   never invents a clean when it is reset. Remembered across a reload, because the trip itself survives one. The ✈ is
//   the same: a Reset takes back only the mark this trip put there, never one he tapped by hand.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageTone } from '../lib/messageTone';
import { postLotSignedIn } from './useLotPin';

const KEY = 'fg.tripsThatTookAClean';
const SENT_KEY = 'fg.tripsThatSentUp';
const NOTE_MS = 4000;

interface SentByTrip { trip: string; line: number; plate: string }

function readList<T>(key: string, ok: (x: unknown) => x is T): T[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter(ok) : [];
  } catch { return []; }
}
function writeList(key: string, items: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(items.slice(-20))); } catch { /* private mode: a Reset just won't give back */ }
}
const isText = (x: unknown): x is string => typeof x === 'string';
const isSent = (x: unknown): x is SentByTrip => {
  const s = x as SentByTrip | null;
  return !!s && typeof s.trip === 'string' && typeof s.line === 'number' && typeof s.plate === 'string';
};

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

  /** The trip has started: one clean off, and ✈ on the car's Clean if it is on today's list. */
  const take = useCallback(async (tripId: string, plate = '') => {
    const [r, sent] = await Promise.all([
      postLotSignedIn({ action: 'tripClean', delta: -1, by }),
      plate.trim() ? postLotSignedIn({ action: 'bayTripSentUp', plate, by }) : Promise.resolve(null),
    ]);
    const line = sent?.ok ? (sent.json.row as { id?: unknown; plate?: unknown } | null | undefined) : null;
    let shown = '';
    if (line && typeof line.id === 'number') {
      shown = typeof line.plate === 'string' ? line.plate : plate;
      writeList(SENT_KEY, [...readList(SENT_KEY, isSent), { trip: tripId, line: line.id, plate: shown }]);
    }
    const mark = shown ? ` ✈ ${shown} sent up.` : '';
    const markLost = sent != null && !sent.ok;
    if (r.ok) {
      writeList(KEY, [...readList(KEY, isText), tripId]);
      say(`1 clean off Erin St${shown ? ` · ✈ ${shown} sent up` : ''}${markLost ? ". ✈ didn't save; tap it on the list if it was cleaned today." : ''}`, markLost ? 'notice' : 'success');
    } else if (r.status === 0) {
      say(`Trip started. No signal, so Erin St's cleans didn't move. Tap −1 when you can${markLost ? ', and ✈ on the list if it was cleaned today' : ''}.${mark}`, 'notice');
    } else {
      say(`Trip started. ${r.error ?? "Erin St's cleans didn't move."}${mark}`, 'notice');
    }
  }, [by, say]);

  /** The trip was reset before it arrived: the clean it took goes back, and the ✈ it put on. Nothing it did not do. */
  const giveBack = useCallback(async (tripId: string) => {
    const took = readList(KEY, isText);
    const marks = readList(SENT_KEY, isSent);
    const marked = marks.find(m => m.trip === tripId);
    const tookOne = took.includes(tripId);
    if (!tookOne && !marked) return;
    const [r, un] = await Promise.all([
      tookOne ? postLotSignedIn({ action: 'tripClean', delta: 1, by }) : Promise.resolve(null),
      marked ? postLotSignedIn({ action: 'baySentUp', id: marked.line, sent: false, by }) : Promise.resolve(null),
    ]);
    if (r?.ok) writeList(KEY, took.filter(id => id !== tripId));
    // A 409 is a line that stopped being a Clean (a Change already took the ✈ off): nothing left to take back.
    const unDone = un != null && (un.ok || un.status === 409);
    if (unDone) writeList(SENT_KEY, marks.filter(m => m.trip !== tripId));
    const unSaid = un?.ok && marked ? `✈ is off ${marked.plate}` : '';
    const unLost = un != null && !unDone && marked ? ` Tap ✈ on ${marked.plate} to take it back.` : '';
    if (r == null) {
      if (unSaid || unLost) say(unSaid ? `Trip reset. ${unSaid}.` : `Trip reset.${unLost}`, unLost ? 'notice' : 'success');
    } else if (r.ok) {
      say(`Trip reset. The clean is back on Erin St${unSaid ? `, and ${unSaid}` : ''}.${unLost}`, unLost ? 'notice' : 'success');
    } else {
      say(`Trip reset, but the clean didn't go back on Erin St. Set the count on the Erin pill.${unLost}`, 'notice');
    }
  }, [by, say]);

  return { note, take, giveBack };
}
