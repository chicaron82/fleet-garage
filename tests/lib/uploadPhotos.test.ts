import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐⭐ THE UPLOAD HALF OF THE SILENCE (docs/September/ticket-photos-that-never-uploaded.md).
// A photo that cannot be READ has said so since `2eb56cb`'s `compressBatch`. A photo that could not
// be UPLOADED said nothing: `addHold` filtered the nulls out and wrote the hold with whatever
// survived. Found on pass two of the batch-register removal, 2026-09-19 — Aaron: *"Would you mind
// looking into that historical bug?"*
//
// ⚠️ `uploadPhoto` does not throw on failure (its 15s timeout RESOLVES a `{ error }`), so
// `Promise.all` was never losing the batch — the loss was the `.filter(url => url !== null)` that
// followed it, in silence.
//
// The stub is the STORAGE layer, deliberately: `uploadPhotos` calls `uploadPhoto` inside its own
// module, where a module mock could not reach it. Stubbing what the module talks to keeps the real
// path (base64 → blob → upload → public URL) under test.

const attempts: string[] = [];                       // every upload attempt, by photo body
const byPath = new Map<string, string>();            // storage path → photo body
let failWhile: (body: string, attempt: number) => boolean = () => false;

const photo = (body: string) => `data:image/jpeg;base64,${Buffer.from(body).toString('base64')}`;
const countOf = (body: string) => attempts.filter(a => a === body).length;

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => {
          const body = await blob.text();
          attempts.push(body);
          if (failWhile(body, countOf(body))) return { error: { message: 'Upload timeout' } };
          byPath.set(path, body);
          return { error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${byPath.get(path)}` } }),
      }),
    },
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

const { uploadPhotos } = await import('../../src/lib/garage-uploads');

beforeEach(() => {
  attempts.length = 0;
  byPath.clear();
  failWhile = () => false;
});

describe('uploadPhotos', () => {
  it('returns every URL when they all land, and reports nothing failed', async () => {
    const r = await uploadPhotos([photo('a'), photo('b'), photo('c')], 'h1');
    expect(r.urls).toEqual(['https://cdn/a', 'https://cdn/b', 'https://cdn/c']);
    expect(r.failed).toBe(0);
    expect(r.failedPhotos).toEqual([]);
  });

  // ⚠️ THE DEFECT ITSELF. Before this helper, one bad upload left the hold holding two photos and
  // the operator holding a belief. The count is the whole fix.
  it('⚠️ reports the ones that never landed instead of dropping them silently', async () => {
    failWhile = body => body === 'b';
    const r = await uploadPhotos([photo('a'), photo('b'), photo('c')], 'h1');
    expect(r.urls).toEqual(['https://cdn/a', 'https://cdn/c']);
    expect(r.failed).toBe(1);
    expect(r.failedPhotos).toEqual([photo('b')]);    // handed back, not merely counted
  });

  // ⭐ ONE RETRY. The dominant failure at the lot is a 15s timeout on a weak signal — transient,
  // and a second attempt on a fresh path is the cheapest thing that actually recovers it.
  it('⭐ retries a failure once, and a photo that works the second time is not a failure', async () => {
    failWhile = (body, attempt) => body === 'b' && attempt === 1;
    const r = await uploadPhotos([photo('a'), photo('b'), photo('c')], 'h1');
    expect(r.failed).toBe(0);
    expect(r.urls).toHaveLength(3);
    expect(countOf('b')).toBe(2);
  });

  it('⚠️ stops at two attempts — a dead connection must not hold a damage form hostage', async () => {
    failWhile = body => body === 'b';
    await uploadPhotos([photo('a'), photo('b'), photo('c')], 'h1');
    expect(countOf('b')).toBe(2);
    expect(countOf('a')).toBe(1);                    // the ones that worked are never re-sent
  });

  // ⚠️⚠️ THE TRAP INSIDE THE RETRY, and the reason results are written back BY INDEX.
  // `useNewHold` pins the card photo with `coverPhotoUrlFor(pinnedPhotoIndex, photos, photoUrls)` —
  // it lines the URLs up against the photos he chose from. A retry that appended its successes at
  // the END would keep the counts equal (so the length guard passes) and pin the WRONG picture:
  // a silent wrong answer in place of the silent loss this fix is about.
  it('⚠️⚠️ keeps the original order when a retry succeeds — the cover pin lines up by index', async () => {
    failWhile = (body, attempt) => body === 'a' && attempt === 1;   // the FIRST photo is the slow one
    const r = await uploadPhotos([photo('a'), photo('b'), photo('c')], 'h1');
    expect(r.urls).toEqual(['https://cdn/a', 'https://cdn/b', 'https://cdn/c']);
  });

  it('passes an already-uploaded URL straight through without re-uploading it', async () => {
    const r = await uploadPhotos(['https://cdn/already.jpg', photo('b')], 'h1');
    expect(r.urls).toEqual(['https://cdn/already.jpg', 'https://cdn/b']);
    expect(attempts).toEqual(['b']);
  });

  it('an empty list is not a failure', async () => {
    expect(await uploadPhotos([], 'h1')).toEqual({ urls: [], failed: 0, failedPhotos: [] });
  });
});
