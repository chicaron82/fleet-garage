import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage, compressBatch, ImageDecodeError } from '../../src/lib/image';

// ⚠️ Two stored key-tag photos (LFJ204, 0ET028) are 759-byte 1×1 JPEGs. Both records carry a class
// code, so the vision READ worked — the file written afterwards was empty. And `compress` had no
// reject at all: an undecodable file never settled, so the caller awaited forever with no error,
// no timeout, and no console line. This file pins both.

type FakeImg = { width: number; height: number; onload: (() => void) | null; onerror: (() => void) | null; src: string };
let nextImage: (img: FakeImg) => void;

beforeEach(() => {
  vi.stubGlobal('FileReader', class {
    onload: ((e: { target: { result: string } }) => void) | null = null;
    onerror: (() => void) | null = null;
    error = null;
    readAsDataURL() { queueMicrotask(() => this.onload?.({ target: { result: 'data:image/jpeg;base64,x' } })); }
  });
  vi.stubGlobal('Image', class {
    width = 0; height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    #src = '';
    set src(v: string) { this.#src = v; queueMicrotask(() => nextImage(this as unknown as FakeImg)); }
    get src() { return this.#src; }
  });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,GOOD' };
  vi.stubGlobal('document', { createElement: () => canvas });
});
afterEach(() => vi.unstubAllGlobals());

const file = () => ({ name: 'tag.jpg' }) as File;

describe('compressImage', () => {
  it('compresses a real photo', async () => {
    nextImage = (img) => { img.width = 3000; img.height = 4000; img.onload?.(); };
    await expect(compressImage(file())).resolves.toBe('data:image/jpeg;base64,GOOD');
  });

  // ⭐⭐ THE LIVE CORRUPTION. A canvas sized from img.width === 1 produces exactly the 759-byte
  // 1×1 JPEG found on two real cars. Storing that overwrites the evidence migration 103 exists
  // to keep, and nothing downstream can tell it from a real photo.
  it('REFUSES a degenerate decode rather than storing a blank square', async () => {
    nextImage = (img) => { img.width = 1; img.height = 1; img.onload?.(); };
    await expect(compressImage(file())).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it('refuses a zero-dimension decode too', async () => {
    nextImage = (img) => { img.width = 0; img.height = 0; img.onload?.(); };
    await expect(compressImage(file())).rejects.toThrow(/refusing to store/);
  });

  // ⚠️ THE HANG. There was no img.onerror, so this case NEVER SETTLED — the await sat forever.
  // A rejection is the fix; the assertion that matters is that it settles at all.
  it('SETTLES on an undecodable file instead of hanging forever', async () => {
    nextImage = (img) => { img.onerror?.(); };
    await expect(compressImage(file())).rejects.toThrow(/could not decode/);
  });
});

describe('compressBatch — one bad photo must not cost the good ones', () => {
  // ⚠️ Six call sites used `Promise.all(files.map(compressImage))`, which rejects on the FIRST
  // failure. Once compressImage could reject, that would have thrown away every good photo in the
  // batch because one file was bad — losing evidence to fix a bug about losing evidence.
  it('keeps what worked and counts what did not', async () => {
    let n = 0;
    nextImage = (img) => {
      n++;
      if (n === 2) { img.onerror?.(); return; }
      img.width = 2000; img.height = 1500; img.onload?.();
    };
    const { photos, failed } = await compressBatch([file(), file(), file()]);
    expect(photos).toHaveLength(2);
    expect(failed).toBe(1);
  });

  it('reports total failure without throwing', async () => {
    nextImage = (img) => { img.onerror?.(); };
    const { photos, failed } = await compressBatch([file(), file()]);
    expect(photos).toEqual([]);
    expect(failed).toBe(2);
  });
});
