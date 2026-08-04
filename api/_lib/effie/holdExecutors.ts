// Effie executors — hold/registration domain: draft-a-hold, register-and-hold, backfill-and-hold,
// register-only, plus the blanks-only backfill helper. All NEVER write — each returns a proposal
// the client confirms. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeVehicle } from '../vehicleSummary.js';
import { resolveVehicleRow, toVehicleFact } from '../effieHelpers.js';
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  buildRegisterVehicleProposal,
  buildUpdateAndHoldProposal,
  describeProposal,
  type HoldProposal,
  type RegisterHoldProposal,
  type RegisterVehicleProposal,
  type UpdateAndHoldProposal,
  type VehicleFieldFill,
} from '../holdProposal.js';

/** The six identity fields every register-path proposal needs before it can be drafted. */
const REQUIRED_REGISTER_FIELDS = ['plate', 'unit_number', 'make', 'model', 'year', 'color'] as const;
type RegisterFieldInput = { plate?: string; unit_number?: string; make?: string; model?: string; year?: number; color?: string };

/**
 * Shared missing-field guard for the register paths (register-and-hold, register-only): returns a
 * ready-to-return tool result listing whatever is still blank, or `null` when every field is
 * present. The per-caller `hint` tails the message ("Ask the user…" vs "Read them off the key
 * tag…"). Pure — deduped from two verbatim copies (ticket-effie-require-vehicle-fields-dedupe).
 */
export function missingRegisterFieldsResult(input: RegisterFieldInput, hint: string): string | null {
  const missing = REQUIRED_REGISTER_FIELDS.filter(
    (k) => input[k] === undefined || input[k] === null || `${input[k]}`.trim() === '',
  );
  return missing.length > 0
    ? JSON.stringify({ ok: false, reason: `Still need: ${missing.join(', ')}. ${hint}` })
    : null;
}

/**
 * Draft a hold for an EXISTING vehicle — resolves it and builds a proposal. NEVER
 * writes: the proposal goes to the client as a confirm card, and only a user tap
 * calls the real addHold. The tool result tells the model the draft is pending so
 * it won't claim the hold was created.
 */
