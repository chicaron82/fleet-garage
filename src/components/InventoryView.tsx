import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { useSchedule } from '../context/ScheduleContext';
import { toISO } from '../context/ScheduleContext';
import { MOCK_INVENTORY } from '../data/inventory';
import type { InventoryItem, Zone } from '../data/inventory';
import { KeytagPhotoScanner } from './KeytagPhotoScanner';
import { WashbayClosingLog } from './WashbayClosingLog';
import { HandoffForm } from './HandoffForm';
import { WhiteboardView } from './WhiteboardView';
import { StatusBadge } from './StatusBadge';
import { supabase } from '../lib/supabase';
import { generateInventoryExport, inventoryExportFilename } from '../lib/inventory-export';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { localDateStr } from '../hooks/useFleetBalance';
import type { ScannedPayload, HoldType, LotStatus, HandoffNote } from '../types';
import { canLogHandoff } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveEntry {
  id: string;
  vehicleId?: string;
  unitNumber: string;
  licensePlate: string;
  year: number;
  make: string;
  model: string;
  color: string;
  rentalClass?: string;
  owningArea?: string;
  classification: 'Rentable' | 'Dirty' | 'Held' | null;
  holdType?: HoldType;
  zone: Zone | null;
  row: string | null;
  locationText: string;
  needsReview?: boolean;
}

interface Props {
  onHoldIntent: (vehicleId?: string) => void;
}

const STANDARD_ROWS = ['Row 1', 'Row 2', 'Row 3', 'Row 4', 'Row 5', 'Row 6'];
const OVERFLOW_ROWS = ['Row 7', 'Row 8', 'Row 9', 'Row 10', 'Row 11', 'Row 12'];
const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Brown', 'Gold', 'Other'];

