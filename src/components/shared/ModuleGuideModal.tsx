import { useState } from 'react';
import { type Module } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getNavItemsForRole } from '../../lib/navigation';

const MODULE_INFO: Record<Module, { what: string; roles: string[]; dataNote: string }> = {
  'my-day': {
    what: 'Your at-a-glance cockpit. Leads with today\'s shift and who\'s on with you, then your first action — log the fleet balance if it\'s available, otherwise your afternoon check-in — followed by a throughput glance and anything that needs attention. It doesn\'t replace the deep screens; it points you at the right one fast.',
    roles: ['VSA', 'Lead VSA'],
    dataNote: 'Assembles live data from your schedule, fleet balance, and holds — nothing of its own. What you see is your real day.',
  },
  'holds': {
    what: 'The core of Fleet Garage. Log damage holds, mechanical issues, and detail flags. Every hold is timestamped and tied to the person who created it. Managers approve releases — their Employee ID is permanently attached to every decision. A release streak counter flags vehicles being sent out repeatedly without repair.',
    roles: ['VSA', 'Lead VSA', 'CSR', 'HIR', 'Manager'],
    dataNote: 'The release streak counter and pre-existing-damage suggestion run live on every vehicle — a car sent out repeatedly without repair gets flagged, and damage that recurs on the same panel surfaces as pre-existing.',
  },
  'audits': {
    what: "Washbay quality audits. Lead VSAs and managers assess vehicle condition across standardized checklist sections. Crew members are logged by Employee ID — type your ID and your name resolves automatically if you're registered. Completed audits are saved to the live dashboard for 7 days — use Export & Send on each form for your permanent records.",
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager', 'AGM', 'GM'],
    dataNote: 'Shows today\'s audits for this branch — empty until one is completed and exported. Completed audits stay on the dashboard for 7 days.',
  },
  'analytics': {
    what: 'Fleet health metrics for management. Exception approval rates, hold durations, repeat offender vehicles, VSA interruption frequency, and daily in/out counts. Branch managers see their location; AGM, GM, and City Manager see across all branches.',
    roles: ['Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'],
    dataNote: 'Charts read live from holds, releases, and inventory sessions for your branch — every number reflects real activity as it lands.',
  },
  'movement-log': {
    what: 'VSA Movement Log — captures every vehicle run with a fingerprint. Route, reason, authorization level, washbay queue at departure, and fuel level on arrival. Logs shift interruptions separately from routine driver runs. Two-tap: Start Trip → Arrived. Includes Off-Standard Time tracking.',
    roles: ['VSA', 'Lead VSA', 'Driver'],
    dataNote: 'Every run logs live with its full fingerprint — route, reason, authorization, washbay queue at departure, and fuel on arrival. VSA Interruption and Proactive Run badges tag the trip type.',
  },
  'my-shift': {
    what: 'My Shift — personal productivity summary and shift duties. Shift Summary shows your throughput rate, cars cleaned in your shift window, and your effort score adjusted for off-standard time. Save Summary snapshots your shift for the 7-day history. Management sees Team Today — all saved summaries for the branch in one view. Shift Duties covers the washbay closing log: cars in, cars cleaned, throughput rate, and pipeline breakdown.',
    roles: ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'AGM', 'GM'],
    dataNote: 'Shift Summary pulls live OTH and washbay data for today. Save Summary to capture a snapshot — saving again updates it rather than creating a duplicate. Management\'s Team Today view shows all saved summaries for the branch.',
  },
  'lost-and-found': {
    what: 'Log items found in returned vehicles. Scan or enter the unit number, photograph the item, and the record is timestamped to your Employee ID. Creates a clear chain of custody from discovery through resolution.',
    roles: ['VSA', 'Lead VSA', 'CSR', 'HIR', 'Manager'],
    dataNote: 'Every found item logs live — timestamped to your Employee ID, photographed, and tracked from discovery through match to resolution.',
  },
  'schedule': {
    what: 'Shift scheduling and actual hours tracking. Log your scheduled shifts, record actual start and end times, and track PTO and sick days for the year. Stat holiday flagging included.',
    roles: ['All roles'],
    dataNote: 'Your logged shifts, actual hours, PTO, and sick days for the year — all live. Stat holidays flag automatically.',
  },
  'issue-log': {
    what: 'Facility and equipment issue tracker. Log broken equipment, facility problems, or anything affecting operations. Issues stay open until manually cleared — every entry gets a timestamp, severity, and a resolution path.',
    roles: ['VSA', 'Lead VSA', 'CSR', 'HIR', 'Branch Manager', 'Operations Manager', 'City Manager'],
    dataNote: 'Every entry is a real issue you log — timestamped with severity and a resolution path, staying open until you clear it.',
  },
  'manifest': {
    what: 'Today\'s reservation manifest with seasonal priority intelligence. Shows what classes are needed for upcoming pickups — so trippers grab the right car before moving. Priority order shifts automatically by season: summer favours sedans, winter favours AWD SUVs.',
    roles: ['All roles'],
    dataNote: 'Generated fresh each day from the reservation manifest and seasonal priority rules. The same date always produces the same order — consistent across every device.',
  },
  'fleet-master': {
    what: 'Full fleet inventory for management. Every registered vehicle in one screen with its derived operational status — held, pre-existing, on exception, dirty, available, or clear. Pulled live from holds, releases, and inventory sessions. Search by plate or unit to quickly locate a vehicle, or register a new one directly if it\'s not in the system.',
    roles: ['Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'],
    dataNote: 'Live data — status reflects active holds and today\'s inventory session entries for this branch.',
  },
  'effie': {
    what: 'Effie — your lot concierge, full-screen. The same assistant as the corner button, given room to breathe: ask anything, snap a key tag to register or check a vehicle, log a found item, or draft a hold — she reads photos, talks back if you want, and stages her inferred writes for your approval. The conversation is shared with the corner button; the button hides while you\'re here.',
    roles: ['All roles'],
    dataNote: 'Runs on a personal API key, so she\'s enabled for allowlisted accounts only. Her writes are drafts you confirm — nothing lands on the fleet without your tap.',
  },
};

interface Props {
  onClose: () => void;
  initialModule?: Module;
}

export function ModuleGuideModal({ onClose, initialModule }: Props) {
  const { user, activeBranch } = useAuth();
  const [selectedModule, setSelectedModule] = useState<Module | null>(initialModule ?? null);

  if (!user) return null;

  const navItems = getNavItemsForRole(user.role, activeBranch);

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Module Guide</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Tap any module to learn more</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Module list */}
        <div className="space-y-1">
          {navItems.map(item => {
            const isSelected = selectedModule === item.module;
            const info = MODULE_INFO[item.module];

            return (
              <div key={item.module}>
                <button
                  onClick={() => setSelectedModule(isSelected ? null : item.module)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition cursor-pointer ${
                    isSelected
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span
                      className={`text-sm font-semibold ${
                        isSelected
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span className={`text-xs ${isSelected ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-600'}`}>
                    {isSelected ? '▲' : 'ⓘ'}
                  </span>
                </button>

                {/* Info panel — slides in below selected row */}
                {isSelected && info && (
                  <div className="mx-1 mb-2 px-4 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{info.what}</p>

                    <div className="mb-3">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-2">
                        Who can access
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {info.roles.map(role => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              role === 'All roles'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50'
                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40'
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1.5">
                        About the data
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">{info.dataNote}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
