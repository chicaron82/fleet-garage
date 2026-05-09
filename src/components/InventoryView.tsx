import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { useSchedule } from '../context/ScheduleContext';
import { toISO } from '../context/ScheduleContext';
import { MOCK_INVENTORY } from '../data/inventory';
import type { InventoryItem, InventoryClassification, Zone } from '../data/inventory';
import { MockBarcodeScanner } from './MockBarcodeScanner';
import { WashbayClosingLog } from './WashbayClosingLog';
import { HandoffForm } from './HandoffForm';
import { WhiteboardView } from './WhiteboardView';
import { StatusBadge } from './StatusBadge';
import type { ScannedPayload, HoldType, LotStatus, HandoffNote } from '../types';
import { canLogHandoff } from '../types';
import { localDateStr } from '../hooks/useFleetBalance';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveEntry {
  id: string;
  unitNumber: string;
  licensePlate: string;
  year: number;
  make: string;
  model: string;
  classification: InventoryClassification | null;
  zone: Zone | null;
  row: string | null;
  locationText: string;
}

const STANDARD_ROWS = ['Row 1', 'Row 2', 'Row 3', 'Row 4', 'Row 5', 'Row 6'];
const OVERFLOW_ROWS = ['Row 7', 'Row 8', 'Row 9', 'Row 10', 'Row 11', 'Row 12'];

function isComplete(e: LiveEntry): boolean {
  if (!e.classification || !e.zone) return false;
  if (e.zone === 'Other') return e.locationText.trim().length > 0;
  return e.row !== null;
}

function itemLocationLabel(item: InventoryItem): string {
  if (item.zone === 'Other') return `${item.locationText ?? 'Other'} · Other`;
  return item.row ? `${item.row} · ${item.zone}` : item.zone;
}