export async function executeProposeHold(
  supabase: SupabaseClient,
  input: { plate?: string; hold_type?: string; damage_description?: string },
): Promise<{ toolResult: string; proposal: HoldProposal | null }> {
  const match = await resolveVehicleRow(supabase, input.plate ?? '');
  if (!match) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `No vehicle on record for "${input.plate ?? ''}". It would have to be registered before a hold can be opened.`,
      }),
    };
  }
  const proposal = buildHoldProposal(
    { vehicleId: match.id, plate: match.license_plate, label: describeVehicle(toVehicleFact(match)) },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown to the user; do NOT say the hold is created, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft REGISTER + hold for an UNKNOWN plate — the AI gathered the vehicle details.
 * NEVER writes: the proposal goes to the client, and only a confirm tap calls the
 * real addVehicle then addHold. Refuses if the plate is already in the fleet (use
 * propose_hold instead).
 */
export async function executeProposeRegisterHold(
  supabase: SupabaseClient,
  input: {
    plate?: string;
    unit_number?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    hold_type?: string;
    damage_description?: string;
  },
): Promise<{ toolResult: string; proposal: RegisterHoldProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Use a normal hold, not registration.`,
      }),
    };
  }
  const missingResult = missingRegisterFieldsResult(input, 'Ask the user for these before proposing.');
  if (missingResult) return { proposal: null, toolResult: missingResult };
  const proposal = buildRegisterHoldProposal(
    {
      unitNumber: `${input.unit_number}`.trim(),
      plate: `${input.plate}`.trim().toUpperCase(),
      make: `${input.make}`.trim(),
      model: `${input.model}`.trim(),
      year: Number(input.year),
      color: `${input.color}`.trim(),
    },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered/held, just that it is drafted for them to confirm',
    }),
  };
}

/** The existing fleet fields a backfill reads against (the subset resolveVehicleRow returns). */
type VehicleIdentityRow = { unit_number: string | null; make: string | null; model: string | null; year: number | null; color: string | null };
/** The key-tag values a backfill may draw from. */
type KeytagIdentity = { unit_number?: string; make?: string; model?: string; year?: number; color?: string };

/**
 * Blanks-only backfill: a field is filled ONLY when the existing row is blank AND the key tag
 * read a value — never overwrites a known field (the resolveKeytag backfill principle). Pure,
 * so the drop-n-go partial-vehicle rule is tested without a Supabase mock.
 */
export function computeBlankFills(existing: VehicleIdentityRow, read: KeytagIdentity): VehicleFieldFill[] {
  const blankStr = (v: unknown) => v === undefined || v === null || `${v}`.trim() === '';
  const fills: VehicleFieldFill[] = [];
  if (blankStr(existing.unit_number) && read.unit_number?.trim()) fills.push({ field: 'unitNumber', value: read.unit_number.trim() });
  if (blankStr(existing.make) && read.make?.trim()) fills.push({ field: 'make', value: read.make.trim() });
  if (blankStr(existing.model) && read.model?.trim()) fills.push({ field: 'model', value: read.model.trim() });
  if (!existing.year && read.year) fills.push({ field: 'year', value: Number(read.year) });
  if (blankStr(existing.color) && read.color?.trim()) fills.push({ field: 'color', value: read.color.trim() });
  return fills;
}

/**
 * Draft BACKFILL + hold for a vehicle ALREADY on record whose identity is partial — the
 * drop-n-go damage case where the key tag also fills blanks the fleet was missing. NEVER
 * writes: the confirm tap runs updateVehicleFields then addHold. Blanks-only — a field is
 * filled ONLY if the existing row is blank AND the key tag read a value (never overwrites a
 * known field). Refuses if the plate isn't on record (use propose_register_and_hold instead).
 */
export async function executeProposeUpdateAndHold(
  supabase: SupabaseClient,
  input: {
    plate?: string;
    unit_number?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    hold_type?: string;
    damage_description?: string;
  },
): Promise<{ toolResult: string; proposal: UpdateAndHoldProposal | null }> {
  const match = await resolveVehicleRow(supabase, input.plate ?? '');
  if (!match) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `No vehicle on record for "${input.plate ?? ''}". Use propose_register_and_hold to register it new + hold.`,
      }),
    };
  }
  const fills = computeBlankFills(match, input);
  const proposal = buildUpdateAndHoldProposal(
    match.id,
    match.license_plate,
    fills,
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is filled/held, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft a register-ONLY (new to fleet, no hold) for a plate not yet on record.
 * NEVER writes: the client calls addVehicle on the confirm tap. Mirrors the
 * register-and-hold guards (already-on-record, missing fields) minus the hold.
 */
export async function executeProposeRegisterVehicle(
  supabase: SupabaseClient,
  input: { plate?: string; unit_number?: string; make?: string; model?: string; year?: number; color?: string },
): Promise<{ toolResult: string; proposal: RegisterVehicleProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Nothing to register.`,
      }),
    };
  }
  const missingResult = missingRegisterFieldsResult(input, 'Read them off the key tag or ask the user before proposing.');
  if (missingResult) return { proposal: null, toolResult: missingResult };
  // Tesla → the confirm card asks for cable/adapter at intake. Lowercase compare so
  // "TESLA"/"tesla" from a class-code lookup all resolve (mirrors ev-detection's isTeslaMake).
  const isTesla = `${input.make ?? ''}`.trim().toLowerCase() === 'tesla';
  const proposal = buildRegisterVehicleProposal(
    {
      unitNumber: `${input.unit_number}`.trim(),
      plate: `${input.plate}`.trim().toUpperCase(),
      make: `${input.make}`.trim(),
      model: `${input.model}`.trim(),
      year: Number(input.year),
      color: `${input.color}`.trim(),
    },
    isTesla,
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered, just that it is drafted for them to confirm',
    }),
  };
}
