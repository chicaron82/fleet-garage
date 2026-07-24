// Effie executors — module reads + lost-item draft: lost & found search, open facility issues,
// the held-vehicles list, and drafting a found item. Split from effieExecutors.ts (2026-07-24).
import type { SupabaseClient } from '@supabase/supabase-js';
import { scheduleDateLabel } from '../effieHelpers.js';
import { formatLostFound, formatIssues, type LostItem, type IssueRow } from '../moduleReads.js';
import { buildLostItemProposal, describeLostItemProposal, type LostItemProposal } from '../lostItemProposal.js';

/** Read-only: current (unreturned) lost & found items, optionally text-matched. */
export async function executeSearchLostFound(supabase: SupabaseClient, input: { query?: string; status?: string }): Promise<string> {
  let q = supabase
    .from('lost_found')
    .select('description, location, found_at, license_plate, resolved_at')
    .order('found_at', { ascending: false });
  if (input.status !== 'all') q = q.is('resolved_at', null);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  const query = (input.query ?? '').trim().toLowerCase();
  if (query) {
    const terms = query.split(/\s+/);
    rows = rows.filter((r) => {
      const hay = `${r.description ?? ''} ${r.location ?? ''} ${r.license_plate ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  const items: LostItem[] = rows.map((r) => ({
    description: r.description ?? '',
    location: r.location ?? null,
    foundLabel: scheduleDateLabel((r.found_at ?? '').slice(0, 10)),
    plate: r.license_plate ?? null,
  }));
  return JSON.stringify({ count: items.length, summary: formatLostFound(items, query || undefined) });
}

/** Read-only: open (uncleared) facility issues from the Issue Log. */
export async function executeLookupIssues(supabase: SupabaseClient, input: { status?: string }): Promise<string> {
  let q = supabase
    .from('facility_issues')
    .select('title, severity, reported_at, cleared_at')
    .order('reported_at', { ascending: false });
  if (input.status !== 'all') q = q.is('cleared_at', null);
  const { data, error } = await q;
  if (error) throw error;
  const items: IssueRow[] = (data ?? []).map((r) => ({
    title: r.title,
    severity: r.severity,
    reportedLabel: scheduleDateLabel((r.reported_at ?? '').slice(0, 10)),
  }));
  return JSON.stringify({ count: items.length, summary: formatIssues(items) });
}

/** Read-only: vehicles currently on an ACTIVE hold, grouped by vehicle with their
 *  reasons — the "what's held and why" / "held for maintenance" list management asks
 *  for. Reads live from the holds table, so it answers across any day (the Movement
 *  Log view is day-scoped; this is not). Archived/out-of-fleet vehicles are dropped. */
export async function executeLookupHeld(supabase: SupabaseClient): Promise<string> {
  const { data: holds, error } = await supabase
    .from('holds')
    .select('vehicle_id, hold_type, mechanical_sub_type, damage_description, flagged_at')
    .eq('status', 'ACTIVE')
    .order('flagged_at', { ascending: true });
  if (error) throw error;

  const ids = [...new Set((holds ?? []).map((h) => h.vehicle_id))];
  const veh = new Map<string, string>(); // vehicleId → display id (unit ?? plate)
  if (ids.length > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, unit_number, license_plate, archived_at')
      .in('id', ids)
      .is('archived_at', null);
    for (const v of vehicles ?? []) veh.set(v.id, v.unit_number ?? v.license_plate ?? 'Unknown');
  }

  const byVehicle = new Map<string, string[]>();
  for (const h of holds ?? []) {
    const label = veh.get(h.vehicle_id);
    if (!label) continue; // archived / not found — out of fleet
    const reason =
      (h.damage_description ?? '').trim() ||
      [h.hold_type, h.mechanical_sub_type].filter(Boolean).join(' · ') ||
      'held';
    (byVehicle.get(label) ?? byVehicle.set(label, []).get(label)!).push(reason);
  }
  const held = [...byVehicle.entries()].map(([id, reasons]) => `${id} — ${reasons.join('; ')}`);
  return JSON.stringify({ count: held.length, held });
}

/**
 * Draft a found item for lost & found — NEVER writes. The proposal goes to the
 * client as a confirm card, and only a user tap calls the real addLostFoundItem
 * (which resolves the plate, stamps found_by/found_at, and uploads any photos).
 * Pure — no DB read needed; the AI parsed the item from the user's words.
 */
export function executeProposeLostItem(input: {
  description?: string;
  location?: string;
  license_plate?: string;
  notes?: string;
}): { toolResult: string; proposal: LostItemProposal | null } {
  const description = (input.description ?? '').trim();
  if (!description) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need a short description of the item first — ask the user what it is.' }),
    };
  }
  const proposal = buildLostItemProposal({
    description,
    location: input.location ?? null,
    licensePlate: input.license_plate ?? null,
    notes: input.notes ?? null,
  });
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeLostItemProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted for them to confirm',
    }),
  };
}
