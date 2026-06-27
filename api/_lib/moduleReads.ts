// Pure formatters for the copilot's Phase-B read tools: my shifts, lost & found,
// facility issues. The proxy runs the RLS-scoped queries + pre-formats dates; these
// shape the rows into a human line. No I/O — unit-tested without Supabase.
import { describeShiftType } from './scheduleSummary.js';

// ── My shift (own upcoming shifts) ────────────────────────────────────────────
export interface MyShiftRow {
  dateLabel: string; // pre-formatted, e.g. "Jun 26"
  shiftType: string;
}
const WORKED = new Set(['opening', 'mid', 'closing']);

export function formatMyShifts(rows: MyShiftRow[]): string {
  const worked = rows.filter((r) => WORKED.has(r.shiftType));
  if (worked.length === 0) return "You're not scheduled to work in this window.";
  const list = worked.map((r) => `${describeShiftType(r.shiftType)} ${r.dateLabel}`).join(', ');
  const hours = worked.length * 8;
  return `You're working ${worked.length} shift${worked.length === 1 ? '' : 's'}: ${list} (~${hours}h scheduled).`;
}

// ── Lost & Found ──────────────────────────────────────────────────────────────
export interface LostItem {
  description: string;
  location: string | null;
  foundLabel: string; // pre-formatted found date
  plate: string | null;
}

export function formatLostFound(items: LostItem[], query?: string): string {
  if (items.length === 0) {
    return query ? `Nothing in lost & found matching "${query}".` : 'Nothing in lost & found right now.';
  }
  const lines = items.slice(0, 8).map((i) => {
    const where = i.location ? ` (${i.location})` : '';
    const plate = i.plate ? ` — plate ${i.plate}` : '';
    return `${i.description || 'item'}${where}${plate}, found ${i.foundLabel}`;
  });
  const more = items.length > 8 ? ` (+${items.length - 8} more)` : '';
  const n = items.length;
  return `${n} item${n === 1 ? '' : 's'} in lost & found: ${lines.join('; ')}${more}.`;
}

// ── Facility issues ───────────────────────────────────────────────────────────
export interface IssueRow {
  title: string;
  severity: string;
  reportedLabel: string;
}

export function formatIssues(items: IssueRow[]): string {
  if (items.length === 0) return 'No open facility issues.';
  const lines = items.slice(0, 8).map((i) => `${i.title} [${i.severity}], reported ${i.reportedLabel}`);
  const more = items.length > 8 ? ` (+${items.length - 8} more)` : '';
  const n = items.length;
  return `${n} open issue${n === 1 ? '' : 's'}: ${lines.join('; ')}${more}.`;
}