function entryLocationLabel(e: LiveEntry): string {
  if (e.zone === 'Other') return `${e.locationText} · Other`;
  if (e.row) return `${e.row} · ${e.zone}`;
  return e.zone ?? '';
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const LOT_STATUS_BANNER: Record<LotStatus, { bg: string; border: string; text: string; dot: string }> = {
  zeroed:     { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-800 dark:text-green-300',   dot: 'bg-green-500' },
  manageable: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-300', dot: 'bg-yellow-500' },
  backlog:    { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-800 dark:text-red-300',       dot: 'bg-red-500' },
};

const CLASS_STYLES: Record<string, string> = {
  'Rentable':  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'Dirty':     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function ZoneSection({
  title, count, colorClass, collapsed, onToggle, children,
}: {
  title: string; count: number; colorClass: string;
  collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{count} vehicle{count !== 1 ? 's' : ''}</span>
          <span className="text-gray-400 dark:text-gray-500 text-xs">{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>
      {!collapsed && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {count === 0
            ? <p className="px-4 py-4 text-xs text-gray-400 dark:text-gray-500 italic">No vehicles</p>
            : children
          }
        </div>
      )}
    </div>
  );
}

function InventoryCard({
  unitNumber, licensePlate, year, make, model,
  classification, locationLabel, onDismiss,
}: {
  unitNumber: string; licensePlate: string; year: number; make: string; model: string;
  classification: string; locationLabel: string; onDismiss: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{unitNumber}</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{licensePlate}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{year} {make} {model}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{locationLabel}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CLASS_STYLES[classification] ?? ''}`}>
          {classification}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition cursor-pointer text-sm"
          title="Remove from today's list"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function HoldCard({
  unitNumber, licensePlate, year, make, model, status, holdTypes,
}: {
  unitNumber: string; licensePlate: string; year: number; make: string; model: string; status: string; holdType?: HoldType; holdTypes?: HoldType[];
}) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{unitNumber}</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{licensePlate}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">🔗</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{year} {make} {model}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Hold Bay</p>
      </div>
      <StatusBadge status={status as 'HELD'} holdTypes={holdTypes} />
    </div>
  );
}

function ScanCard({ entry, onChange }: {
  entry: LiveEntry;
  onChange: (patch: Partial<LiveEntry>) => void;
}) {
  const showZone        = entry.classification !== null && entry.zone === null;
  const showRow         = entry.zone === 'Standard' || entry.zone === 'Overflow';
  const showText        = entry.zone === 'Other';
  const rows            = entry.zone === 'Standard' ? STANDARD_ROWS : OVERFLOW_ROWS;

  return (
    <div className={`rounded-lg border p-3 transition-colors space-y-2 ${
      isComplete(entry) ? 'border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10' : 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{entry.unitNumber} · {entry.licensePlate}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{entry.year} {entry.make} {entry.model}</p>
        </div>
        {entry.classification && (
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${CLASS_STYLES[entry.classification]}`}>
            {entry.classification}
          </span>
        )}
      </div>

      {/* Step 1 — Classify */}
      {entry.classification === null && (
        <div className="flex gap-1.5">
          {(['Rentable', 'Dirty'] as InventoryClassification[]).map(c => (
            <button key={c} type="button" onClick={() => onChange({ classification: c })}
              className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer">
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — Zone */}
      {showZone && (
        <select
          defaultValue=""
          onChange={e => onChange({ zone: e.target.value as Zone, row: null, locationText: '' })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
        >
          <option value="" disabled>Where is it?</option>
          <option>Standard</option>
          <option>Overflow</option>
          <option>Other</option>
        </select>
      )}

      {/* Step 3a — Row */}
      {showRow && entry.row === null && (
        <select
          defaultValue=""
          onChange={e => onChange({ row: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
        >
          <option value="" disabled>Select row…</option>
          {rows.map(r => <option key={r}>{r}</option>)}
        </select>
      )}

      {/* Step 3b — Location text (Other) */}
      {showText && !isComplete(entry) && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. East fence"
            value={entry.locationText}
            onChange={e => onChange({ locationText: e.target.value })}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        </div>
      )}

      {/* Complete */}
      {isComplete(entry) && (
        <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
          ✓ Added to {entry.zone} · {entryLocationLabel(entry)}
        </p>
      )}
    </div>
  );
}

// ── Handoff section ────────────────────────────────────────────────────────────

function HandoffSection({ latestHandoff, canLog, onLogHandoff }: {
  latestHandoff: HandoffNote | undefined;
  canLog: boolean;
  onLogHandoff: () => void;
}) {
  const isToday = latestHandoff?.loggedAt.startsWith(localDateStr(0)) ?? false;

  if (!latestHandoff || !isToday) {
    return (
      <button
        type="button"
        onClick={onLogHandoff}
        className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-yellow-400 dark:hover:border-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer"
      >
        Log Shift Handoff →
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
      {latestHandoff.notes && (
        <p className={`text-xs ${s.text} opacity-80`}>{latestHandoff.notes}</p>
      )}
      <p className={`text-[10px] ${s.text} opacity-60`}>Logged by {latestHandoff.loggedByName} · {time}</p>
    </div>
  );
}

// ── Closing Checklist ──────────────────────────────────────────────────────────

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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Closing Checklist</span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <ol className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {CLOSING_STEPS.map(({ step, note }, i) => (
            <li key={i} className="px-4 py-3 flex gap-3">
              <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 text-right tabular-nums mt-0.5">
                {i + 1}.
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">{step}</p>
                {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InventoryView() {
  const { user } = useAuth();
  const { vehicles, getActiveHold, latestHandoff } = useGarage();
  const { shifts } = useSchedule();

  const todayISO = toISO(new Date());
  const isClosingShift = shifts.some(s => s.userId === user!.id && s.date === todayISO && s.shiftType === 'closing');

  const [activeTab, setActiveTab] = useState<'closing-duties' | 'lot-snapshot' | 'whiteboard'>('closing-duties');
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showHandoffForm, setShowHandoffForm] = useState(false);

  // Hold Bay — active holds only, sorted by most recent flaggedAt so fresh flags surface first
  const heldVehicles = vehicles
    .filter(v => v.status === 'HELD')
    .sort((a, b) => {
      const aHold = getActiveHold(a.id);
      const bHold = getActiveHold(b.id);
      return new Date(bHold?.flaggedAt ?? 0).getTime() - new Date(aHold?.flaggedAt ?? 0).getTime();
    });

  // Static items minus dismissed
  const staticItems = MOCK_INVENTORY.items.filter(i => !dismissedIds.has(i.id));

  // Completed live entries minus dismissed
  const completedEntries = liveEntries.filter(e => isComplete(e) && !dismissedIds.has(e.id));

  // Pending (still in classify flow)
  const pendingEntries = liveEntries.filter(e => !isComplete(e));

  // Items by zone
  const byZone = (zone: Zone) => ({
    static:  staticItems.filter(i => i.zone === zone),
    live:    completedEntries.filter(e => e.zone === zone),
  });

  const standard = byZone('Standard');
  const overflow = byZone('Overflow');
  const other    = byZone('Other');

  // Summary counts
  const allActive = [...staticItems, ...completedEntries];
  const rentableCount = allActive.filter(i => i.classification === 'Rentable').length;
  const dirtyCount    = allActive.filter(i => i.classification === 'Dirty').length;
  const holdCount     = heldVehicles.length;

  const toggleCollapse = (zone: string) =>
    setCollapsed(prev => ({ ...prev, [zone]: !prev[zone] }));

  const dismiss = (id: string) =>
    setDismissedIds(prev => new Set([...prev, id]));

  const handleScan = (payload: ScannedPayload) => {
    setLiveEntries(prev => [{
      id: crypto.randomUUID(),
      unitNumber: payload.unitNumber,
      licensePlate: payload.licensePlate,
      year: payload.year,
      make: payload.make,
      model: payload.model,
      classification: null,
      zone: null,
      row: null,
      locationText: '',
    }, ...prev]);
  };

  const updateEntry = (id: string, patch: Partial<LiveEntry>) =>
    setLiveEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Shift Duties</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
          Demo
        </span>
      </div>

      {/* Tab strip */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 transition-colors">
        {([
          { id: 'closing-duties', label: 'Closing Duties' },
          { id: 'lot-snapshot',   label: 'Lot Snapshot' },
          { id: 'whiteboard',     label: 'Whiteboard' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Closing Duties tab */}
      {activeTab === 'closing-duties' && (
        <>
          <WashbayClosingLog />
          <HandoffSection
            latestHandoff={latestHandoff}
            canLog={canLogHandoff(user!.role)}
            onLogHandoff={() => setShowHandoffForm(true)}
          />
          <ClosingChecklist defaultOpen={isClosingShift} />
        </>
      )}

      {/* Lot Snapshot tab */}
      {activeTab === 'lot-snapshot' && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Scan &amp; Classify</p>
              {liveEntries.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{liveEntries.length} scanned</span>
              )}
            </div>
            <div className="p-4 space-y-3">
              <MockBarcodeScanner onScan={handleScan} label="Scan Vehicle" />
              {pendingEntries.map(e => (
                <ScanCard key={e.id} entry={e} onChange={patch => updateEntry(e.id, patch)} />
              ))}
              {liveEntries.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Scan a vehicle to classify and locate it</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Rentable', count: rentableCount, color: 'text-green-600 dark:text-green-500' },
              { label: 'Dirty',    count: dirtyCount,    color: 'text-amber-500' },
              { label: 'Hold Bay', count: holdCount,     color: 'text-red-600 dark:text-red-500' },
              { label: 'Total',    count: rentableCount + dirtyCount + holdCount, color: 'text-gray-700 dark:text-gray-300' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <ZoneSection
            title="Standard"
            count={standard.static.length + standard.live.length}
            colorClass="text-gray-700 dark:text-gray-300"
            collapsed={!!collapsed['Standard']}
            onToggle={() => toggleCollapse('Standard')}
          >
            {standard.static.map(item => (
              <InventoryCard
                key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model}
                classification={item.classification} locationLabel={itemLocationLabel(item)}
                onDismiss={() => dismiss(item.id)}
              />
            ))}
            {standard.live.map(e => (
              <InventoryCard
                key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model}
                classification={e.classification!} locationLabel={entryLocationLabel(e)}
                onDismiss={() => dismiss(e.id)}
              />
            ))}
          </ZoneSection>

          <ZoneSection
            title="Overflow"
            count={overflow.static.length + overflow.live.length}
            colorClass="text-gray-700 dark:text-gray-300"
            collapsed={!!collapsed['Overflow']}
            onToggle={() => toggleCollapse('Overflow')}
          >
            {overflow.static.map(item => (
              <InventoryCard
                key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model}
                classification={item.classification} locationLabel={itemLocationLabel(item)}
                onDismiss={() => dismiss(item.id)}
              />
            ))}
            {overflow.live.map(e => (
              <InventoryCard
                key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model}
                classification={e.classification!} locationLabel={entryLocationLabel(e)}
                onDismiss={() => dismiss(e.id)}
              />
            ))}
          </ZoneSection>

          <ZoneSection
            title="Hold Bay"
            count={holdCount}
            colorClass="text-amber-700 dark:text-amber-500"
            collapsed={!!collapsed['Hold Bay']}
            onToggle={() => toggleCollapse('Hold Bay')}
          >
            {heldVehicles.map(v => (
              <HoldCard
                key={v.id} unitNumber={v.unitNumber} licensePlate={v.licensePlate}
                year={v.year} make={v.make} model={v.model} status={v.status}
                holdType={getActiveHold(v.id)?.holdType}
                holdTypes={getActiveHold(v.id)?.holdTypes}
              />
            ))}
          </ZoneSection>

          <ZoneSection
            title="Other"
            count={other.static.length + other.live.length}
            colorClass="text-gray-500 dark:text-gray-400"
            collapsed={!!collapsed['Other']}
            onToggle={() => toggleCollapse('Other')}
          >
            {other.static.map(item => (
              <InventoryCard
                key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model}
                classification={item.classification} locationLabel={itemLocationLabel(item)}
                onDismiss={() => dismiss(item.id)}
              />
            ))}
            {other.live.map(e => (
              <InventoryCard
                key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model}
                classification={e.classification!} locationLabel={entryLocationLabel(e)}
                onDismiss={() => dismiss(e.id)}
              />
            ))}
          </ZoneSection>
        </>
      )}

      {/* Whiteboard tab */}
      {activeTab === 'whiteboard' && <WhiteboardView />}

      {showHandoffForm && <HandoffForm onClose={() => setShowHandoffForm(false)} />}

    </div>
  );
}
