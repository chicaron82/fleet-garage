// His recent Pulled away notes (2026-11-25, migration 172, docs/ticket-lot-bay-pulled-away-note.md): the last few come
// back as one-tap picks, so a line he uses often is typed once. Hand-load is a design axis for him (arthritis).
// Per phone, in localStorage: a convenience, never the record. Every read and write survives a storage that throws.
import { PAUSE_NOTE_MAX } from './lotBay';

export const PULLED_NOTES_KEY = 'fg.pulledAwayNotes';
export const PULLED_NOTES_KEEP = 3;

/** One line, whitespace folded, capped. '' = nothing worth saving. */
export function tidyNote(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, PAUSE_NOTE_MAX);
}

/** The note on top, an older copy of it dropped (case-insensitive), the list kept to PULLED_NOTES_KEEP. */
export function rememberNote(list: readonly string[], note: string): string[] {
  const n = tidyNote(note);
  if (!n) return [...list].slice(0, PULLED_NOTES_KEEP);
  return [n, ...list.filter(x => x.toLowerCase() !== n.toLowerCase())].slice(0, PULLED_NOTES_KEEP);
}

export function readPulledNotes(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PULLED_NOTES_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x).slice(0, PULLED_NOTES_KEEP) : [];
  } catch { return []; }
}

export function savePulledNotes(list: readonly string[]): void {
  try { localStorage.setItem(PULLED_NOTES_KEY, JSON.stringify(list)); } catch { /* a convenience: nothing to do */ }
}
