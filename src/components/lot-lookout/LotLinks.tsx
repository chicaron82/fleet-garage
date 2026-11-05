// The outside way into Lot Lookout, with Open and Copy: the read-only view (no PIN). Erin St's count link (the PIN page)
// came off on 2026-11-05: *"It's unused and just keeping the read-only"*. FG is the count's only writer now.
// Moved off the My Day card into the module, 2026-10-15. The drivers' airport link went with the airport (2026-10-29):
// /lot still opens, and lands on the read-only view, so a link already on a driver's phone is never a dead page.
import { useState } from 'react';

const LINKS = [
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
