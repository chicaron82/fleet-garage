// Lot Lookout, airport, write side: a notch tap or the aisle flag, sent through api/lot.ts (the only writer).
//
// ⭐ A TAP NEVER WAITS FOR SIGNAL (docs/ticket-lot-lookout-taps-wait-for-signal.md). Aaron, 10-15, the parkade: *"my
// cell connection at the parkade was atrocious"*. The old board put a failed tap BACK in front of the driver ("No
// signal. The tap did not save."), so in a dead zone every tap was undone as it was made. Now a tap goes into a small
// queue on the phone with the time it was made, shows at once, and is sent when it can be: right away, when the phone
// comes back online, when the page comes back into view, and every 15 s while anything waits. The server keeps
// whichever reading is newest (api/_lib/lotAirport.ts), so a late phone never overwrites a fresher one.
//
// What ends a waiting tap: an answer. 200 (written, or older than what was there) settles it; 401 drops the whole
// queue (a PIN taken on trust that turned out wrong; useLotPin forgets it and asks again); any other refusal drops that
// tap and says why. No answer at all (status 0) or a server error (5xx) keeps everything for the next try.
import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueReading, parseQueue, readingsFromRow, settleReading, withQueued, type AirportField, type AirportRowShape, type QueuedReading } from '../lib/lotAirport';
import type { LotAirport } from './useLotAirport';
import type { LotPost } from './useLotPin';

const RETRY_MS = 15_000;

function readQueue(key: string): QueuedReading[] {
  try { return parseQueue(localStorage.getItem(key)); } catch { return []; }
}
function writeQueue(key: string, q: readonly QueuedReading[]): void {
  try { if (q.length) localStorage.setItem(key, JSON.stringify(q)); else localStorage.removeItem(key); } catch { /* private mode: the queue lives as long as the page */ }
}

export interface AirportTapsOptions {
  airport: LotAirport;
  send: (body: Record<string, unknown>) => Promise<LotPost>;
  by: string;
  /** localStorage key; the PIN page and FG's signed-in module keep separate queues. */
  queueKey: string;
  /** A write was refused (401 included); say so. */
  onFail: (r: LotPost) => void;
  /** A write reached the server and was accepted. */
  onSent?: () => void;
  toast: (msg: string) => void;
}

export function useAirportTaps({ airport, send, by, queueKey, onFail, onSent, toast }: AirportTapsOptions) {
  const [queue, setQueueState] = useState<QueuedReading[]>(() => readQueue(queueKey));
  const queueRef = useRef(queue);
  const sending = useRef(false);
  const { setLocal } = airport;

  const setQueue = useCallback((next: (q: QueuedReading[]) => QueuedReading[]) => {
    queueRef.current = next(queueRef.current);
    writeQueue(queueKey, queueRef.current);
    setQueueState(queueRef.current);
  }, [queueKey]);

  /** Send what waits, oldest first. Returns false when there was no signal (so the caller can say it is waiting). */
  const flush = useCallback(async (): Promise<boolean> => {
    if (sending.current) return true;
    sending.current = true;
    try {
      // Each waiting tap is tried once per flush, and a tap made while one was in flight is picked up in the same run.
      const tried = new Set<QueuedReading>();
      for (;;) {
        const q = queueRef.current.find(x => !tried.has(x));
        if (!q) return true;
        tried.add(q);
        const r = await send({ action: 'reading', field: q.field, value: q.value, at: q.at, by: by || 'Lot' });
        if (r.status === 0) return false;
        if (r.status >= 500) return true;
        if (r.status === 401) { setQueue(() => []); onFail(r); return true; }
        setQueue(cur => settleReading(cur, q));
        if (!r.ok) { onFail(r); continue; }
        onSent?.();
        const row = r.json.airport as AirportRowShape | null | undefined;
        if (row) setLocal(() => readingsFromRow(row));
      }
    } finally {
      sending.current = false;
    }
  }, [send, by, setQueue, onFail, onSent, setLocal]);

  const tap = useCallback(async (field: AirportField, value: number) => {
    setQueue(cur => enqueueReading(cur, { field, value, at: new Date().toISOString() }));
    const reached = await flush();
    if (!reached) toast('No signal. Kept on this phone; it sends when signal is back.');
  }, [setQueue, flush, toast]);

  // Try again whenever there's a reason to think signal is back, and on a timer while anything waits.
  const waiting = queue.length;
  useEffect(() => {
    const go = () => { void flush(); };
    const onVisible = () => { if (document.visibilityState === 'visible') go(); };
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', onVisible);
    const timer = waiting ? setInterval(go, RETRY_MS) : undefined;
    if (waiting) go();
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
    };
  }, [flush, waiting]);

  return { shown: withQueued(airport.readings, queue, by || 'Lot'), waiting, tap };
}
