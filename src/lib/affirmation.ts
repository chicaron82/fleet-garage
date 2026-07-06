// Recognizing a plain "yes, do it" so a TYPED confirmation can stand in for tapping a
// proposal's confirm card — a resilience fallback for when the card doesn't render (or
// the operator would just rather type). EXACT-match only: a qualified reply like "yes
// but change the colour" is NOT a bare confirmation and must go to Effie to handle, so
// we never fire on a conditional yes.
const AFFIRMATIONS = new Set([
  'confirm', 'confirmed', 'confirm it', 'confirm please', 'confirm that',
  'yes', 'yes please', 'yeah', 'yep', 'yup',
  'ok', 'okay', 'sure', 'do it', 'do it please', 'add it', 'log it', 'send it',
  'go', 'go ahead', 'proceed',
]);

/** True when the text is a bare, unqualified confirmation ("confirm", "yes", "do it"). */
export function isAffirmation(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
  return AFFIRMATIONS.has(t);
}
