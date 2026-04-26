import { useState } from 'react';
import { type Module } from '../types';
import { useAuth } from '../context/AuthContext';
import { getNavItemsForRole } from '../lib/navigation';

const MODULE_INFO: Record<Module, { what: string; roles: string[]; mockNote: string }> = {
  'fleet-garage': {
    what: 'The core of Fleet Garage. Log damage holds, mechanical issues, and detail flags. Every hold is timestamped and tied to the person who created it. Managers approve releases — their Employee ID is permanently attached to every decision. A release streak counter flags vehicles being sent out repeatedly without repair.',
    roles: ['VSA', 'Lead VSA', 'CSR', 'HIR', 'Manager'],
    mockNote: 'Demo data includes the Tesla LJF684 — a real Winnipeg lot vehicle with 3 holds on the same rear bumper dent going back to September 2025. The streak counter and pre-existing suggestion are both live on this vehicle.',
  },
  'check-in': {
    what: 'HIR vehicle return flow. Document interior and exterior condition with photos at the counter. Flag anything questionable for washbay review. Escalate damage directly to a Fleet Garage hold without leaving the screen.',
    roles: ['HIR', 'VSA', 'Lead VSA', 'Manager'],
    mockNote: 'Seeded with 8 check-in records across all statuses — clean returns, pending washbay review, escalated holds, and one management-pinned record for a customer dispute.',
  },
  'audits': {
    what: "Washbay quality audits. Lead VSAs and managers assess vehicle condition across standardized checklist sections. Crew members are logged by Employee ID — type your ID and your name resolves automatically if you're registered.",
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager'],
    mockNote: 'Demo audit records use UV7 crew names as staff. In production, real Employee IDs resolve to real names.',
  },
  'analytics': {
    what: 'Fleet health metrics for management. Exception approval rates, hold durations, repeat offender vehicles, VSA interruption frequency, and daily in/out counts. Permission-gated — managers see their location, regional sees all branches.',
    roles: ['Branch Manager', 'Operations Manager', 'City Manager'],
    mockNote: 'Charts use seeded trend data to demonstrate the analytics layer with real data flowing in. All numbers are illustrative of the reporting capability.',
  },
  'trips': {
    what: 'VSA Movement Log — captures every vehicle run with a fingerprint. Route, reason, authorization level, washbay queue at departure, and fuel level on arrival. Logs shift interruptions separately from routine driver runs. Two-tap: Start Trip → Arrived.',
    roles: ['VSA', 'Lead VSA', 'Driver'],
    mockNote: 'Seeded with example runs showing the full trip card format including VSA Interruption and Proactive Run badges.',
  },
  'inventory': {
    what: 'Daily lot snapshot organized by zones — Standard (Rows 1–6), Overflow (Rows 7–12), Hold Bay (auto-populated from active holds), and Other for creative parking situations. Scan a vehicle, classify it, assign a zone. Session-scoped — resets daily.',
    roles: ['VSA', 'Lead VSA', 'Manager'],
    mockNote: '13 seeded vehicles across all zones including 2 "Other" entries with real location descriptions. Hold Bay auto-wires from the holds module — no manual entry needed.',
  },
  'lost-and-found': {
    what: 'Log items found in returned vehicles. Scan or enter the unit number, photograph the item, and the record is timestamped to your Employee ID. Creates a clear chain of custody from discovery through resolution.',
    roles: ['VSA', 'Lead VSA', 'CSR', 'HIR', 'Manager'],
    mockNote: 'Demo records show the full item lifecycle — found, logged with photos, matched to vehicle history, and resolved.',
  },
  'schedule': {
    what: 'Shift scheduling and actual hours tracking. Log your scheduled shifts, record actual start and end times, and track PTO and sick days for the year. Stat holiday flagging included.',
    roles: ['All roles'],
    mockNote: 'Seeded with a realistic schedule for the pilot crew showing opens, closes, mids, and a PTO day.',
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
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1.5">
                        About the demo data
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">{info.mockNote}</p>
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
