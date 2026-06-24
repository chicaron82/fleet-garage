import { supabase } from './supabase';
import type { Profile, UserRole, BranchId } from '../types';

export type PromotionInput = { rosterId: string; employeeId: string };
export type PromotionCheck = { ok: true; employeeId: string } | { ok: false; error: string };

/**
 * Validate a manager's promotion input before it hits the RPC. Pure — the real
 * existence checks (roster ghost present? auth account exists? id free?) live in
 * the SECURITY DEFINER function (migration 085); this just catches the obvious
 * input mistakes with a friendly message.
 */
export function validatePromotionInput({ rosterId, employeeId }: PromotionInput): PromotionCheck {
  const trimmed = employeeId.trim();
  if (!rosterId) return { ok: false, error: 'No roster staffer selected.' };
  if (!trimmed)  return { ok: false, error: 'Enter the staffer’s real employee ID.' };
  if (/^ROSTER-/i.test(trimmed)) {
    return { ok: false, error: 'That’s the placeholder ID — enter their real employee ID.' };
  }
  return { ok: true, employeeId: trimmed };
}

/**
 * Promote a roster ghost into a real FG account via the `promote_roster_staff`
 * RPC (migration 085): it finds the out-of-band auth account by the employee-id
 * email, carries the ghost's schedule history (its only data is `shifts`) over to
 * the real account, and retires the ghost — all atomically. Throws the RPC's
 * message on any failure (no account yet, id taken, not a ghost, …).
 */
export async function promoteRosterStaff(rosterId: string, employeeId: string): Promise<Profile> {
  const check = validatePromotionInput({ rosterId, employeeId });
  if (!check.ok) throw new Error(check.error);

  const { data, error } = await supabase.rpc('promote_roster_staff', {
    p_roster_id:   rosterId,
    p_employee_id: check.employeeId,
  });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) throw new Error('Promotion returned no profile.');
  return {
    id:         row.id as string,
    employeeId: row.employee_id as string,
    name:       row.name as string,
    role:       row.role as UserRole,
    branchId:   row.branch_id as BranchId,
    rosterOnly: (row.roster_only as boolean) ?? false,
  };
}
