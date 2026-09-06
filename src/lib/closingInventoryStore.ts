// The closing write-up, persisted — so a 57-car sheet cannot evaporate.
//
// ⚠️⚠️ THIS IS NOT A HYPOTHETICAL, AND THE PROOF IS ONE SECTION DOWN. The airport flip shipped its
// session in `sessionStorage` and Aaron lost live data to it on 2026-07-19: sessionStorage dies with
// the PROCESS, not the shift, and FG runs as a phone PWA all day — Android reclaimed the backgrounded
// app and the card showed 2 flips where he had recorded about 7. The closing inventory was carrying
// the same risk in a worse place: plain `useState`, nothing persisted at all, on a write-up that runs
// to **57 cars** on a real night.
//
// ⭐ So: localStorage, stamped with the SHIFT BUSINESS DAY. The expiry has never come from the
// storage type — it comes from the day stamp, and a stale-day payload is dropped on read. No table,
// no migration, no sync.
//
// ⚠️⚠️ THE "NO SERVER SYNC" ARGUMENT THAT USED TO SIT HERE WAS BUILT ON A FABRICATED QUOTE.
//
// It read: *the flip syncs because he genuinely uses two devices for it — "he flips on the phone,
// adds one on the computer, then picks the phone back up"* — set in the italic-quote form this
// codebase reserves for Aaron's VERBATIM words. **He never said it.** Traced 2026-09-06: the
// sentence originates in `docs/archive/ticket-flip-merge-per-row.md`, a **2026-07-26 line-check**
// finding explicitly stamped *"never hit live"* — an ILLUSTRATIVE SCENARIO a past DiZee invented to
// explain a race condition. A later session quoted the hypothetical as fact and used it to justify
// a DIFFERENT feature's design. Aaron, shown it: *"probably mis-remembered from a compaction. i may
// have used two to test. one to show a photo of a keytag in the camera roll. the other to take the
// photo."* Two devices was a TEST RIG, never a habit.
//
// ⭐ And the design it justified failed him the first night he used the feature: he scanned 24 cars
// at the yard, went home, opened FG on his PC and found nothing. His rule, which outranks any
// inferred usage pattern: **"these should be available. the value of FG is being able to use it on
// anything."** Sync is owed here — see the ticket. Until it lands this is device-local, and that is
// a known gap, not a decision.
import type { InventoryEntry, InventoryStatus } from './closingInventory';

const KEY = 'fg_closing_inventory';

const STATUSES: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

/** What survives a reload: the sheet AND the two carries. */
export interface StoredSession {
  entries: InventoryEntry[];
  /** ⭐ The carries persist too. Losing "I am carrying A · R-5" mid-pile is the same loss in
   *  miniature — he would have to re-pick the status and the row for the very next car. */
  carriedStatus: InventoryStatus | null;
  carriedRow: string;
}

export const EMPTY_SESSION: StoredSession = { entries: [], carriedStatus: null, carriedRow: '' };

/**
 * Heal a row read from storage into the CURRENT shape.
 *
 * ⚠️ The real fix for "added a field to a persisted shape". A row written by an older build can lack
 * a field added since, and a bare `.trim()` on it crashes the render — which is precisely how the
 * flip took the whole My Shift screen down on 2026-07-17. Every field is defaulted here so an old
 * payload can only ever be incomplete, never fatal.
 */
export function normalizeEntry(r: Partial<InventoryEntry>): InventoryEntry {
  const status = r.status && STATUSES.includes(r.status) ? r.status : 'A';
  return {
    // ⚠️ A row written before sync existed has no id. Minting one here is safe ONLY because
    // `loadSession` writes the healed session straight back — see there. Left unpersisted, every
    // read would mint DIFFERENT ids for the same rows and the merge would duplicate the sheet.
    id: r.id ?? crypto.randomUUID(),
    // 0, not Date.now() — an un-stamped legacy row is the OLDEST thing on the sheet, so any real
    // edit anywhere beats it. Stamping it "now" on every read would make it perpetually newest.
    at: r.at ?? 0,
    deleted: r.deleted ?? false,
    vehicleId: r.vehicleId ?? null,
    plate: typeof r.plate === 'string' ? r.plate : '',
    unitNumber: r.unitNumber ?? null,
    owningArea: r.owningArea ?? null,
    rentalClass: r.rentalClass ?? null,
    status,
    row: typeof r.row === 'string' ? r.row : '',
    note: typeof r.note === 'string' ? r.note : '',
  };
}

/**
 * Read the stored session, or an empty one.
 *
 * ⚠️ A payload from a DIFFERENT shift day reads as empty — that is the expiry, and it is why the day
 * is written alongside the rows rather than inferred from a timestamp.
 * ⚠️ Never throws: storage can be unavailable (private mode, quota, a browser that blocks it), and a
 * write-up must not fail to open because a cache could not be read.
 */
export function loadSession(today: string): StoredSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_SESSION;
    const parsed = JSON.parse(raw) as { day?: string; entries?: Partial<InventoryEntry>[]; carriedStatus?: unknown; carriedRow?: unknown };
    if (parsed.day !== today) return EMPTY_SESSION;
    const carried = parsed.carriedStatus;
    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const session: StoredSession = {
      entries: rawEntries.map(normalizeEntry),
      carriedStatus: typeof carried === 'string' && STATUSES.includes(carried as InventoryStatus)
        ? carried as InventoryStatus : null,
      carriedRow: typeof parsed.carriedRow === 'string' ? parsed.carriedRow : '',
    };
    // ⚠️⚠️ WRITE THE HEALED IDS BACK IMMEDIATELY. `normalizeEntry` mints an id for a row stored
    // before sync existed, and this function runs on EVERY load — so without persisting, the same
    // 24 rows would get 24 fresh ids each time and the per-row merge would duplicate the whole
    // sheet on contact with the server. Only writes when something actually lacked an id.
    if (rawEntries.some(e => !e.id)) saveSession(today, session);
    return session;
  } catch {
    return EMPTY_SESSION;
  }
}

/** Persist the session under today's shift day. Best-effort — a failed write must never block a scan. */
export function saveSession(today: string, session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today, ...session, at: Date.now() }));
  } catch { /* storage unavailable or full — the in-memory session still holds the sheet */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
