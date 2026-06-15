interface ShareTextButtonProps {
  /** Fires the share-as-text action — the caller owns the share→clipboard dance (via `useShareText`). */
  onClick: () => void;
  /** True briefly after a clipboard fallback; flips the label to `✓ Copied`. */
  copied: boolean;
  disabled?: boolean;
  /** True while the payload is being assembled (a report that fetches before it can share). */
  loading?: boolean;
  /** Idle label shown after the `↗`. Defaults to "Plain Text". */
  label?: string;
}

/**
 * The amber "share as text" block button for the export sheets — the Plain Text
 * option beside a dark PDF/HTML sibling. The block sibling of the inline
 * `<ShareAction>`: same SHARE lane (amber), same `↗`/`✓ Copied` language, so the
 * look is enforced by the component existing rather than by a copied className.
 * Presentational — the caller owns the click, the `copied` flag, and any loading.
 */
export function ShareTextButton({ onClick, copied, disabled, loading, label = 'Plain Text' }: ShareTextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 rounded-xl border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Generating…' : copied ? '✓ Copied' : `↗ ${label}`}
    </button>
  );
}
