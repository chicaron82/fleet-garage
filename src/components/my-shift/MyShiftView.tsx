import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { useWashbayContext } from '../../context/WashbayContext';
import { useSchedule } from '../../context/ScheduleContext';
import { toISO } from '../../lib/schedule-helpers';
import { WashbayClosingLog } from '../washbay/WashbayClosingLog';
import { HandoffForm } from '../washbay/HandoffForm';
import { AfternoonCheckIn } from '../check-in/AfternoonCheckIn';
import { MidShiftCheckIn } from '../check-in/MidShiftCheckIn';
import { WhiteboardView } from '../shared/WhiteboardView';
import { ShiftSummarySection } from '../analytics/ShiftSummarySection';
import { ShiftRatesCard } from '../analytics/ShiftRatesCard';
import { ShiftReportExport } from '../analytics/ShiftReportExport';
import { PayEstimateCard } from './PayEstimateCard';
import { FuelPumpReadings } from './FuelPumpReadings';
import { AirportFlipSection } from './AirportFlipSection';
import { PendingWritesSection } from '../pending/PendingWritesSection';
import { EffieAuditSection } from '../pending/EffieAuditSection';
import { EffieMisfiresSection } from '../pending/EffieMisfiresSection';
import { BatchKeytagScan } from '../holds/BatchKeytagScan';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useFleetBalanceContext } from '../../context/FleetBalanceContext';
import { FleetBalanceEntryForm } from '../vehicle';
import { businessDateOf } from '../../lib/shiftDay';
import type { LotStatus, HandoffNote } from '../../types';
import { canLogHandoff } from '../../types';

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
  const isToday = latestHandoff ? businessDateOf(latestHandoff.loggedAt) === localDateStr(0) : false;

  if (!latestHandoff || !isToday) {
    return (
      <button type="button" onClick={onLogHandoff}
        className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer">
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
  const { latestHandoff, getTodayCheckpoint, loadError, reload } = useWashbayContext();
  const { shifts } = useSchedule();

  const todayISO          = toISO(new Date());
  const isScheduledToday  = shifts.some(s => s.userId === user!.id && s.date === todayISO);
  const isMidShift        = shifts.some(s => s.userId === user!.id && s.date === todayISO && s.shiftType === 'mid');
  const isManagementRole  = ['Lead VSA', 'Branch Manager', 'Operations Manager'].includes(user!.role);
  const canSeeCheckIn     = isScheduledToday || isManagementRole;

  const { upsertEntry, getTodayEntry, getProjection } = useFleetBalanceContext();

  const checkInDoneToday  = !!getTodayCheckpoint();
  const handoffDoneToday  = !!latestHandoff && businessDateOf(latestHandoff.loggedAt) === localDateStr(0);
  const [activeTab, setActiveTab]             = useState<'closing-duties' | 'summary' | 'whiteboard'>('closing-duties');
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffOpen, setHandoffOpen]         = useState(checkInDoneToday);
  const [closingLogOpen, setClosingLogOpen]   = useState(handoffDoneToday);
  const [airportFlipOpen, setAirportFlipOpen] = useState(true); // surfaced high + open: the no-HIR flip tool is what he opens My Shift for mid-shift

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (checkInDoneToday)  setHandoffOpen(true);    }, [checkInDoneToday]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (handoffDoneToday)  setClosingLogOpen(true); }, [handoffDoneToday]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load shift data. Check your connection.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <ModuleHeader title="My Shift" subtitle={today} />

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

      {/* Batch key-tag register — stage a stack of tags into the queue below in one pass */}
      <BatchKeytagScan />

      {/* Effie's staged writes — review/approve when you have a minute (self-hides when empty) */}
      <PendingWritesSection />

      {/* Where Effie misfires — the tuning signal grouped from rejected writes (self-hides when empty) */}
      <EffieMisfiresSection />

      {/* Effie's write history — the provenance trail of resolved writes (self-hides when empty) */}
      <EffieAuditSection />

      {/* Shift Duties */}
      {activeTab === 'closing-duties' && (
        <>
          <StepSection title="Airport Flip" open={airportFlipOpen} onToggle={() => setAirportFlipOpen(o => !o)}>
            <AirportFlipSection />
          </StepSection>
          <FleetBalanceEntryForm
            onSubmit={(out, inc) => upsertEntry(localDateStr(), out, inc, user!.id)}
            todayEntry={getTodayEntry()}
            projection={getProjection()}
          />
          {canSeeCheckIn && (isMidShift ? <MidShiftCheckIn /> : <AfternoonCheckIn />)}
          <StepSection title="Shift Handoff" open={handoffOpen} onToggle={() => setHandoffOpen(o => !o)}>
            <HandoffSection latestHandoff={latestHandoff} canLog={canLogHandoff(user!.role)} onLogHandoff={() => setShowHandoffForm(true)} />
          </StepSection>
          <StepSection title="Closing Log" open={closingLogOpen} onToggle={() => setClosingLogOpen(o => !o)}>
            <WashbayClosingLog />
          </StepSection>
          <FuelPumpReadings user={user!} />
        </>
      )}

      {/* Shift Summary */}
      {activeTab === 'summary' && (
        <>
          <ShiftRatesCard />
          <ShiftSummarySection activeBranch={activeBranch} />
          <ShiftReportExport date={localDateStr(0)} />
          <PayEstimateCard />
        </>
      )}

      {/* Whiteboard */}
      {activeTab === 'whiteboard' && <WhiteboardView />}

      {/* Handoff form */}
      {showHandoffForm && <HandoffForm onClose={() => setShowHandoffForm(false)} />}

    </div>
  );
}
