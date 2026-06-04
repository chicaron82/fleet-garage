// Chunk-reload loop guard for the app error boundary.
//
// After a deploy, stale browsers request chunk filenames that no longer exist and
// the lazy import throws. Reloading pulls the fresh bundle — but a down CDN / dead
// network would make the reload fail too, spinning the page in an infinite loop.
// The guard caps a rapid burst of reloads while still allowing a genuine
// post-deploy reload weeks later.

export const CHUNK_RELOAD_KEY = 'fg_chunk_reload';
const MAX_RELOADS = 2;
const WINDOW_MS = 10_000;

export type ChunkReloadState = { count: number; ts: number };

export function isChunkError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  );
}

/**
 * Pure reload decision. A burst of reloads inside WINDOW_MS is read as a loop and
 * capped at MAX_RELOADS; a reload that lands after the window is treated as fresh,
 * so a genuine post-deploy chunk error later still reloads. No success callback
 * needed — the window self-heals the counter.
 */
export function nextChunkReload(
  stored: ChunkReloadState | null,
  now: number,
): { reload: boolean; next: ChunkReloadState } {
  const stale = !stored || now - stored.ts > WINDOW_MS;
  const count = stale ? 0 : stored.count;
  if (count >= MAX_RELOADS) return { reload: false, next: { count, ts: now } };
  return { reload: true, next: { count: count + 1, ts: now } };
}
