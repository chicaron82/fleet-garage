// A drafted action the AI proposes but never writes. The proxy builds one; the
// client renders it as a confirm card and only on a tap calls the real
// addHold/addVehicle/addLostFoundItem. Three kinds: 'hold' (existing vehicle),
// 'register_and_hold' (unknown plate → register it, then hold), and 'lost_item'
// (log a found item — see ./lostItemProposal). This module owns the shared Proposal
// union the client imports; each kind's own builder/describe lives with its type.
import { describeLostItemProposal, type LostItemProposal } from './lostItemProposal.js';

/** The vehicle a 'hold' proposal targets — already resolved to a real fleet row. */
export interface ProposalVehicle {
  vehicleId: string;
  plate: string;
  /** Human label, e.g. "Unit 1234 · 2025 Hyundai Tucson (Gray)". */
  label: string;
}

/** The vehicle a 'register_and_hold' proposal will CREATE — not yet in the fleet. */
export interface NewVehicle {
  unitNumber: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

/** A hold on an existing vehicle the user is being asked to confirm. */
export interface HoldProposal {
  kind: 'hold';
  vehicle: ProposalVehicle;
  holdType: string; // 'damage' | 'mechanical' | 'detail' | ...
  damageDescription: string;
}

/** Register an unknown plate, then immediately hold it — one confirm. */
export interface RegisterHoldProposal {
  kind: 'register_and_hold';
  newVehicle: NewVehicle;
  holdType: string;
  damageDescription: string;
}

export type Proposal = HoldProposal | RegisterHoldProposal | LostItemProposal;

/** Build a hold proposal from a resolved vehicle. Pure — no I/O, no write. */
export function buildHoldProposal(
  vehicle: ProposalVehicle,
  holdType: string,
  damageDescription: string,
): HoldProposal {
  return { kind: 'hold', vehicle, holdType, damageDescription };
}

/** Build a register-and-hold proposal for an unknown plate. Pure — no write. */
export function buildRegisterHoldProposal(
  newVehicle: NewVehicle,
  holdType: string,
  damageDescription: string,
): RegisterHoldProposal {
  return { kind: 'register_and_hold', newVehicle, holdType, damageDescription };
}

/** "Unit 1234 · 2025 Hyundai Tucson (Gray)" — for a not-yet-registered vehicle. */
export function describeNewVehicle(v: NewVehicle): string {
  const veh = [v.year, v.make, v.model].filter(Boolean).join(' ');
  const head = [v.unitNumber ? `Unit ${v.unitNumber}` : '', veh].filter(Boolean).join(' · ');
  const base = head || v.plate;
  return v.color ? `${base} (${v.color})` : base;
}

/** A short one-liner the AI/tool can echo back. */
export function describeProposal(p: Proposal): string {
  if (p.kind === 'lost_item') return `log found item: ${describeLostItemProposal(p)}`;
  const desc = p.damageDescription.trim() ? ` — ${p.damageDescription.trim()}` : '';
  if (p.kind === 'register_and_hold') {
    return `register ${describeNewVehicle(p.newVehicle)} + ${p.holdType} hold${desc}`;
  }
  return `${p.holdType} hold on ${p.vehicle.label}${desc}`;
}
