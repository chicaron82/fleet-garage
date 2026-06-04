import { Component } from 'react';
import type { ReactNode } from 'react';
import { CHUNK_RELOAD_KEY, isChunkError, nextChunkReload, type ChunkReloadState } from '../../lib/chunkReload';

// The app's single error boundary. Two failure modes, one place:
//   1. Chunk load error (stale browser after a deploy) → reload to pull the fresh
//      bundle, capped by the loop guard in lib/chunkReload.
//   2. Any other runtime throw (e.g. a mapper hitting an unexpected null) → show a
//      recoverable fallback instead of a silent white screen.

function readReloadState(): ChunkReloadState | null {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    return raw ? (JSON.parse(raw) as ChunkReloadState) : null;
  } catch {
    return null;
  }
}

type State = { errored: boolean };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(): State {
    return { errored: true };
  }

  componentDidCatch(error: Error) {
    if (!isChunkError(error)) return; // non-chunk → fall through to the fallback UI
    const { reload, next } = nextChunkReload(readReloadState(), Date.now());
    if (!reload) return; // looping → stop reloading, render the fallback instead
    try { sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    window.location.reload();
  }

  private handleReload = () => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.errored) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <p className="text-4xl mb-3" aria-hidden>🔧</p>
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Something went wrong</p>
        <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
          This screen hit an error it couldn't recover from. A reload usually clears it.
        </p>
        <button type="button" onClick={this.handleReload}
          className="mt-5 rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-yellow-300 cursor-pointer">
          Reload
        </button>
      </div>
    );
  }
}
