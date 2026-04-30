import { useState, useEffect } from 'react';
import { useGarage } from '../context/GarageContext';
import { useAuth } from '../context/AuthContext';
import { MOCK_INVENTORY } from '../data/inventory';
import type { InventoryItem, InventoryClassification, Zone } from '../data/inventory';
import { MockBarcodeScanner } from './MockBarcodeScanner';
import type { ScannedPayload } from '../types';

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

const CLASS_STYLES: Record<string, string> = {
  'Rentable':  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'Dirty':     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

const STATUS_STYLES: Record<string, string> = {
  'HELD':              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  'OUT_ON_EXCEPTION':  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'RETURNED':          'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  'HELD':             'On Hold',
  'OUT_ON_EXCEPTION': 'Exception',
  'RETURNED':         'Returned',
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
  unitNumber, licensePlate, year, make, model, status,
}: {
  unitNumber: string; licensePlate: string; year: number; make: string; model: string; status: string;
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
      <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] ?? ''}`}>
        {STATUS_LABELS[status] ?? status}
      </span>
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

// ── Washbay Closing Log ────────────────────────────────────────────────────────

const COMPANY_STANDARD = 3.0;

function WashbayClosingLog() {
  const { holds, submitWashbayLog, getTodayWashbayLog } = useGarage();
  const { user } = useAuth();

  const [fullPages,       setFullPages]       = useState('');
  const [lastPageEntries, setLastPageEntries] = useState('');
  const [carsRemaining,   setCarsRemaining]   = useState('');
  const [cleanNotPickedUp,setCleanNotPickedUp]= useState('');
  const [teamSize,        setTeamSize]        = useState('');
  const [shiftHours,      setShiftHours]      = useState('8');
  const [submitting,      setSubmitting]      = useState(false);
  const [editing,         setEditing]         = useState(false);

  const todayLog = getTodayWashbayLog();
  const showSummary = !!todayLog && !editing;

  // Pre-fill when entering edit mode
  useEffect(() => {
    if (todayLog && editing) {
      setFullPages(String(todayLog.fullPages));
      setLastPageEntries(String(todayLog.lastPageEntries));
      setCarsRemaining(String(todayLog.carsRemaining));
      setCleanNotPickedUp(String(todayLog.cleanNotPickedUp));
      setTeamSize(String(todayLog.teamSize));
      setShiftHours(String(todayLog.shiftHours));
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fp   = parseInt(fullPages)        || 0;
  const lpe  = parseInt(lastPageEntries)  || 0;
  const cr   = parseInt(carsRemaining)    || 0;
  const cnpu = parseInt(cleanNotPickedUp) || 0;
  const ts   = parseInt(teamSize)         || 1;
  const sh   = parseFloat(shiftHours)     || 8;

  const carsIn      = fp * 19 + lpe;
  const carsCleaned = Math.max(0, carsIn - cr);
  const throughput  = sh > 0 ? carsCleaned / sh : 0;
  const delta       = throughput - COMPANY_STANDARD;

  const heldToday          = holds.filter(h => h.status === 'ACTIVE').length;
  const rentablesProcessed = Math.max(0, carsIn - heldToday);
  const deliveredToAirport = Math.max(0, rentablesProcessed - cnpu);

  const canSubmit = !submitting && carsIn > 0 && ts > 0 && user;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await submitWashbayLog({ fullPages: fp, lastPageEntries: lpe, carsRemaining: cr, cleanNotPickedUp: cnpu, teamSize: ts, shiftHours: sh });
    setEditing(false);
    setSubmitting(false);
  };

  // ── Summary view (after submit) ────────────────────────────────────────────

  if (showSummary && todayLog) {
    const ci  = todayLog.fullPages * 19 + todayLog.lastPageEntries;
    const cc  = Math.max(0, ci - todayLog.carsRemaining);
    const tp  = todayLog.shiftHours > 0 ? cc / todayLog.shiftHours : 0;
    const d   = tp - COMPANY_STANDARD;
    const ht  = holds.filter(h => h.status === 'ACTIVE').length;
    const rp  = Math.max(0, ci - ht);
    const da  = Math.max(0, rp - todayLog.cleanNotPickedUp);

    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline cursor-pointer"
          >
            Edit
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Cars In',     value: ci },
              { label: 'Cleaned',     value: cc },
              { label: 'Throughput',  value: `${tp.toFixed(1)}/hr` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className="space-y-1 text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Pipeline</p>
            {[
              { label: 'Cars in',              value: ci,   indent: false, minus: false },
              { label: `Held today (${ht})`,   value: ht,   indent: true,  minus: true  },
              { label: 'Rentables processed',  value: rp,   indent: false, minus: false },
              { label: 'Clean, not picked up', value: todayLog.cleanNotPickedUp, indent: true, minus: true },
              { label: 'Delivered to airport', value: da,   indent: false, minus: false },
            ].map(({ label, value, indent, minus }) => (
              <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                <span className="text-xs">{minus ? '− ' : ''}{label}</span>
                <span className="text-xs tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {/* vs standard */}
          <div className={`rounded-lg px-4 py-3 ${d >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'}`}>
            <p className={`text-sm font-semibold ${d >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {tp.toFixed(1)}/hr · team of {todayLog.teamSize}
            </p>
            <p className={`text-xs mt-0.5 ${d >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              vs {COMPANY_STANDARD.toFixed(1)} standard · {d >= 0 ? `+${d.toFixed(1)} above` : `${d.toFixed(1)} below`} {d >= 0 ? '✅' : '⚠️'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Input form ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
      </div>
      <div className="p-4 space-y-4">

        {/* Gas sheet pages */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Gas Sheet Pages</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Full pages</label>
              <input
                type="number" min="0" value={fullPages} onChange={e => setFullPages(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Last page entries</label>
              <input
                type="number" min="0" max="19" value={lastPageEntries} onChange={e => setLastPageEntries(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
            </div>
          </div>
          {carsIn > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">= {carsIn} cars in ✓</p>
          )}
        </div>

        {/* Queue / clean not picked up */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
            <input
              type="number" min="0" value={carsRemaining} onChange={e => setCarsRemaining(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
            <input
              type="number" min="0" value={cleanNotPickedUp} onChange={e => setCleanNotPickedUp(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
        </div>

        {/* Team size / shift hours */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Team size</label>
            <input
              type="number" min="1" value={teamSize} onChange={e => setTeamSize(e.target.value)}
              placeholder="3"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Shift hours</label>
            <input
              type="number" min="1" max="16" step="0.5" value={shiftHours} onChange={e => setShiftHours(e.target.value)}
              placeholder="8"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
        </div>

        {/* Live preview */}
        {carsIn > 0 && (
          <div className={`rounded-lg px-4 py-3 ${delta >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'}`}>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {carsCleaned} cars cleaned · {throughput.toFixed(1)}/hr
            </p>
            <p className={`text-xs mt-0.5 ${delta >= 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
              vs {COMPANY_STANDARD.toFixed(1)} standard · {delta >= 0 ? `+${delta.toFixed(1)} above ✅` : `${delta.toFixed(1)} below`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Pipeline: {carsIn} in → −{heldToday} held → {rentablesProcessed} rentable → {deliveredToAirport} delivered
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
            canSubmit
              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting…' : 'Submit Closing Log'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InventoryView() {
  const { vehicles, getActiveHold } = useGarage();

  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Lot Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
          Demo
        </span>
      </div>

      {/* Live Scan */}
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

      {/* Summary */}
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

      {/* Standard */}
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

      {/* Overflow */}
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

      {/* Hold Bay — auto-populated, no trash */}
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
          />
        ))}
      </ZoneSection>

      {/* Other */}
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

      {/* Closing Duties */}
      <WashbayClosingLog />

    </div>
  );
}
