/**
 * ⚠️⚠️⚠️ THE BOARD PHOTO MUST SURVIVE AN EDIT — and it did not, for about six hours.
 *
 * `970593d` made the logged hand-off card tappable to edit and seeded the form's `photo` state with
 * the stored photo URL. `submitHandoff` treats `photo` as fresh base64 and uploads it to
 * `handoff/{branch}-{date}-{user}.jpg` — the SAME path the original lives at. So an edit either
 * saved with no photo, or overwrote the real image with a garbage blob. Found at /reflect; the
 * shipping verification used a hand-off with no photo and never touched this path.
 */
import { describe, expect, it } from 'vitest';
import { planHandoffPhoto } from '../../src/lib/handoffPhoto';

const URL_ = 'https://gugxedtqvuhlwllyqpec.supabase.co/storage/v1/object/public/shift-logs/handoff/YWG-2026-09-16-u.jpg';
const B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD';

describe('planHandoffPhoto', () => {
  it('uploads a freshly captured photo', () => {
    expect(planHandoffPhoto(B64, null)).toEqual({ kind: 'upload', base64: B64 });
  });

  it('⭐ an edit with no new photo KEEPS the existing one — the defect this file exists for', () => {
    // A hand-off INSERTS a new row every save; the closing log's "omit the column" trick only works
    // on an upsert. Without an explicit carry-forward the edited row saves photo_url = null.
    expect(planHandoffPhoto(null, URL_)).toEqual({ kind: 'keep', url: URL_ });
  });

  it('a new photo on an edit REPLACES the old one', () => {
    expect(planHandoffPhoto(B64, URL_)).toEqual({ kind: 'upload', base64: B64 });
  });

  it('⛔ a URL is never uploaded, whoever passed it — the shipped mistake becomes harmless', () => {
    // The exact bug: the form put the stored URL where base64 belonged. Uploading it decodes garbage
    // and overwrites the original at the same storage key.
    expect(planHandoffPhoto(URL_, null)).toEqual({ kind: 'keep', url: URL_ });
    expect(planHandoffPhoto(URL_, URL_)).toEqual({ kind: 'keep', url: URL_ });
  });

  it('no photo anywhere is an honest null, not an empty string', () => {
    expect(planHandoffPhoto(null, null)).toEqual({ kind: 'keep', url: null });
    expect(planHandoffPhoto('   ', undefined)).toEqual({ kind: 'keep', url: null });
  });
});
