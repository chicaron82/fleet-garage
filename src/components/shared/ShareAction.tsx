import { hapticLight } from '../../lib/haptics';
import { useShareText } from '../../hooks/useShareText';

/**
 * The amber "share as text" block button used by the export sheets (the Plain
 * Text option, beside a dark PDF/HTML sibling). Single-sourced here so every
 * in-sheet share reads the same as the inline `<ShareAction>` — same lane, same
 * glyph. Callers own the click/loading; this owns only the look.
 */
export const SHARE_TEXT_BUTTON =
  'flex-1 py-3 rounded-xl border border-amber-300 dark:border-amber-700/60 ' +
  'text-amber-700 dark:text-amber-400 text-sm font-semibold ' +
  'hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

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
 * share sheet when available, clipboard + confirmation otherwise (via
 * `useShareText`) — with haptics baked in. `stopPropagation` is built in so it's
 * safe on a clickable card.
 *
 * This is the SHARE lane (amber). Callers own their text via `build`; the
 * primitive owns the look, the fallback, and the copied state.
 */
export function ShareAction({ build, label = 'Share', compact, 'aria-label': ariaLabel }: ShareActionProps) {
  const { copied, share } = useShareText();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    await share(build());
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? 'Share'}
      onClick={handleShare}
      className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
    >
      {copied ? (compact ? '✓' : '✓ Copied') : (compact ? '↗' : `↗ ${label}`)}
    </button>
  );
}
