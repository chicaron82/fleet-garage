// The ephemeral airport-flip session (see lib/airportFlip). Lives in sessionStorage keyed to the
// SHIFT DAY — so it survives collapsing the section, switching My Shift tabs, a nav away, or a
// reload, but self-clears on a new shift (a stale-day payload is dropped on read). No table, no
// migration: the "dies with the shift" guardrail is structural, not a discipline we have to keep.
import { useCallback, useEffect, useState } from 'react';
import { businessDateOf } from '../lib/shiftDay';
import { buildFlipReport, type FlipRow } from '../lib/airportFlip';

const KEY = 'fg_airport_flip';

interface Stored { day: string; rows: FlipRow[] }

function read(today: string): FlipRow[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    return parsed.day === today ? parsed.rows : []; // a stale shift-day is simply gone
  } catch { return []; }
}

export interface AirportFlip {
  rows: FlipRow[];
  add: (row: Omit<FlipRow, 'id' | 'checked' | 'sent'>) => void;
  update: (id: string, patch: Partial<Pick<FlipRow, 'odo' | 'fuel' | 'damaged' | 'notes'>>) => void;
  remove: (id: string) => void;
  toggleChecked: (id: string) => void;
  /** The text for the checked-and-unsent rows, or '' if none — the caller copies + calls markSent. */
  reportForSend: () => string;
  /** Mark every checked-and-unsent row as sent (and clear its check) — called after a successful copy. */
  markSent: () => void;
  checkedUnsentCount: number;
}

export function useAirportFlip(): AirportFlip {
  const today = businessDateOf(new Date());
  const [rows, setRows] = useState<FlipRow[]>(() => read(today));

  // Persist on every change, stamped with the shift-day so the next read can expire it.
  useEffect(() => {
    sessionStorage.setItem(KEY, JSON.stringify({ day: today, rows } satisfies Stored));
  }, [rows, today]);

  const add = useCallback((row: Omit<FlipRow, 'id' | 'checked' | 'sent'>) => {
    setRows(prev => [...prev, { ...row, id: crypto.randomUUID(), checked: true, sent: false }]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<FlipRow, 'odo' | 'fuel' | 'damaged' | 'notes'>>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const remove = useCallback((id: string) => setRows(prev => prev.filter(r => r.id !== id)), []);

  // Only UNSENT rows toggle — a sent row is locked (nothing double-sends).
  const toggleChecked = useCallback((id: string) => {
    setRows(prev => prev.map(r => (r.id === id && !r.sent ? { ...r, checked: !r.checked } : r)));
  }, []);

  const reportForSend = useCallback(() => buildFlipReport(rows.filter(r => r.checked && !r.sent)), [rows]);

  const markSent = useCallback(() => {
    setRows(prev => prev.map(r => (r.checked && !r.sent ? { ...r, sent: true, checked: false } : r)));
  }, []);

  const checkedUnsentCount = rows.filter(r => r.checked && !r.sent).length;

  return { rows, add, update, remove, toggleChecked, reportForSend, markSent, checkedUnsentCount };
}
