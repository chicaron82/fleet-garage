// A drafted "log this found item to lost & found" the AI proposes but never writes.
// Pure (tested), like holdProposal: the proxy builds one from the parsed request, the
// client renders it as a confirm card, and only the user's tap calls the real
// addLostFoundItem. The location slots mirror src/types LostFoundLocation — duplicated,
// not imported, because api/_lib must NOT cross-import src (Vercel transpiles functions,
// so a cross-dir import ERR_MODULE_NOT_FOUNDs at runtime). The client maps the value back.

export const LOST_ITEM_LOCATIONS = ['visor', 'front_seat', 'back_seat', 'trunk', 'under_seat', 'other'] as const;
export type LostItemLocation = (typeof LOST_ITEM_LOCATIONS)[number];

const LOCATION_LABELS: Record<LostItemLocation, string> = {
  visor: 'Visor',
  front_seat: 'Front seat',
  back_seat: 'Back seat',
  trunk: 'Trunk',
  under_seat: 'Under seat',
  other: 'Other',
};

/** A found item the user is being asked to confirm logging to lost & found. */
export interface LostItemProposal {
  kind: 'lost_item';
  description: string;
  location: LostItemLocation | null;
  licensePlate: string | null;
  notes: string | null;
}

/** Coerce a raw location string ("Back Seat", "under seat") to a known slot, else null. */
export function normalizeLostItemLocation(raw: string | undefined | null): LostItemLocation | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return (LOST_ITEM_LOCATIONS as readonly string[]).includes(v) ? (v as LostItemLocation) : null;
}

/** Build a lost-item proposal from parsed input. Pure — no I/O, no write. */
export function buildLostItemProposal(input: {
  description: string;
  location?: string | null;
  licensePlate?: string | null;
  notes?: string | null;
}): LostItemProposal {
  return {
    kind: 'lost_item',
    description: input.description.trim(),
    location: normalizeLostItemLocation(input.location),
    licensePlate: (input.licensePlate ?? '').trim().toUpperCase() || null,
    notes: (input.notes ?? '').trim() || null,
  };
}

/** Human label for a location slot — for the confirm card. */
export function lostItemLocationLabel(loc: LostItemLocation): string {
  return LOCATION_LABELS[loc];
}

/** "black wallet (Back seat) — plate LUR224" — a short one-liner the AI can echo. */
export function describeLostItemProposal(p: LostItemProposal): string {
  const where = p.location ? ` (${LOCATION_LABELS[p.location]})` : '';
  const plate = p.licensePlate ? ` — plate ${p.licensePlate}` : '';
  return `${p.description || 'item'}${where}${plate}`;
}
