declare const __BUILD_DATE__: string;
declare const __BUILD_SHA__: string;

/**
 * Subtle always-visible build stamp: build date + short commit SHA, injected at
 * build time via vite `define`. Pinned at the bottom of the app shell so you can
 * confirm at a glance which deploy a screen is running. Theme-aware (light/dark).
 *
 * ⚠️ A DEV SERVER PRINTS `dev`, NOT A HASH, and deliberately so — see vite.config's `buildSha`.
 * `define` resolves once at server start, so a long-running dev server was stamping a commit from
 * five days earlier onto code it was serving fresh off disk. A stamp that answers confidently and
 * wrongly is worse than one that says "no identity to claim here".
 */
export function BuildStamp() {
  return (
    <div className="shrink-0 text-center py-2 text-[10px] text-gray-400 dark:text-gray-600 select-none tracking-[0.2em] font-mono border-t border-gray-100 dark:border-gray-800/50 transition-colors">
      {__BUILD_DATE__} · {__BUILD_SHA__}
    </div>
  );
}
