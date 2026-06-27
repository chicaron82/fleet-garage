// The "Hey FG" copilot's contextual greeting — generated CLIENT-SIDE per module so
// opening the panel costs nothing (no Claude call until the user actually asks).
// Leading tone (Aaron's call): each greeting offers the obvious next action for
// where you are, not a neutral "what can I help with?".

const PROMPTS: Record<string, string> = {
  holds: "you're on Holds. Want to flag a vehicle, or check what's on one?",
  'my-shift': "you're on My Shift. Want your pay estimate, or who's closing with you tonight?",
  schedule: "you're on the Schedule. Who's closing with you tonight, or your shifts this week?",
  'lost-and-found': "you're in Lost & Found. Are we logging a new item?",
  'issue-log': "you're on the Issue Log. Reporting a new issue?",
  'check-in': "you're on Check-in. Want a hand with a vehicle or a checkpoint?",
  'movement-log': "you're on the Movement Log. Looking up where a vehicle's been?",
  audits: "you're on Audits. Want to start one, or look a vehicle up?",
  analytics: "you're on Analytics. Want a hold lookup or who's closing with you tonight?",
  manifest: "you're on the Manifest. Looking up a vehicle?",
  'fleet-master': "you're on Fleet Master. Want to look up or register a vehicle?",
};

const FALLBACK = 'what can I help with? Try "anything on LFJ438?" or "who\'s closing with me tonight?"';

/** A leading, per-module greeting. Free (no API call) — shown when the panel opens. */
export function moduleGreeting(module: string, firstName: string): string {
  const who = firstName.trim() || 'there';
  return `Hi ${who} — ${PROMPTS[module] ?? FALLBACK}`;
}
