import { hapticLight } from '../../lib/haptics';

export type HoldsTab = 'holds' | 'ev-assets';

// Tab strip under the Holds header — same pattern as Movement Log's tabs.
export function HoldsTabStrip({ activeTab, onTab }: {
  activeTab: HoldsTab;
  onTab: (t: HoldsTab) => void;
}) {
  const tab = (id: HoldsTab, label: string) => (
    <button
      type="button"
      onClick={() => { hapticLight(); onTab(id); }}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
        activeTab === id
          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900">
      {tab('holds', 'Holds')}
      {tab('ev-assets', 'EV Assets ⚡')}
    </div>
  );
}
