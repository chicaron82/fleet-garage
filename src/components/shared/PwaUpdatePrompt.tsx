import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * "A new version is ready — Reload?" toast, shown when the service worker has a
 * fresh build precached. registerType is 'prompt' (vite.config), so the app is
 * never swapped silently mid-shift: the crew reloads on their terms.
 *
 * Self-contained (only the pwa-register hook), so it mounts at the root —
 * outside the auth providers — and can surface on the login screen too.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[70] flex items-center justify-between gap-3 rounded-xl bg-gray-900 dark:bg-gray-800 border border-gray-700 px-4 py-3 shadow-2xl">
      <span className="text-sm font-medium text-gray-100">A new version is ready.</span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="px-3 py-1.5 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black font-semibold text-sm transition cursor-pointer"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-sm font-medium text-gray-400 hover:text-gray-200 cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
}
