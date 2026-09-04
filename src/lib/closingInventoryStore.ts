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
// ⚠️ AND DELIBERATELY NO SERVER SYNC, unlike the flip. The flip syncs because he genuinely uses two
// devices for it — *"he flips on the phone, adds one on the computer, then picks the phone back
// up"*. A closing write-up is one pile of keys, one person, one sitting. Syncing it would buy a
// problem he does not have and cost a table he does not need.
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
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : [],
      carriedStatus: typeof carried === 'string' && STATUSES.includes(carried as InventoryStatus)
        ? carried as InventoryStatus : null,
      carriedRow: typeof parsed.carriedRow === 'string' ? parsed.carriedRow : '',
    };
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
