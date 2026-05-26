import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { useSchedule } from '../context/ScheduleContext';
import { toISO } from '../context/ScheduleContext';
import { WashbayClosingLog } from './WashbayClosingLog';
import { HandoffForm } from './HandoffForm';
import { ClosingCheckIn } from './ClosingCheckIn';
import { MidShiftCheckIn } from './MidShiftCheckIn';
import { WhiteboardView } from './WhiteboardView';
import { ShiftSummarySection } from './analytics/ShiftSummarySection';
import { ShiftRatesCard } from './analytics/ShiftRatesCard';
import { ShiftReportExport } from './analytics/ShiftReportExport';
import { localDateStr } from '../hooks/useFleetBalance';
import type { LotStatus, HandoffNote } from '../types';
import { canLogHandoff } from '../types';

// ── Style helpers ──────────────────────────────────────────────────────────────

const LOT_STATUS_BANNER: Record<LotStatus, { bg: string; border: string; text: string; dot: string }> = {
  zeroed:     { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-800 dark:text-green-300',   dot: 'bg-green-500' },
  manageable: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-300', dot: 'bg-yellow-500' },
  backlog:    { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-800 dark:text-red-300',       dot: 'bg-red-500' },
};

// ── HandoffSection ─────────────────────────────────────────────────────────────

function HandoffSection({ latestHandoff, canLog, onLogHandoff }: {
  latestHandoff: HandoffNote | undefined;
  canLog: boolean;
  onLogHandoff: () => void;
}) {
  const isToday = latestHandoff?.loggedAt.startsWith(localDateStr(0)) ?? false;

  if (!latestHandoff || !isToday) {
    return (
      <button type="button" onClick={onLogHandoff}
        className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-yellow-400 dark:hover:border-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer">
        Log Morning Shift Handoff →
      </button>
    );
  }

  const s = LOT_STATUS_BANNER[latestHandoff.lotStatus];
  const time = new Date(latestHandoff.loggedAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 transition-colors ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <p className={`text-xs font-semibold uppercase tracking-wide ${s.text}`}>
            {latestHandoff.lotStatus.charAt(0).toUpperCase() + latestHandoff.lotStatus.slice(1)} · Shift Handoff
          </p>
        </div>
        {canLog && (
          <button type="button" onClick={onLogHandoff} className={`text-xs font-semibold hover:underline cursor-pointer ${s.text}`}>
            Log again →
          </button>
        )}
      </div>
      <div className={`flex gap-4 text-xs ${s.text}`}>
        <span><strong>{latestHandoff.fullPages * 19 + latestHandoff.lastPageEntries}</strong> cars cleaned this shift</span>
        <span>team of <strong>{latestHandoff.teamSize}</strong></span>
      </div>
      {latestHandoff.notes && <p className={`text-xs ${s.text} opacity-80`}>{latestHandoff.notes}</p>}
      <p className={`text-[10px] ${s.text} opacity-60`}>Logged by {latestHandoff.loggedByName} · {time}</p>
    </div>
  );
}

// ── ClosingChecklist ───────────────────────────────────────────────────────────

const CLOSING_STEPS: { step: string; note?: string }[] = [
  { step: 'Get keys from inside safe',                              note: 'No need to write down Sale or Turnback cars' },
  { step: 'Put clean cars on their designated row/ring',            note: 'Load from the back' },
  { step: 'Inventory write-up' },
  { step: 'Send inventory photo to counter' },
  { step: 'Lock gas pump',                                          note: 'Make sure all drivers have returned before locking' },
  { step: 'Record gas meter numbers and initial' },
  { step: 'Send gas sheets to airport' },
  { step: 'Ensure car blocker on both sides of storage container',  note: 'Use any car — dirty, driveable damage, maintenance, or available' },
  { step: 'Turn off water and gas pump' },
  { step: 'Lock doors' },
  { step: 'Turn off bay entrance switch' },
  { step: 'Move shuttle in front of gate entrance',                 note: "Once everyone's car is outside" },
  { step: 'Lights off' },
  { step: 'Arm alarm system' },
  { step: 'Close shutters' },
];

function ClosingChecklist({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Closing Checklist</span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <ol className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {CLOSING_STEPS.map(({ step, note }, i) => (
            <li key={i} className="px-4 py-3 flex gap-3">
              <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 text-right tabular-nums mt-0.5">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-base text-gray-800 dark:text-gray-200">{step}</p>
                {note && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── StepSection ───────────────────────────────────────────────────────────────
// Collapsed: dashed placeholder row (tappable to jump ahead). Expanded: children.

function StepSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button type="button" onClick={onToggle}
        className="w-full rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors cursor-pointer">
        <span>{title}</span>
        <span className="text-xs">▶</span>
      </button>
    );
  }
  return <>{children}</>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MyShiftView() {
  const { user, activeBranch } = useAuth();
  const { latestHandoff, getTodayCheckpoint } = useGarage();
  const { shifts } = useSchedule();

  const todayISO          = toISO(new Date());
  const isScheduledToday  = shifts.some(s => s.userId === user!.id && s.date === todayISO);
  const isMidShift        = shifts.some(s => s.userId === user!.id && s.date === todayISO && s.shiftType === 'mid');
  const isManagementRole  = ['Lead VSA', 'Branch Manager', 'Operations Manager'].includes(user!.role);
  const canSeeCheckIn     = isScheduledToday || isManagementRole;

  const checkInDoneToday  = !!getTodayCheckpoint();
  const handoffDoneToday  = !!latestHandoff && latestHandoff.loggedAt.startsWith(localDateStr(0));
  const [activeTab, setActiveTab]             = useState<'closing-duties' | 'summary' | 'whiteboard'>('closing-duties');
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [reportDate, setReportDate]           = useState(() => localDateStr(0));
  const [handoffOpen, setHandoffOpen]         = useState(checkInDoneToday);
  const [closingLogOpen, setClosingLogOpen]   = useState(handoffDoneToday);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (checkInDoneToday)  setHandoffOpen(true);    }, [checkInDoneToday]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (handoffDoneToday)  setClosingLogOpen(true); }, [handoffDoneToday]);

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">My Shift</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
      </div>

      {/* Tab strip */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 transition-colors">
        {([
          { id: 'closing-duties', label: 'Shift Duties' },
          { id: 'summary',        label: 'Shift Summary' },
          { id: 'whiteboard',     label: 'Whiteboard' },
        ] as const).map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shift Duties */}
      {activeTab === 'closing-duties' && (
        <>
          {canSeeCheckIn && (isMidShift ? <MidShiftCheckIn /> : <ClosingCheckIn />)}
          <StepSection title="Shift Handoff" open={handoffOpen} onToggle={() => setHandoffOpen(o => !o)}>
            <HandoffSection latestHandoff={latestHandoff} canLog={canLogHandoff(user!.role)} onLogHandoff={() => setShowHandoffForm(true)} />
          </StepSection>
          <StepSection title="Closing Log" open={closingLogOpen} onToggle={() => setClosingLogOpen(o => !o)}>
            <WashbayClosingLog />
          </StepSection>
          <ClosingChecklist defaultOpen={isScheduledToday} />
        </>
      )}

      {/* Shift Summary */}
      {activeTab === 'summary' && (
        <>
          <ShiftRatesCard />
          <ShiftSummarySection activeBranch={activeBranch} onViewDateChange={setReportDate} />
          <ShiftReportExport date={reportDate} />
        </>
      )}

      {/* Whiteboard */}
      {activeTab === 'whiteboard' && <WhiteboardView />}

      {/* Handoff form */}
      {showHandoffForm && <HandoffForm onClose={() => setShowHandoffForm(false)} />}

    </div>
  );
}
