// Pure formatting for the FG assistant's `lookup_vehicle` tool. The proxy fetches
// the vehicle row + its ACTIVE and RELEASED holds from Supabase (RLS-scoped to the
// asking crew member); this shapes them into (a) a compact structured result the
// model can reason over and (b) a human one-liner it can quote. No I/O on purpose —
// so it's unit-tested without Supabase, and so the "anything on it?" phrasing lives
// in one tested place rather than in a prompt.
//
// Why released holds matter: a hold that was flagged then released — especially on
// a *verbal override* — is exactly the ambiguous, worth-knowing context a VSA wants
// ("this car was let out despite a flag, on someone's say-so"). Active holds block;
// released holds are history worth surfacing, not noise.

/** How a hold was released — only set on RELEASED holds. */
export interface ReleaseFact {
  method: string; // 'standard' | 'verbal_override'
  type: string; // 'EXCEPTION' | 'PRE_EXISTING' | 'MECHANICAL_RELEASE'
  authorizedBy: string | null; // override_authorization, for verbal overrides
}

/** A single hold, flattened from the `holds` row to just what the answer needs. */
export interface HoldFact {
  holdType: string;
  status: string; // 'ACTIVE' (blocking) or 'RELEASED' (history/context)
  damageDescription: string;
  flaggedAt: string; // ISO timestamp
  flaggedByName: string | null;
  release: ReleaseFact | null;
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
  releasedHolds: HoldFact[];
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

// FG is a single-region (Winnipeg / YWG) pilot, so format dates in the crew's local
// time — otherwise a UTC date reads a day off from the hold cards, which render in
// browser-local time. Explicit timeZone keeps this deterministic wherever it runs
// (the Vercel function runs in UTC).
const FG_TZ = 'America/Winnipeg';

/** "Jun 19, 2026" in Winnipeg time — matches the hold cards' fmtDate exactly. */
function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: FG_TZ,
  });
}

/** "damage — front bumper scuff (flagged Jun 20, 2026 by Ray)" — the shared core. */
function describeHoldCore(h: HoldFact): string {
  const meta = [`flagged ${fmtDate(h.flaggedAt)}`, h.flaggedByName ? `by ${h.flaggedByName}` : '']
    .filter(Boolean)
    .join(' ');
  const desc = h.damageDescription?.trim() ? ` — ${h.damageDescription.trim()}` : '';
  return `${h.holdType}${desc} (${meta})`;
}

/** How a release reads in plain language — verbal overrides name who authorized them. */
function describeRelease(r: ReleaseFact | null): string {
  if (!r) return 'released';
  if (r.method === 'verbal_override') {
    return r.authorizedBy ? `released on a verbal override by ${r.authorizedBy}` : 'released on a verbal override';
  }
  return r.type === 'EXCEPTION' ? 'released as an exception' : 'released';
}

/** "scratch — paint (flagged 2026-06-19 by Aaron S.), released on a verbal override by MK" */
function describeReleasedHold(h: HoldFact): string {
  return `${describeHoldCore(h)}, ${describeRelease(h.release)}`;
}

/**
 * Shape a plate lookup into the tool result. `vehicle === null` means the plate is
 * unknown to the (RLS-scoped) fleet. Active holds lead (they block); released holds
 * trail as context. Empty of both is the happy "nothing on it" answer.
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
      releasedHolds: [],
      summary: `No record of ${plate} in the fleet.`,
    };
  }

  const activeHolds = holds.filter((h) => h.status === 'ACTIVE');
  const releasedHolds = holds.filter((h) => h.status === 'RELEASED');
  const who = describeVehicle(vehicle);
  const base = { found: true as const, plate, vehicle, activeHolds, releasedHolds };

  const activeNoun = activeHolds.length === 1 ? 'hold' : 'holds';
  const activeClause = `${activeHolds.length} active ${activeNoun}: ${activeHolds.map(describeHoldCore).join('; ')}`;
  const releasedClause = `previously ${releasedHolds.map(describeReleasedHold).join('; ')}`;

  if (activeHolds.length > 0 && releasedHolds.length > 0) {
    return { ...base, summary: `${who} — ${activeClause}. Also ${releasedClause}.` };
  }
  if (activeHolds.length > 0) {
    return { ...base, summary: `${who} — ${activeClause}.` };
  }
  if (releasedHolds.length > 0) {
    return { ...base, summary: `${who} — no active hold, but ${releasedClause}.` };
  }
  return { ...base, summary: `${who} — nothing on it. No active or released holds.` };
}
