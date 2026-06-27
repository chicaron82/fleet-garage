// Effie's contextual greeting — generated CLIENT-SIDE per module so opening the
// panel costs nothing (no Claude call until the user actually asks). Each prompt
// leads with the obvious next action for where you are, in Effie's voice.

const PROMPTS: Record<string, string> = {
  holds: "you're on Holds — flag a vehicle, or check what's sitting on one?",
  'my-shift': "you're on My Shift — want your pay estimate or who you're closing with tonight?",
  schedule: "you're on the Schedule — who's closing with you tonight, or what does your week look like?",
  'lost-and-found': "you're in Lost & Found — logging something new?",
  'issue-log': "you're on the Issue Log — reporting something?",
  'check-in': "you're at Check-in — need a hand with a vehicle or a checkpoint?",
  'movement-log': "you're on the Movement Log — looking up where a unit's been?",
  audits: "you're on Audits — want to run one, or look a unit up?",
  analytics: "you're on Analytics — hold lookup or who's closing with you tonight?",
  manifest: "you're on the Manifest — looking up a unit?",
  'fleet-master': "you're on Fleet Master — looking up or registering a unit?",
};

const FALLBACK = 'what can I help with? Try "anything on LFJ438?" or "who\'s closing with me tonight?"';

/** A leading, per-module greeting. Free (no API call) — shown when the panel opens. */
export function moduleGreeting(module: string, firstName: string): string {
  const who = firstName.trim() || 'there';
  return `Effie here, ${who} — ${PROMPTS[module] ?? FALLBACK}`;
}
