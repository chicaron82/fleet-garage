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

/** A thread plus the epoch-ms `at` it was stamped with — the basis for "adopt if newer"
 *  reconciliation across the mount/focus/realtime layers (live-sync). */
export interface StampedThread { at: number; messages: StoredMessage[]; }

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
export function unpackWrapped(parsed: unknown, now: number, maxAge = THREAD_MAX_AGE_MS): StoredMessage[] | null {
  const w = parsed as Partial<Wrapped> | null | undefined;
  if (!w || typeof w.at !== 'number' || !Array.isArray(w.messages)) return null;
  if (now - w.at > maxAge) return null;
  const msgs = w.messages.filter(isStorable);
  return msgs.length > 0 ? msgs : null;
}

/** Parse a stored thread; null if missing, malformed, empty, or older than maxAge. */
export function unpackThread(raw: string | null, now: number, maxAge = THREAD_MAX_AGE_MS): StoredMessage[] | null {
  if (!raw) return null;
  try {
    return unpackWrapped(JSON.parse(raw), now, maxAge);
  } catch {
    return null;
  }
}

/** Like unpackWrapped, but keeps the `at` alongside the messages — live-sync needs the timestamp
 *  to decide whether an incoming thread is newer than the one on screen. `at` is a validated number
 *  whenever unpackWrapped returns non-null. */
export function unpackWrappedStamped(parsed: unknown, now: number, maxAge = THREAD_MAX_AGE_MS): StampedThread | null {
  const messages = unpackWrapped(parsed, now, maxAge);
  if (!messages) return null;
  return { at: (parsed as Wrapped).at, messages };
}

/** The rule that unifies live-sync: adopt an incoming thread only if it's strictly newer than the
 *  one on screen (`>` — an equal `at` is this device's own echo and is ignored), and never mid-turn
 *  (don't yank the thread out from under an in-flight Effie response). Pure so it's locked by tests. */
export function shouldAdoptThread(incomingAt: number, currentAt: number, isLoading: boolean): boolean {
  if (isLoading) return false;
  return incomingAt > currentAt;
}

// ── localStorage IO (thin wrappers around the pure pack/unpack) ───────────────

export function loadThread(): StoredMessage[] | null {
  try { return unpackThread(localStorage.getItem(THREAD_KEY), Date.now()); }
  catch { return null; }
}

/** The local cache thread WITH its `at` — used to seed the live-sync timestamp on mount. */
export function loadThreadStamped(): StampedThread | null {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (!raw) return null;
    return unpackWrappedStamped(JSON.parse(raw) as Partial<Wrapped>, Date.now());
  } catch { return null; }
}

/** Persist to localStorage. `at` is caller-supplied so the local write, the server write, and the
 *  in-memory `threadAtRef` all share ONE timestamp (live-sync compares them). */
export function saveThread(messages: StoredMessage[], at: number = Date.now()): void {
  try {
    if (!messages.some(isStorable)) { localStorage.removeItem(THREAD_KEY); return; }
    localStorage.setItem(THREAD_KEY, packThread(messages, at));
  } catch { /* private mode / quota — non-fatal, thread just won't persist */ }
}

export function clearThread(): void {
  try { localStorage.removeItem(THREAD_KEY); } catch { /* ignore */ }
}
