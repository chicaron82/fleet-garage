// Pure formatting for the FG assistant's `lookup_vehicle` tool. The proxy fetches
// the vehicle row + its ACTIVE holds from Supabase (RLS-scoped to the asking
// crew member); this shapes them into (a) a compact structured result the model
// can reason over and (b) a human one-liner it can quote. No I/O on purpose — so
// it's unit-tested without Supabase, and so the "anything on it?" phrasing lives
// in one tested place rather than in a prompt.

/** A single active hold, flattened from the `holds` row to just what the answer needs. */
export interface HoldFact {
  holdType: string;
  /** 'ACTIVE' for a live hold — the proxy only passes active ones, kept for clarity. */
  status: string;
  damageDescription: string;
  flaggedAt: string; // ISO timestamp
  flaggedByName: string | null;
}

/** Vehicle identity, flattened from the `vehicles` row. Nulls are the unknown parts. */
export interface VehicleFact {
  plate: string;
  unitNumber: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
}

export interface VehicleLookupResult {
  found: boolean;
  /** The plate as asked (normalized for matching upstream, echoed here as given). */
  plate: string;
  vehicle: VehicleFact | null;
  activeHolds: HoldFact[];
  /** Human summary the model can quote or paraphrase — the lot's-eye answer. */
  summary: string;
}

/** "Unit 1234 · 2023 Toyota Camry (White)" — skips the parts we don't know. */
export function describeVehicle(v: VehicleFact): string {
  const veh = [v.year, v.make, v.model].filter(Boolean).join(' ');
  const head = [v.unitNumber ? `Unit ${v.unitNumber}` : '', veh].filter(Boolean).join(' · ');
  const base = head || v.plate;
  return v.color ? `${base} (${v.color})` : base;
}

/** Deterministic YYYY-MM-DD from an ISO timestamp — locale-free so tests are stable. */
function isoDate(ts: string): string {
  return ts.slice(0, 10);
}

/** "damage — front bumper scuff (flagged 2026-06-20 by Ray)" */
function describeHold(h: HoldFact): string {
  const meta = [`flagged ${isoDate(h.flaggedAt)}`, h.flaggedByName ? `by ${h.flaggedByName}` : '']
    .filter(Boolean)
    .join(' ');
  const desc = h.damageDescription?.trim() ? ` — ${h.damageDescription.trim()}` : '';
  return `${h.holdType}${desc} (${meta})`;
}

/**
 * Shape a plate lookup into the tool result. `vehicle === null` means the plate
 * is unknown to the (RLS-scoped) fleet; an empty `holds` on a found vehicle is
 * the happy "nothing on it" answer.
 */
export function summarizeLookup(
  plate: string,
  vehicle: VehicleFact | null,
  holds: HoldFact[],
): VehicleLookupResult {
  if (!vehicle) {
    return {
      found: false,
      plate,
      vehicle: null,
      activeHolds: [],
      summary: `No record of ${plate} in the fleet.`,
    };
  }

  const who = describeVehicle(vehicle);
  if (holds.length === 0) {
    return {
      found: true,
      plate,
      vehicle,
      activeHolds: [],
      summary: `${who} — nothing on it. No active holds.`,
    };
  }

  const noun = holds.length === 1 ? 'hold' : 'holds';
  const list = holds.map(describeHold).join('; ');
  return {
    found: true,
    plate,
    vehicle,
    activeHolds: holds,
    summary: `${who} — ${holds.length} active ${noun}: ${list}.`,
  };
}
