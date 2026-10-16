// The three outside ways into Lot Lookout, each with Open and Copy: the drivers' board (PIN), Erin St's count (PIN),
// and the read-only view (no PIN). Moved off the My Day card into the module, 2026-10-15.
import { useState } from 'react';

const LINKS = [
  { path: '/lot', label: 'Driver link' },
  { path: '/lot/erin', label: 'Erin St count' },
  { path: '/lot/view', label: 'Read only, no PIN' },
] as const;

export function LotLinks() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (link: string) => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(link); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };
  return (
    <section aria-label="Links" className="space-y-2">
      <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Links</h2>
      {LINKS.map(({ path, label }) => {
        const link = `${window.location.origin}${path}`;
        return (
          <div key={path} className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="min-w-0 break-all">{label}: <span className="font-mono text-gray-700 dark:text-gray-300">{link}</span></span>
            <span className="shrink-0 flex gap-1.5">
              <a href={path} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-200">Open</a>
              <button type="button" onClick={() => copy(link)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                {copied === link ? 'Copied' : 'Copy'}
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}
