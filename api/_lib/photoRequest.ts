// Effie asking the operator for a PHOTO, in context. When she needs an image she calls
// the request_photo tool with the CONTEXT (key tag / damage / lost item / inventory
// sheet); the client renders an inline upload button in her reply and captions the
// attached photo to match. The caption is more than cosmetic — it's the message text
// Effie reads, so "Here's a photo of the key tag" routes her to a register/read, not a
// damage hold. Lives in api/_lib so the server tool and client button share one source.

export type PhotoContext = 'keytag' | 'damage' | 'lost_item' | 'inventory';
export const PHOTO_CONTEXTS: readonly PhotoContext[] = ['keytag', 'damage', 'lost_item', 'inventory'];

const NOUN: Record<PhotoContext, string> = {
  keytag: 'key tag',
  damage: 'damage',
  lost_item: 'lost item',
  inventory: 'inventory sheet',
};

/** The bubble caption for a photo attached in this context ("Here's a photo of the key tag."). */
export function photoCaptionFor(context: PhotoContext): string {
  return `Here's a photo of the ${NOUN[context]}.`;
}

/** The inline upload button's label for a requested context. */
export function photoButtonLabel(context: PhotoContext): string {
  switch (context) {
    case 'keytag': return 'Upload key tag';
    case 'damage': return 'Add damage photo';
    case 'inventory': return 'Upload sheet';
    case 'lost_item': return 'Upload photo';
  }
}
