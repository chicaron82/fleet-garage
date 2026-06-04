import { describe, it, expect } from 'vitest';
import { isChunkError, nextChunkReload, type ChunkReloadState } from '../../src/lib/chunkReload';

// ── isChunkError ──────────────────────────────────────────────────────────────

describe('isChunkError', () => {
  it('matches the Vite dynamic-import failure message', () => {
    expect(isChunkError(new Error('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true);
  });

  it('matches the module-script failure message', () => {
    expect(isChunkError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('matches by error name', () => {
    const err = new Error('boom');
    err.name = 'ChunkLoadError';
    expect(isChunkError(err)).toBe(true);
  });

  it('does not match an ordinary runtime error', () => {
    expect(isChunkError(new TypeError("Cannot read properties of null (reading 'plate')"))).toBe(false);
  });
});

// ── nextChunkReload (loop guard) ──────────────────────────────────────────────

describe('nextChunkReload', () => {
  const NOW = 1_000_000;

  it('reloads on a first-ever chunk error', () => {
    const { reload, next } = nextChunkReload(null, NOW);
    expect(reload).toBe(true);
    expect(next).toEqual({ count: 1, ts: NOW });
  });

  it('reloads a second time within the window', () => {
    const stored: ChunkReloadState = { count: 1, ts: NOW - 2_000 };
    const { reload, next } = nextChunkReload(stored, NOW);
    expect(reload).toBe(true);
    expect(next.count).toBe(2);
  });

  it('stops reloading once the cap is hit inside the window (breaks the loop)', () => {
    const stored: ChunkReloadState = { count: 2, ts: NOW - 3_000 };
    const { reload } = nextChunkReload(stored, NOW);
    expect(reload).toBe(false);
  });

  it('treats a reload past the window as fresh and reloads again (self-heals)', () => {
    const stored: ChunkReloadState = { count: 2, ts: NOW - 60_000 };
    const { reload, next } = nextChunkReload(stored, NOW);
    expect(reload).toBe(true);
    expect(next.count).toBe(1);
  });
});
