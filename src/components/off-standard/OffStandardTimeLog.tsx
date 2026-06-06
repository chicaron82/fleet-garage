import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useSchedule } from '../../context/ScheduleContext';
import type { OffStandardReason, OffStandardPresetReason, User } from '../../types';
import { OFF_STANDARD_LABELS } from '../../types';
import { OffStdEditSheet } from './OffStdEditSheet';
import { BackdateEntrySheet } from './BackdateEntrySheet';
import { useUserResolver } from '../../hooks/useUserResolver';
import { fmtTime, fmtMinutes } from '../../lib/offStandardReport';
import { ElapsedTicker } from '../shared/ElapsedTicker';
import { OffStandardEntriesList } from './OffStandardEntriesList';
import { useOffStandardTimer } from '../../hooks/useOffStandardTimer';
import { OffStdQuickStart } from './OffStdQuickStart';
import { OffStdRecentHistory } from './OffStdRecentHistory';
import { EDVNoMatchFields } from './EDVNoMatchFields';

const REASONS: OffStandardReason[] = ['CLASS', 'WFW', 'MTG', 'WTH', 'OTH'];

interface Props {
  user: User;
  refreshTrigger?: number;
}

export function OffStandardTimeLog({ user, refreshTrigger }: Props) {
  const { holds, vehicles } = useVehicleHoldContext();
  const { shifts } = useSchedule();
  const { getName: resolveName } = useUserResolver();
  const [showBackdate, setShowBackdate] = useState(false);

  const {
    isRecovering,
    timerState,
    selectedReason,
    setSelectedReason,
    startTimestamp,
    stopTimestamp,
    pendingMinutes,
    explanation,
    setExplanation,
    copied,
    startError,
    endError,
    entries,
    editingEntry,
    setEditingEntry,
    selectedPreset,
    edvLinkedHoldId,
    edvUnitNumber,
    edvManagerName,
    edvNoMatch,
    edvPlate,
    setEdvPlate,
    edvExterior,
    setEdvExterior,
    edvInterior,
    setEdvInterior,
    selectPreset,
    saveNotes,
    handleStart,
    handleQuickTap,
    handleEnd,
    handleDiscard,
    handleSubmitBackdate,
    handleSaveEdit,
    handleRequestEdit,
    handleExport,
    handlePDFExport,
    pdfLoading,
  } = useOffStandardTimer({
    user,
    refreshTrigger,
    holds,
    vehicles,
    shifts,
    resolveName,
  });

  const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';

  return (
    <>
    <div className="space-y-5">

      {/* Quick Start */}
      <OffStdQuickStart
        timerState={timerState}
        isRecovering={isRecovering}
        handleQuickTap={handleQuickTap}
        onBackdate={() => setShowBackdate(true)}
        startError={startError}
      />

      {/* Timer card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Off-Standard Time</p>
        </div>
        <div className="p-4 space-y-4">

          {/* Reason pills — disabled while running or complete */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Reason</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  disabled={timerState !== 'idle'}
                  onClick={() => { if (timerState === 'idle') { hapticLight(); setSelectedReason(r); } }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:cursor-default ${
                    selectedReason === r
                      ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {r} · {OFF_STANDARD_LABELS[r].full}
                </button>
              ))}
            </div>
          </div>

          {/* Preset selector — visible when OTH selected and timer idle */}
          {selectedReason === 'OTH' && timerState === 'idle' && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Quick reason (optional)</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'fleeting_cars',   label: 'Fleeting Cars' },
                  { value: 'fleeting_sent',   label: 'Fleeting — Sent Up' },
                  { value: 'closing_duties',  label: 'Closing Duties' },
                  { value: 'opening_duties',  label: 'Opening Duties' },
                  { value: 'lot_organization', label: 'Lot Organization' },
                  { value: 'edv',             label: 'EDV' },
                  { value: 'customer_pickup', label: 'Customer Pickup/Drop-off' },
                ] as { value: OffStandardPresetReason; label: string }[]).map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => selectPreset(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      selectedPreset === p.value
                        ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Fleeting: which preset to pick — affects the rate denominator */}
              {(selectedPreset === 'fleeting_cars' || selectedPreset === 'fleeting_sent') && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-700 dark:text-blue-400">
                  {selectedPreset === 'fleeting_sent'
                    ? 'Cars went up to fleet — counted as sent, so this time won\'t reduce your rate.'
                    : 'Prepped but stayed on the lot (no plates yet) — this time is credited back to your rate.'}
                </div>
              )}

              {/* EDV auto-populate result */}
              {selectedPreset === 'edv' && !edvNoMatch && edvLinkedHoldId && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 text-xs space-y-0.5">
                  <p className="font-semibold text-teal-800 dark:text-teal-300">Hold matched</p>
                  <p className="text-teal-700 dark:text-teal-400">Unit: <span className="font-medium">{edvUnitNumber}</span></p>
                  <p className="text-teal-700 dark:text-teal-400">Released by: <span className="font-medium">{edvManagerName}</span></p>
                  <p className="text-teal-600 dark:text-teal-500 mt-1">💡 Typical EDV clean: 30–40 min</p>
                </div>
              )}

              {/* EDV no-match: plate + condition pills */}
              {selectedPreset === 'edv' && edvNoMatch && (
                <EDVNoMatchFields
                  plate={edvPlate}
                  onPlateChange={setEdvPlate}
                  exterior={edvExterior}
                  onExteriorChange={setEdvExterior}
                  interior={edvInterior}
                  onInteriorChange={setEdvInterior}
                />
              )}
            </div>
          )}

          <p className="text-xs text-blue-600 dark:text-blue-400">
            🔗 Airport trips log automatically from the Movement Log — no need to add them here.
          </p>

          {/* Start error */}
          {startError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
            </div>
          )}

          {/* idle → Start (or recovering placeholder) */}
          {timerState === 'idle' && (
            isRecovering ? (
              <div className="flex items-center justify-center py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">Resuming session…</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold transition cursor-pointer"
              >
                Start
              </button>
            )
          )}

          {/* running → elapsed + notes + End */}
          {timerState === 'running' && (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-4 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">
                  {selectedReason} · {OFF_STANDARD_LABELS[selectedReason].full}
                </p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  <ElapsedTicker startTime={startTimestamp} />
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                  Started {fmtTime(startTimestamp)}
                </p>
              </div>
              {selectedPreset === 'edv' && edvNoMatch && (
                <EDVNoMatchFields
                  plate={edvPlate} onPlateChange={setEdvPlate}
                  exterior={edvExterior} onExteriorChange={setEdvExterior}
                  interior={edvInterior} onInteriorChange={setEdvInterior}
                />
              )}
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="e.g. Waiting for dirties to arrive…"
                  className={INPUT}
                />
              </div>
              {endError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleEnd}
                className="w-full py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer"
              >
                End
              </button>
            </div>
          )}

          {/* complete → saved card + notes still editable + Done */}
          {timerState === 'complete' && (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">✓ Entry saved</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {selectedReason} · {fmtTime(startTimestamp)} – {fmtTime(stopTimestamp)} · {fmtMinutes(pendingMinutes)}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="e.g. Waiting for dirties to arrive…"
                  className={INPUT}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleDiscard}
                className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Entry list */}
      <OffStandardEntriesList entries={entries} onEditClick={setEditingEntry} />

      {/* Recent OTH history */}
      <OffStdRecentHistory user={user} shifts={shifts} />

      {/* Today's export */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={pdfLoading}
          className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? '✓ Copied' : '📄 Plain Text'}
        </button>
        <button
          type="button"
          onClick={handlePDFExport}
          disabled={pdfLoading}
          className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfLoading ? 'Building PDF…' : '📋 PDF'}
        </button>
      </div>

    </div>

    {editingEntry && (
      <OffStdEditSheet
        entry={editingEntry}
        onSave={handleSaveEdit}
        onRequest={handleRequestEdit}
        onClose={() => setEditingEntry(null)}
      />
    )}

    {showBackdate && (
      <BackdateEntrySheet
        onSubmit={(s, e, r, n) => { handleSubmitBackdate(s, e, r, n); setShowBackdate(false); }}
        onClose={() => setShowBackdate(false)}
      />
    )}
    </>
  );
}
