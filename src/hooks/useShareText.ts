import { useState } from 'react';

export interface SharePayload {
  /** Title for the native share sheet (ignored by the clipboard fallback). */
  title: string;
  /** The body that gets shared or copied. */
  text: string;
}

/**
 * The one share-as-text behaviour: the native share sheet when the platform
 * offers it, a clipboard copy (with a brief "copied" confirmation) otherwise.
 * Callers build their own payload; this owns the share → clipboard → copied
 * dance so it can't drift across FG's many share buttons (it had been hand-rolled
 * in the inline card affordance and every export sheet independently).
 *
 * @param resetMs how long `copied` stays true after a clipboard fallback.
 * @returns `copied` — true briefly after a copy — and `share(payload)`.
 */
export function useShareText(resetMs = 2000) {
  const [copied, setCopied] = useState(false);

  const share = async ({ title, text }: SharePayload) => {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch { /* fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), resetMs);
  };

  return { copied, share };
}
