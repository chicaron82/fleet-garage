// Photo compression, and the three ways it can fail.
//
// ⚠️ THIS FILE USED TO HAVE NO FAILURE PATH AT ALL. `compress` was `new Promise((resolve) => …)`
// with no `reject`, no `img.onerror` and no `reader.onerror` — so a file that could not be decoded
// NEVER SETTLED. The caller awaited forever: no error, no timeout, no console line, a spinner that
// span until the tab closed. That is worse than throwing, because nothing anywhere could notice.
//
// ⭐ AND IT SHIPPED A CORRUPTION. Two stored key-tag photos (LFJ204, 0ET028) are **759-byte 1×1
// JPEGs** — found 2026-08-28 auditing all 574 tags for Aaron. Both records carry a class code and a
// rental class, so the vision READ worked; the file written afterwards was empty. A canvas sized
// from `img.width === 1` produces exactly that. Migration 103 keeps the photo so every scan-created
// record is auditable — "open it, see what the tag actually said" — and for those two cars the
// evidence is gone while the record still claims to hold it.
//
// So: a decode that yields a handful of pixels is a FAILURE, not a small photo. Better to tell him
// the shot didn't take than to store a white square that will be trusted later.
//
// ⚠️ Guard on DECODED DIMENSIONS, never on byte size. Size is a consequence — a legitimately plain
// photo can be small, and the sweep that first read this as "203 of 574 broken" was measuring
// `content-length` from a HEAD request, which Supabase storage answers with a stub. Dimensions are
// the fact; bytes are a rumour.

/** Under this in either axis, nothing survived the decode. A key tag shot at arm's length is ~800px
 *  after scaling and thousands before it; no real photo of anything lands here. Deliberately far
 *  below any plausible subject so it can only ever catch a broken decode, never a bad photo. */
const MIN_DECODED_PX = 16;

export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

function compress(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageDecodeError(`could not read ${file.name || 'the file'}`));
    reader.onload = (e) => {
      const img = new Image();
      // The half that was missing entirely. A corrupt or unsupported file fires this and nothing
      // else — without it the promise simply never settled.
      img.onerror = () => reject(new ImageDecodeError(`could not decode ${file.name || 'the image'}`));
      img.onload = () => {
        if (img.width < MIN_DECODED_PX || img.height < MIN_DECODED_PX) {
          reject(new ImageDecodeError(
            `image decoded to ${img.width}×${img.height} — refusing to store a blank photo`,
          ));
          return;
        }
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new ImageDecodeError('no 2d canvas context available')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a single-subject photo (a bumper, a key tag) to a small JPEG data URL —
 * fast and plenty of detail for one subject.
 *
 * ⚠️ REJECTS with `ImageDecodeError` on an unreadable, undecodable or degenerate file. Every caller
 * must have a visible failure state; a swallowed catch is the same defect wearing a different hat,
 * because a photo that silently never arrives is exactly what this file already did.
 */
export function compressImage(file: File): Promise<string> {
  return compress(file, 800, 0.72);
}

/**
 * Compress a dense DOCUMENT (e.g. a multi-week schedule grid) at higher resolution —
 * ~1568px is Claude vision's full-detail sweet spot, so small text stays legible.
 *
 * ⚠️ Rejects on failure — see `compressImage`.
 */
export function compressDocumentImage(file: File): Promise<string> {
  return compress(file, 1600, 0.85);
}

/**
 * Compress a batch, keeping only the ones that worked.
 *
 * ⭐ EXISTS BECAUSE OF `Promise.all`. Six of the seventeen call sites map a FileList through
 * `Promise.all(files.map(compressImage))`, and `Promise.all` rejects on the FIRST failure — so one
 * unreadable photo in a batch of five would throw away the four that were fine. That is a worse
 * outcome than the bug being fixed: he would lose good evidence because one file was bad.
 *
 * Returns what survived plus how many did not, so the caller can say "3 of 4 added" rather than
 * either lying or discarding everything.
 */
export async function compressBatch(files: readonly File[]): Promise<{ photos: string[]; failed: number }> {
  const settled = await Promise.allSettled(files.map(f => compressImage(f)));
  const photos: string[] = [];
  let failed = 0;
  for (const r of settled) {
    if (r.status === 'fulfilled') photos.push(r.value);
    else failed++;
  }
  return { photos, failed };
}

/** Read a file (e.g. a PDF) to a base64 data URL as-is — no resizing. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * A stored photo URL → the data-URL the key-tag reader takes.
 *
 * ⭐ The re-read path's one piece of IO. FG's tag photos live in Supabase storage under a public
 * URL, and `/api/keytag-read` wants base64 — so a photo already on the record has to make the round
 * trip before it can be read again. Aaron: *"can't it just be re-read and filled out?"*
 *
 * ⚠️ RESOLVES NULL RATHER THAN THROWING. It runs inside a loop over dozens of cars, and one photo
 * that 404s or trips CORS must cost that car and nothing else — a throw here would end the run and
 * leave the rest of the queue untouched with no way to tell how far it got.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