function isComplete(e: LiveEntry): boolean {
  if (!e.classification) return false;
  if (e.classification === 'Held') return true;
  if (!e.zone) return false;
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

const CLASS_BADGE: Record<string, string> = {
  Rentable: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Dirty:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  Held:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const HOLD_LABEL: Record<string, string> = {
  damage:     'Body Damage',
  mechanical: 'Mechanical',
  detail:     'Detail',
};

// ── LiveEntryCard ──────────────────────────────────────────────────────────────

function LiveEntryCard({ entry, onChange, onHoldTap, onDismiss }: {
  entry: LiveEntry;
  onChange: (patch: Partial<LiveEntry>) => void;
  onHoldTap: (holdType: HoldType) => void;
  onDismiss: () => void;
}) {
  const [editOpen, setEditOpen] = useState(entry.needsReview ?? false);
  const complete = isComplete(entry);
  const showZone = entry.classification !== null && entry.classification !== 'Held' && entry.zone === null;
  const showRow  = entry.zone === 'Standard' || entry.zone === 'Overflow';
  const showText = entry.zone === 'Other';
  const rows     = entry.zone === 'Standard' ? STANDARD_ROWS : OVERFLOW_ROWS;

  const cardBorder = complete
    ? 'border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10'
    : entry.needsReview
      ? 'border-yellow-300 dark:border-yellow-700/40 bg-yellow-50 dark:bg-yellow-900/10'
      : 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10';

  return (
    <>
      <div
        className={`rounded-lg border p-3 transition-colors space-y-2 ${cardBorder} ${complete ? 'cursor-pointer' : ''}`}
        onClick={complete ? () => setEditOpen(true) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-base">{entry.unitNumber || '—'} · {entry.licensePlate || '—'}</p>
              {entry.needsReview && !complete && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 font-semibold">⚠ Review</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{entry.year > 0 ? entry.year : ''} {entry.make} {entry.model}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entry.classification && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CLASS_BADGE[entry.classification]}`}>
                {entry.classification === 'Held' && entry.holdType ? HOLD_LABEL[entry.holdType] ?? 'Held' : entry.classification}
              </span>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDismiss(); }}
              className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition cursor-pointer text-sm"
            >
              🗑
            </button>
          </div>
        </div>

        {/* 4-state grid */}
        {entry.classification === null && (
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={e => { e.stopPropagation(); hapticMedium(); onChange({ classification: 'Rentable' }); }}
              className="py-3 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-bold text-sm hover:bg-green-200 dark:hover:bg-green-900/60 transition cursor-pointer">
              A Available
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); hapticMedium(); onChange({ classification: 'Dirty' }); }}
              className="py-3 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold text-sm hover:bg-amber-200 dark:hover:bg-amber-900/60 transition cursor-pointer">
              D Dirty
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); hapticMedium(); onHoldTap('damage'); }}
              className="py-3 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 font-bold text-sm hover:bg-red-200 dark:hover:bg-red-900/60 transition cursor-pointer">
              B Body Damage
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); hapticMedium(); onHoldTap('mechanical'); }}
              className="py-3 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 font-bold text-sm hover:bg-orange-200 dark:hover:bg-orange-900/60 transition cursor-pointer">
              M Mechanical
            </button>
          </div>
        )}

        {/* Zone picker */}
        {showZone && (
          <select
            defaultValue=""
            onClick={e => e.stopPropagation()}
            onChange={e => onChange({ zone: e.target.value as Zone, row: null, locationText: '' })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
          >
            <option value="" disabled>Where is it?</option>
            <option>Standard</option>
            <option>Overflow</option>
            <option>Other</option>
          </select>
        )}

        {/* Row picker */}
        {showRow && entry.row === null && (
          <select
            defaultValue=""
            onClick={e => e.stopPropagation()}
            onChange={e => onChange({ row: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
          >
            <option value="" disabled>Select row…</option>
            {rows.map(r => <option key={r}>{r}</option>)}
          </select>
        )}

        {/* Other location text */}
        {showText && !isComplete(entry) && (
          <input
            type="text"
            placeholder="e.g. East fence"
            value={entry.locationText}
            onClick={e => e.stopPropagation()}
            onChange={e => onChange({ locationText: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        )}

        {/* Complete state */}
        {complete && entry.classification !== 'Held' && (
          <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
            ✓ {entryLocationLabel(entry)} · <span className="opacity-60">Tap to edit</span>
          </p>
        )}
        {complete && entry.classification === 'Held' && (
          <p className="text-xs text-red-500 dark:text-red-400 font-semibold">
            Flagged for Hold Bay
          </p>
        )}
      </div>

      {/* Edit sheet */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-2xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Edit Entry
                {entry.needsReview && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">⚠ OCR review</span>}
              </p>
              <button type="button" onClick={() => setEditOpen(false)} className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 cursor-pointer">Done</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unit #</label>
                <input type="text" value={entry.unitNumber} onChange={e => onChange({ unitNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Plate</label>
                <input type="text" value={entry.licensePlate} onChange={e => onChange({ licensePlate: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Make</label>
                <input type="text" value={entry.make} onChange={e => onChange({ make: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                <input type="text" value={entry.model} onChange={e => onChange({ model: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Year</label>
                <input type="number" value={entry.year || ''} onChange={e => onChange({ year: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Color</label>
                <select value={entry.color} onChange={e => onChange({ color: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer">
                  <option value="">Select…</option>
                  {COLORS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Re-classify */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Rentable', 'Dirty'] as const).map(c => (
                  <button key={c} type="button"
                    onClick={() => { hapticLight(); onChange({ classification: c, zone: entry.classification === c ? entry.zone : null, row: null }); }}
                    className={`py-2 rounded-lg text-sm font-semibold transition cursor-pointer border ${
                      entry.classification === c
                        ? c === 'Rentable' ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200' : 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {c === 'Rentable' ? 'A Available' : 'D Dirty'}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone/Row in edit */}
            {entry.classification && entry.classification !== 'Held' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Zone</label>
                  <select value={entry.zone ?? ''} onChange={e => onChange({ zone: e.target.value as Zone || null, row: null, locationText: '' })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer">
                    <option value="">Select…</option>
                    <option>Standard</option>
                    <option>Overflow</option>
                    <option>Other</option>
                  </select>
                </div>
                {(entry.zone === 'Standard' || entry.zone === 'Overflow') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Row</label>
                    <select value={entry.row ?? ''} onChange={e => onChange({ row: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer">
                      <option value="">Select…</option>
                      {(entry.zone === 'Standard' ? STANDARD_ROWS : OVERFLOW_ROWS).map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                {entry.zone === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                    <input type="text" value={entry.locationText} onChange={e => onChange({ locationText: e.target.value })}
                      placeholder="e.g. East fence"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Static inventory card ─────────────────────────────────────────────────────

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
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{unitNumber}</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{licensePlate}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{year} {make} {model}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{locationLabel}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CLASS_BADGE[classification] ?? ''}`}>
          {classification}
        </span>
        <button type="button" onClick={onDismiss}
          className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition cursor-pointer text-sm">
          🗑
        </button>
      </div>
    </div>
  );
}

function HoldCard({
  unitNumber, licensePlate, year, make, model, status, holdTypes,
}: {
  unitNumber: string; licensePlate: string; year: number; make: string; model: string; status: string; holdTypes?: HoldType[];
}) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{unitNumber}</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{licensePlate}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">🔗</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{year} {make} {model}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Hold Bay</p>
      </div>
      <StatusBadge status={status as 'HELD'} holdTypes={holdTypes} />
    </div>
  );
}

// ── ZoneSection ────────────────────────────────────────────────────────────────

function ZoneSection({
  title, count, colorClass, collapsed, onToggle, children,
}: {
  title: string; count: number; colorClass: string;
  collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button type="button" onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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

// ── Main component ─────────────────────────────────────────────────────────────

export function InventoryView({ onHoldIntent }: Props) {
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
  const [holdEscapeHatch, setHoldEscapeHatch] = useState<{ entryId: string; holdType: HoldType } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load today's session on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('inventory_sessions')
      .select('entry_data')
      .eq('branch_id', user.branchId)
      .eq('session_date', localDateStr(0))
      .maybeSingle()
      .then(({ data }) => {
        if (data?.entry_data && Array.isArray(data.entry_data)) {
          setLiveEntries(data.entry_data as LiveEntry[]);
        }
      });
  }, [user]);

  // Debounced session save
  const scheduleSave = useCallback((entries: LiveEntry[]) => {
    if (!user) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('inventory_sessions').upsert({
        branch_id:    user.branchId,
        session_date: localDateStr(0),
        entry_data:   entries,
        created_by:   user.id,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'branch_id,session_date' });
    }, 2000);
  }, [user]);

  const heldVehicles = vehicles
    .filter(v => v.status === 'HELD')
    .sort((a, b) => {
      const aH = getActiveHold(a.id);
      const bH = getActiveHold(b.id);
      return new Date(bH?.flaggedAt ?? 0).getTime() - new Date(aH?.flaggedAt ?? 0).getTime();
    });

  const staticItems  = MOCK_INVENTORY.items.filter(i => !dismissedIds.has(i.id));
  const completedEntries = liveEntries.filter(e => isComplete(e) && !dismissedIds.has(e.id));
  const pendingEntries   = liveEntries.filter(e => !isComplete(e));

  const byZone = (zone: Zone) => ({
    static: staticItems.filter(i => i.zone === zone),
    live:   completedEntries.filter(e => e.zone === zone),
  });

  const standard = byZone('Standard');
  const overflow = byZone('Overflow');
  const other    = byZone('Other');

  const allActive    = [...staticItems, ...completedEntries];
  const rentableCount = allActive.filter(i => i.classification === 'Rentable').length;
  const dirtyCount    = allActive.filter(i => i.classification === 'Dirty').length;
  const holdCount     = heldVehicles.length;

  const toggleCollapse = (zone: string) => setCollapsed(prev => ({ ...prev, [zone]: !prev[zone] }));
  const dismiss = (id: string) => setDismissedIds(prev => new Set([...prev, id]));

  const updateEntry = (id: string, patch: Partial<LiveEntry>) => {
    setLiveEntries(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...patch } : e);
      scheduleSave(next);
      return next;
    });
  };

  const handleScan = (payload: ScannedPayload) => {
    setLiveEntries(prev => [{
      id:            crypto.randomUUID(),
      vehicleId:     payload.vehicleId,
      unitNumber:    payload.unitNumber,
      licensePlate:  payload.licensePlate,
      year:          payload.year,
      make:          payload.make,
      model:         payload.model,
      color:         payload.color,
      rentalClass:   payload.rentalClass,
      owningArea:    payload.owningArea,
      classification: null,
      zone:          null,
      row:           null,
      locationText:  '',
      needsReview:   payload.needsReview,
    }, ...prev]);
  };

  const handleHoldTap = (entryId: string, holdType: HoldType) => {
    const entry = liveEntries.find(e => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { classification: 'Held', holdType });

    // Use vehicleId already resolved from OCR, or look up by plate in GarageContext
    if (entry.vehicleId) {
      onHoldIntent(entry.vehicleId);
      return;
    }
    const match = vehicles.find(v => v.licensePlate.toUpperCase() === entry.licensePlate.toUpperCase());
    if (match) {
      onHoldIntent(match.id);
    } else {
      setHoldEscapeHatch({ entryId, holdType });
    }
  };

  const handleExport = () => {
    if (!user) return;
    const html = generateInventoryExport(
      completedEntries.map(e => ({ ...e, classification: e.classification })),
      {
        date:          new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        location:      'YWG',
        loggedByName:  user.name ?? user.id,
      },
    );
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = inventoryExportFilename();
    a.click();
    URL.revokeObjectURL(url);
    // Mark session as exported
    supabase.from('inventory_sessions')
      .update({ exported_at: new Date().toISOString() })
      .eq('branch_id', user.branchId)
      .eq('session_date', localDateStr(0));
  };

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

      {/* Closing Duties */}
      {activeTab === 'closing-duties' && (
        <>
          <WashbayClosingLog />
          <HandoffSection latestHandoff={latestHandoff} canLog={canLogHandoff(user!.role)} onLogHandoff={() => setShowHandoffForm(true)} />
          <ClosingChecklist defaultOpen={isClosingShift} />
        </>
      )}

      {/* Lot Snapshot */}
      {activeTab === 'lot-snapshot' && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Optical Intake</p>
              <div className="flex items-center gap-3">
                {liveEntries.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{liveEntries.length} scanned</span>
                )}
                {completedEntries.length > 0 && (
                  <button type="button" onClick={handleExport}
                    className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer">
                    Export Session ↓
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <KeytagPhotoScanner onScan={handleScan} />
              {pendingEntries.map(e => (
                <LiveEntryCard
                  key={e.id}
                  entry={e}
                  onChange={patch => updateEntry(e.id, patch)}
                  onHoldTap={holdType => handleHoldTap(e.id, holdType)}
                  onDismiss={() => dismiss(e.id)}
                />
              ))}
              {liveEntries.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Snap a keytag to classify and locate it</p>
              )}
            </div>
          </div>

          {/* Summary tiles */}
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

          <ZoneSection title="Standard" count={standard.static.length + standard.live.length}
            colorClass="text-gray-700 dark:text-gray-300" collapsed={!!collapsed['Standard']} onToggle={() => toggleCollapse('Standard')}>
            {standard.static.map(item => (
              <InventoryCard key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model} classification={item.classification}
                locationLabel={itemLocationLabel(item)} onDismiss={() => dismiss(item.id)} />
            ))}
            {standard.live.map(e => (
              <InventoryCard key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model} classification={e.classification!}
                locationLabel={entryLocationLabel(e)} onDismiss={() => dismiss(e.id)} />
            ))}
          </ZoneSection>

          <ZoneSection title="Overflow" count={overflow.static.length + overflow.live.length}
            colorClass="text-gray-700 dark:text-gray-300" collapsed={!!collapsed['Overflow']} onToggle={() => toggleCollapse('Overflow')}>
            {overflow.static.map(item => (
              <InventoryCard key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model} classification={item.classification}
                locationLabel={itemLocationLabel(item)} onDismiss={() => dismiss(item.id)} />
            ))}
            {overflow.live.map(e => (
              <InventoryCard key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model} classification={e.classification!}
                locationLabel={entryLocationLabel(e)} onDismiss={() => dismiss(e.id)} />
            ))}
          </ZoneSection>

          <ZoneSection title="Hold Bay" count={holdCount}
            colorClass="text-amber-700 dark:text-amber-500" collapsed={!!collapsed['Hold Bay']} onToggle={() => toggleCollapse('Hold Bay')}>
            {heldVehicles.map(v => (
              <HoldCard key={v.id} unitNumber={v.unitNumber} licensePlate={v.licensePlate}
                year={v.year} make={v.make} model={v.model} status={v.status}
                holdTypes={getActiveHold(v.id)?.holdTypes} />
            ))}
          </ZoneSection>

          <ZoneSection title="Other" count={other.static.length + other.live.length}
            colorClass="text-gray-500 dark:text-gray-400" collapsed={!!collapsed['Other']} onToggle={() => toggleCollapse('Other')}>
            {other.static.map(item => (
              <InventoryCard key={item.id} unitNumber={item.unitNumber} licensePlate={item.licensePlate}
                year={item.year} make={item.make} model={item.model} classification={item.classification}
                locationLabel={itemLocationLabel(item)} onDismiss={() => dismiss(item.id)} />
            ))}
            {other.live.map(e => (
              <InventoryCard key={e.id} unitNumber={e.unitNumber} licensePlate={e.licensePlate}
                year={e.year} make={e.make} model={e.model} classification={e.classification!}
                locationLabel={entryLocationLabel(e)} onDismiss={() => dismiss(e.id)} />
            ))}
          </ZoneSection>
        </>
      )}

      {/* Whiteboard */}
      {activeTab === 'whiteboard' && <WhiteboardView />}

      {/* Handoff form */}
      {showHandoffForm && <HandoffForm onClose={() => setShowHandoffForm(false)} />}

      {/* Hold escape hatch */}
      {holdEscapeHatch && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
          onClick={() => setHoldEscapeHatch(null)}>
          <div className="w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-2xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Vehicle not in registry</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This plate isn't linked to a vehicle record. You can open the hold form to search manually, or remove this vehicle from today's inventory if it's not on lot.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button"
                onClick={() => { setHoldEscapeHatch(null); onHoldIntent(undefined); }}
                className="w-full py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 font-semibold text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer">
                Open Hold Form (search manually)
              </button>
              <button type="button"
                onClick={() => { dismiss(holdEscapeHatch.entryId); setHoldEscapeHatch(null); }}
                className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer">
                Not on lot — Remove from inventory
              </button>
              <button type="button" onClick={() => setHoldEscapeHatch(null)}
                className="text-xs text-gray-400 dark:text-gray-500 text-center cursor-pointer hover:underline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
