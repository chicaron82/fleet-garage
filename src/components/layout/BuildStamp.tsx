declare const __BUILD_DATE__: string;
declare const __BUILD_SHA__: string;

/**
 * Subtle always-visible build stamp: build date + short commit SHA, injected at
 * build time via vite `define`. Pinned at the bottom of the app shell so you can
 * confirm at a glance which deploy a screen is running. Theme-aware (light/dark).
 */
export function BuildStamp() {
  return (
    <div className="shrink-0 text-center py-2 text-[10px] text-gray-400 dark:text-gray-600 select-none tracking-[0.2em] font-mono border-t border-gray-100 dark:border-gray-800/50 transition-colors">
      {__BUILD_DATE__} · {__BUILD_SHA__}
    </div>
  );
}
