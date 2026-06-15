import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';

interface ShareActionProps {
  /**
   * Built on click (not on render) — returns the title + body to share. Deferred
   * so a heavy payload (e.g. a full trip log) isn't assembled on every render.
   */
  build: () => { title: string; text: string };
  /** Visible text after the ↗. Defaults to "Share". */
  label?: string;
  /** Glyph-only (↗ / ✓) for tight rows where a label won't fit. */
  compact?: boolean;
  /** Overrides the default "Share" spoken label. */
  'aria-label'?: string;
}

/**
 * The canonical FG share affordance: an amber ↗ link that flips to ✓ Copied on
 * the clipboard fallback. Every share reads and behaves identically — native
 * share sheet when available, clipboard + confirmation otherwise — with haptics
 * baked in. `stopPropagation` is built in so it's safe on a clickable card.
 *
 * This is the SHARE lane (amber). Callers own their text via `build`; the
 * primitive owns the look, the fallback, and the copied state.
 */
export function ShareAction({ build, label = 'Share', compact, 'aria-label': ariaLabel }: ShareActionProps) {
  const [shared, setShared] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    const { title, text } = build();
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(text);
    setShared(true);
    setTimeout(() => setShared(false), 1500);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? 'Share'}
      onClick={handleShare}
      className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
    >
      {shared ? (compact ? '✓' : '✓ Copied') : (compact ? '↗' : `↗ ${label}`)}
    </button>
  );
}
