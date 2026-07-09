// The photos that belong to a proposal drafted at assistant-message `index`: the images
// from the contiguous run of USER turns immediately before it — the ones Effie was
// responding to when she drafted it — NOT the whole conversation.
//
// Without this, a hold confirm swept up EVERY image in the chat (found live 2026-07-08: a
// hail hold on a car got 2 keytag photos from an earlier lookup/registration turn PLUS the
// 2 damage photos, instead of just the damage). Scoping to the prompting turn(s) keeps a
// hold's evidence to the photos actually taken for it. See
// docs/bug-misc-effie-hold-attaches-all-photos.md.

/** Minimal shape — a chat turn with an optional set of attached images. */
interface TurnWithImages {
  role: 'user' | 'assistant';
  images?: string[];
}

export function photosForProposal(messages: readonly TurnWithImages[], index: number): string[] {
  const out: string[] = [];
  // Walk back from just before the proposal, collecting user-turn images until the previous
  // assistant turn (or the start) — the contiguous block Effie was responding to.
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'user') break;
    out.unshift(...(messages[i].images ?? []));
  }
  return out;
}
