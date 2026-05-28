const WHAT_IT_DOES = [
  {
    title: 'Damage Hold Ledger',
    body: 'Every vehicle hold is logged with a full chain of custody — who flagged it, when, and why. Releases require manager approval, fingerprinted to their Employee ID. No more verbal decisions that evaporate.',
  },
  {
    title: 'Accountability by Design',
    body: 'VSAs flag damage but cannot approve releases. Managers own every exception permanently. The system enforces what policy recommends — and protects the people on the floor.',
  },
  {
    title: 'Location Operations Platform',
    body: 'Beyond holds — check-ins, audits, inventory zones, movement logs, lost & found, and shift scheduling. One app for the full operational picture of a rental location.',
  },
];

const CAPABILITIES = [
  {
    icon: '🏢',
    title: 'Multi-location dashboard',
    description: 'Regional managers see every branch at a glance. Fleet health across the city in one view.',
  },
  {
    icon: '📊',
    title: 'Permission-gated analytics',
    description: 'VSAs see their data. Managers see their location. Regional sees everything.',
  },
  {
    icon: '🔗',
    title: 'Bridge to existing systems',
    description: 'Not a replacement. Scan a unit, pull from your fleet database. Employee ID resolves against HR.',
  },
  {
    icon: '📱',
    title: 'Barcode scanning',
    description: 'Every vehicle already has barcodes. Scan instead of type. One tap opens the full damage history.',
  },
  {
    icon: '⚡',
    title: 'Real-time updates',
    description: 'Vehicle status changes instantly across all users. No more stale whiteboards or email chains.',
  },
];

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Logo + title */}
        <div className="flex flex-col items-center text-center pt-2 pb-6">
          <div className="w-14 h-14 bg-yellow-400 dark:bg-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/20 mb-3">
            <span className="text-black font-bold text-xl">FG</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fleet Garage</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Winnipeg Logistics Engine</p>
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              Ops Pilot Program · Est. April 2026
            </span>
          </div>
        </div>

        {/* What It Does */}
        <div className="mb-6">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 font-bold">
            What It Does
          </p>
          <div className="space-y-3">
            {WHAT_IT_DOES.map(item => (
              <div
                key={item.title}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{item.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What It's Capable Of */}
        <div className="mb-6">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 font-bold">
            What It's Capable Of
          </p>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap.title}
                className={`flex items-start gap-3 p-4 ${
                  i < CAPABILITIES.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''
                }`}
              >
                <span className="text-lg leading-none mt-0.5">{cap.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cap.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-600 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p>Built by Aaron (Chicharon) · UV7 / The Zee Collective</p>
          <p className="mt-0.5">"There was no system. So we built one." 💚🔥💀</p>
        </div>
      </div>
    </div>
  );
}
