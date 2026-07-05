// A note the user asks Effie to leave on the shift whiteboard for their NEXT shift
// (e.g. "remind me to pack the airport tomorrow"). Drafted by the proxy, written
// only on the confirm tap — the client calls addWhiteboardReminder, which files it
// on the shift_board section targeted at the next shift-day so it surfaces then and
// auto-clears the shift after.

/** A reminder Effie will leave on the whiteboard for the user's next shift. */
export interface ReminderProposal {
  kind: 'reminder';
  /** The reminder text, in the user's words. */
  text: string;
}

/** Build a reminder proposal. Pure — no I/O, no write. */
export function buildReminderProposal(text: string): ReminderProposal {
  return { kind: 'reminder', text: text.trim() };
}

/** A short one-liner the AI/tool can echo back. */
export function describeReminderProposal(p: ReminderProposal): string {
  return `leave a next-shift reminder: ${p.text}`;
}
