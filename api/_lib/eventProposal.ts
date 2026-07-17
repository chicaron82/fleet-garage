// A dated note the user asks Effie to remember for them ("staff BBQ tomorrow at 12:30").
// Drafted by the proxy, written only on the confirm tap — the client inserts into
// personal_events (migration 099), and My Day surfaces it in "Heads up today" ON that date.
//
// The THIRD dated-note kind, deliberately distinct from its two neighbours:
//   * ReminderProposal — a next-SHIFT task on the whiteboard, auto-clears after that shift
//   * MemoryProposal   — a durable FACT about the operator, no date at all
//   * EventProposal    — an event on a specific DATE (+ optional time), surfaces that day
// Scope guardrail: a handful of dated notes, never a calendar (no recurrence, no invites).

/** An event Effie will remember for a specific date, surfaced on My Day that day. */
export interface EventProposal {
  kind: 'event';
  /** What it is, in the user's words — the chip title ("Staff BBQ"). */
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** 24h 'HH:MM', or null for an all-day note. */
  time: string | null;
}

/** Build an event proposal. Pure — no I/O, no write. */
export function buildEventProposal(title: string, date: string, time: string | null): EventProposal {
  return { kind: 'event', title: title.trim(), date, time: time?.trim() || null };
}

/** A short one-liner the AI/tool can echo back. */
export function describeEventProposal(p: EventProposal): string {
  return `remember "${p.title}" on ${p.date}${p.time ? ` at ${p.time}` : ''}`;
}
