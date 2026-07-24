// Effie executors — note drafts: memory, next-shift reminder, dated event, navigation offer.
// All pure (no DB) — each returns a proposal the client confirms. Split from effieExecutors.ts
// (2026-07-24, pure move).
import { buildMemoryProposal, describeMemoryProposal, type MemoryProposal } from '../memoryProposal.js';
import { buildReminderProposal, describeReminderProposal, type ReminderProposal } from '../reminderProposal.js';
import { buildNavigateProposal, type NavigateProposal } from '../navProposal.js';
import { buildEventProposal, type EventProposal } from '../eventProposal.js';

/** Draft a memory to save about the operator. Pure — the write happens on the
 *  client's confirm tap (insert into effie_memory), never here. */
export function executeProposeMemory(input: { content?: string }): { toolResult: string; proposal: MemoryProposal | null } {
  const proposal = buildMemoryProposal({ content: input.content ?? null });
  if (!proposal) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the specific thing to remember first — ask the operator what to note.' }),
    };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeMemoryProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted for them to confirm',
    }),
  };
}

/** Draft a next-shift whiteboard reminder. Pure — the write (a shift_board note filed
 *  under the operator's next shift-day) happens on the client's confirm tap, never here. */
export function executeProposeReminder(input: { text?: string }): { toolResult: string; proposal: ReminderProposal | null } {
  const text = (input.text ?? '').trim();
  if (!text) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the reminder text first — ask the operator what to note for next shift.' }),
    };
  }
  const proposal = buildReminderProposal(text);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeReminderProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted to land on their next shift',
    }),
  };
}

/**
 * Offer to navigate the user to a screen. NEVER writes or navigates — it returns a
 * confirm card the client renders; only the user's tap navigates (and even then, only
 * changes screens, no data write). Safe by construction.
 */
export function executeProposeNavigation(input: { destination?: string }): { toolResult: string; proposal: NavigateProposal | null } {
  const proposal = buildNavigateProposal(input.destination ?? '');
  if (!proposal) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Unknown destination — only offer a known screen.' }) };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      offered: proposal.label,
      awaiting: 'user confirmation — a confirm card is shown; do NOT say you navigated, just offer to take them there',
    }),
  };
}


/** Draft a dated note ("staff BBQ tomorrow at 12:30") for My Day to surface on the day.
 *  The model resolves the date against the "Today is …" line the proxy injects, so this only
 *  validates the shape — a bad/missing date is sent back rather than guessed at here. */
export function executeProposeEvent(
  input: { title?: string; date?: string; time?: string },
): { toolResult: string; proposal: EventProposal | null } {
  const title = (input.title ?? '').trim();
  const date = (input.date ?? '').trim();
  if (!title) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Need what the event IS — ask the operator.' }) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Need the date as YYYY-MM-DD (resolve "tomorrow" against the Today line).' }) };
  }
  const rawTime = (input.time ?? '').trim();
  // Accept H:MM / HH:MM; anything else is treated as no time (an all-day note) rather than
  // inventing a clock the operator never said.
  const time = /^\d{1,2}:\d{2}$/.test(rawTime) ? rawTime.padStart(5, '0') : null;
  const proposal = buildEventProposal(title, date, time);
  return {
    proposal,
    toolResult: JSON.stringify({ ok: true, drafted: { title: proposal.title, date: proposal.date, time: proposal.time } }),
  };
}
