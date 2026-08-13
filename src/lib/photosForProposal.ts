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

/**
 * The single most-recent operator-uploaded image before the proposal at `index`, reaching back
 * PAST Effie's turns. For a register/backfill the photo IS the key tag — and a *conversational*
 * draft (upload the tag, then a few Q&A turns to fill a missing year or correct the class) leaves
 * that photo several turns back, behind intervening assistant replies. `photosForProposal`'s
 * contiguous-block scope stops at those replies and misses it, so the tag never lands on the car
 * (found live 2026-08-13: a handwritten-tag register via Effie saved no key-tag photo). Returns []
 * when the operator uploaded no image at all.
 */
export function keytagPhotoForProposal(messages: readonly TurnWithImages[], index: number): string[] {
  for (let i = index - 1; i >= 0; i--) {
    const imgs = messages[i]?.role === 'user' ? messages[i].images : undefined;
    if (imgs && imgs.length > 0) return [imgs[imgs.length - 1]];
  }
  return [];
}

/**
 * Photo scope for a proposal CONFIRM, chosen by the proposal's kind — the two kinds carry opposite
 * photo semantics:
 *  - register_vehicle / update_vehicle → the photo is the KEY TAG; use the reach-back scope so a
 *    conversational register still attaches it (via attachKeytagPhotoIfMissing on confirm).
 *  - everything else (holds, register_and_hold) → the photo is DAMAGE evidence; keep the tight
 *    contiguous scope so a hold never sweeps up an earlier key-tag photo
 *    (bug-misc-effie-hold-attaches-all-photos.md).
 */
export function photosForProposalConfirm(
  kind: string,
  messages: readonly TurnWithImages[],
  index: number,
): string[] {
  if (kind === 'register_vehicle' || kind === 'update_vehicle') {
    return keytagPhotoForProposal(messages, index);
  }
  return photosForProposal(messages, index);
}
