// Thread continuity for Effie: persist the visible chat across reloads so a page
// refresh doesn't wipe the conversation. Deliberately stores ONLY the text turns —
// never the transient confirm-card proposals (a stale "confirm this hold" card
// shouldn't resurrect) nor the large per-turn damage photos, and never an in-flight
// empty assistant bubble. A stored thread older than THREAD_MAX_AGE_MS is treated as
// stale (you don't want yesterday's chat resurfacing), and it's capped to the most
// recent THREAD_MAX_MESSAGES turns to bound storage + the resend payload.
//
// This is thread continuity (#1) — NOT durable "Effie knows you" memory (#2), which
// is a curated per-operator fact store landing separately.

export interface StoredMessage { role: 'user' | 'assistant'; text: string; }

const THREAD_KEY = 'fg_effie_thread';
export const THREAD_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h — a shift's worth
export const THREAD_MAX_MESSAGES = 40;

interface Wrapped { at: number; messages: StoredMessage[]; }

function isStorable(m: { role?: unknown; text?: unknown }): m is StoredMessage {
  return (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim() !== '';
}

/** Serialize a thread for storage: strip to role+text, drop empties, cap to the last N. */
export function packThread(messages: StoredMessage[], now: number): string {
  const clean = messages.filter(isStorable).slice(-THREAD_MAX_MESSAGES).map((m) => ({ role: m.role, text: m.text }));
  return JSON.stringify({ at: now, messages: clean } satisfies Wrapped);
}

/** Validate + age-check an already-parsed thread wrapper — the JSONB shape stored server-side
 *  (effieThreadSync) hands the parsed object straight in, no re-stringify. Returns the storable
 *  messages, or null if missing/malformed/stale/empty. */
export function unpackWrapped(parsed: Partial<Wrapped> | null | undefined, now: number, maxAge = THREAD_MAX_AGE_MS): StoredMessage[] | null {
  if (!parsed || typeof parsed.at !== 'number' || !Array.isArray(parsed.messages)) return null;
  if (now - parsed.at > maxAge) return null;
  const msgs = parsed.messages.filter(isStorable);
  return msgs.length > 0 ? msgs : null;
}

/** Parse a stored thread; null if missing, malformed, empty, or older than maxAge. */
export function unpackThread(raw: string | null, now: number, maxAge = THREAD_MAX_AGE_MS): StoredMessage[] | null {
  if (!raw) return null;
  try {
    return unpackWrapped(JSON.parse(raw) as Partial<Wrapped>, now, maxAge);
  } catch {
    return null;
  }
}

// ── localStorage IO (thin wrappers around the pure pack/unpack) ───────────────

export function loadThread(): StoredMessage[] | null {
  try { return unpackThread(localStorage.getItem(THREAD_KEY), Date.now()); }
  catch { return null; }
}

export function saveThread(messages: StoredMessage[]): void {
  try {
    if (!messages.some(isStorable)) { localStorage.removeItem(THREAD_KEY); return; }
    localStorage.setItem(THREAD_KEY, packThread(messages, Date.now()));
  } catch { /* private mode / quota — non-fatal, thread just won't persist */ }
}

export function clearThread(): void {
  try { localStorage.removeItem(THREAD_KEY); } catch { /* ignore */ }
}
