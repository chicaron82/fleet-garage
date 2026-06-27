// A drafted hold the AI proposes but never writes. The proxy builds one from a
// resolved vehicle; the client renders it as a confirm card and only on a tap
// calls the real addHold. Keeping the type + builder here (pure, tested) means
// the proposal shape is one source of truth the client imports as a type.

/** The vehicle a proposed hold targets — already resolved to a real fleet row. */
export interface ProposalVehicle {
  vehicleId: string;
  plate: string;
  /** Human label, e.g. "Unit 1234 · 2025 Hyundai Tucson (Gray)". */
  label: string;
}

/** A hold the user is being asked to confirm. `kind` leaves room for register+hold later. */
export interface HoldProposal {
  kind: 'hold';
  vehicle: ProposalVehicle;
  holdType: string; // 'damage' | 'mechanical' | 'detail' | ...
  damageDescription: string;
}

/** Build a hold proposal from a resolved vehicle. Pure — no I/O, no write. */
export function buildHoldProposal(
  vehicle: ProposalVehicle,
  holdType: string,
  damageDescription: string,
): HoldProposal {
  return { kind: 'hold', vehicle, holdType, damageDescription };
}

/** A short one-liner the AI/tool can echo back: "damage hold on Unit 1234 — bumper scuff". */
export function describeProposal(p: HoldProposal): string {
  const desc = p.damageDescription.trim() ? ` — ${p.damageDescription.trim()}` : '';
  return `${p.holdType} hold on ${p.vehicle.label}${desc}`;
}
