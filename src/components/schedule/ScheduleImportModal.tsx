// Schedule-from-photo import. Upload a printed schedule (single week OR a stacked multi-
// week sheet) → vision parses it to a typed grid with REAL dates + REAL times → verify
// against the photo (reassign names, tap a cell to fix its type) → Confirm writes it. The
// write REPLACES the parsed date span for the imported people (wipe-then-create via
// importWeekShifts); the parse never writes — only this confirm tap does.
import { useState, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProfiles } from '../../context/ProfilesContext';
import { useSchedule } from '../../context/ScheduleContext';
import { useScheduleImport } from '../../hooks/useScheduleImport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { compressDocumentImage, readFileAsDataUrl } from '../../lib/image';
import { getTypeDefaults } from '../../lib/shiftDefaults';
import { isFullDayShift } from '../../types';
import { matchSchedule, type RosterProfile, type ParsedShiftType } from '../../../api/_lib/scheduleParse';
import { buildImportShifts, dateRange, nextType, type ImportRow } from '../../lib/scheduleImportBuild';
import { isStatDay } from '../../lib/stats';
import { findClopens, formatClopen } from '../../lib/scheduleClopens';
import { ScheduleImportGrid } from './ScheduleImportGrid';

export function ScheduleImportModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const profiles = useProfiles();
  const { importWeekShifts, isPeakSeason } = useSchedule();
  const { user } = useAuth();
  const roster: RosterProfile[] = useMemo(
    () => [...profiles.values()].map((p) => ({ id: p.id, name: p.name })),
    [profiles],
  );
  const { status, schedule, error, degraded, parse, reset } = useScheduleImport();

  const [image, setImage] = useState<string | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<number, string | null>>({});
  const [cellOverrides, setCellOverrides] = useState<Record<string, ParsedShiftType>>({});
  const [writeState, setWriteState] = useState<'idle' | 'writing' | 'done' | 'error'>('idle');
  const [writeMsg, setWriteMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Derived (no sync effects): matcher result + manual overrides layered on top.
  const matched = useMemo(
    () => (schedule ? matchSchedule(schedule.staff, roster).map((m) => m.profileId) : []),
    [schedule, roster],
  );
  const assignments = matched.map((m, i) => (i in nameOverrides ? nameOverrides[i] : m));

  const typeAt = (ri: number, ci: number): ParsedShiftType =>
    cellOverrides[`${ri}-${ci}`] ?? schedule!.staff[ri].cells[ci].type;
  const typesGrid = (schedule?.staff ?? []).map((row, ri) => row.cells.map((_, ci) => typeAt(ri, ci)));

  // My own clopens in the parsed block — the row assigned to me, swept for closing→opening
  // back-to-backs. Runs on the preview, BEFORE the write, so I can push back while it's fixable.
  const myRow = user ? assignments.findIndex((a) => a === user.id) : -1;
  const myClopens = myRow >= 0 && schedule
    ? findClopens(schedule.staff[myRow].cells.map((c, ci) => ({ date: c.date ?? '', type: typesGrid[myRow][ci] })).filter((x) => x.date))
    : [];

  const assignedCount = assignments.filter(Boolean).length;
  const unmatchedCount = (schedule?.staff.length ?? 0) - assignedCount;
  const allDates = (schedule?.staff ?? []).flatMap((s) => s.cells.map((c) => c.date)).filter((d): d is string => !!d).sort();
  const span = allDates.length ? `${allDates[0]} → ${allDates[allDates.length - 1]}` : '';
  const isPdfDoc = !!image?.startsWith('data:application/pdf');
  const thumb = (imgCls: string) =>
    isPdfDoc ? (
      <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xl">📄</span>
        <span className="text-[10px] font-medium">PDF</span>
      </div>
    ) : (
      <img src={image!} alt="Schedule" className={imgCls} />
    );

  const resetAll = () => {
    setNameOverrides({});
    setCellOverrides({});
    setWriteState('idle');
    setWriteMsg('');
  };
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // A PDF goes as-is (Claude reads it natively, crisper than a photo); an image is
    // compressed at document detail.
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressDocumentImage(file);
    resetAll();
    setImage(dataUrl);
    void parse(dataUrl);
  };
  const retake = () => {
    resetAll();
    setImage(null);
    reset();
  };
  const onCycleCell = (ri: number, ci: number) =>
    setCellOverrides((o) => ({ ...o, [`${ri}-${ci}`]: nextType(typeAt(ri, ci)) }));

  const confirmWrite = async () => {
    if (!schedule) return;
    setWriteState('writing');
    setWriteMsg('');
    try {
      const userIds: string[] = [];
      const rows: ImportRow[] = [];
      schedule.staff.forEach((row, ri) => {
        const uid = assignments[ri];
        if (!uid) return;
        userIds.push(uid);
        rows.push({
          userId: uid,
          cells: row.cells.map((c, ci) => ({ date: c.date, type: typeAt(ri, ci), startTime: c.startTime, endTime: c.endTime })),
        });
      });
      const shifts = buildImportShifts(rows, getTypeDefaults(isPeakSeason), isFullDayShift, isStatDay);
      const range = dateRange(shifts);
      if (!range) {
        setWriteMsg('Nothing to write — no dated shifts found.');
        setWriteState('error');
        return;
      }
      const outcome = await importWeekShifts(userIds, range.start, range.end, shifts);
      // Name what was KEPT, not just what was written — a sheet that omits approved time off
      // is the normal case, and silently keeping it would be as confusing as silently losing it.
      const kept = outcome.preserved.length
        ? ` Kept ${outcome.preserved.length} booked day${outcome.preserved.length === 1 ? '' : 's'} off the sheet didn't show (${outcome.preserved
            .map((p) => p.date)
            .sort()
            .join(', ')}) — change any that were actually cancelled.`
        : '';
      setWriteMsg(`Wrote ${outcome.written} shifts for ${userIds.length} staff · ${range.start} → ${range.end}.${kept}`);
      setWriteState('done');
    } catch (e) {
      setWriteMsg(e instanceof Error ? e.message : 'Could not write the schedule.');
      setWriteState('error');
    }
  };

  const canWrite = assignedCount > 0 && allDates.length > 0 && writeState !== 'writing';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-colors dark:bg-gray-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import schedule from photo</p>
            <p className="text-[11px] text-gray-400">Verify against the photo, then confirm to write.</p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!image && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">Upload a <b>photo or PDF</b> of the printed staff schedule (a single week or a multi-week sheet). A PDF reads most reliably.</p>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPick} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-lg bg-fg-yellow px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-fg-yellow-hi">
                📄 Choose photo or PDF
              </button>
            </div>
          )}

          {image && status === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-12">
              {thumb('max-h-48 rounded-lg border border-gray-200 dark:border-gray-700')}
              <p className="animate-pulse text-sm text-gray-500 dark:text-gray-400">Reading the schedule…</p>
            </div>
          )}

          {image && status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button onClick={retake} className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700">Try another photo</button>
            </div>
          )}

          {image && status === 'done' && schedule && writeState === 'done' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="rounded-full bg-green-100 p-3 text-2xl dark:bg-green-500/20">✓</div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">{writeMsg}</p>
              <button onClick={onClose} className="cursor-pointer rounded-lg bg-fg-yellow px-4 py-2 text-sm font-semibold text-black hover:bg-fg-yellow-hi">Done</button>
            </div>
          )}

          {image && status === 'done' && schedule && writeState !== 'done' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                {thumb('max-h-40 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700')}
                <p className="min-w-[12rem] flex-1 text-xs text-gray-500 dark:text-gray-400">
                  {schedule.staff.length === 0
                    ? "Couldn't find any staff rows — make sure the photo is a staff schedule."
                    : <>Parsed <b>{schedule.staff.length}</b> staff{span ? <> · <b>{span}</b></> : ''}. Check each row against the photo; tap a cell to fix its type. On confirm, each assigned person's existing shifts in that range are <b>deleted and replaced</b>.{unmatchedCount > 0 && <span className="text-rose-600 dark:text-rose-400"> {unmatchedCount} unassigned (skipped).</span>}</>}
                </p>
              </div>
              {degraded && (
                <div className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5 dark:border-orange-900/60 dark:bg-orange-900/15">
                  <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                    ⚠ Read by the backup model
                  </p>
                  <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-400">
                    The usual reader was unavailable, so a backup one parsed this sheet. It&rsquo;s more likely to
                    misread a cramped or angled cell — check the times against the photo a little harder than usual.
                  </p>
                </div>
              )}
              {myRow >= 0 && (
                myClopens.length > 0 ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-900/15">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      🔁 Heads up — this schedule gives you {myClopens.length} clopen{myClopens.length === 1 ? '' : 's'}:
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {myClopens.map(formatClopen).join('  ·  ')}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-500/70">Closing then opening the next day — flag it with the boss or brace for it.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-900/15 dark:text-green-400">
                    ✓ No clopens for you in this block.
                  </div>
                )
              )}
              {schedule.staff.length > 0 && (
                <ScheduleImportGrid
                  schedule={schedule}
                  roster={roster}
                  assignments={assignments}
                  types={typesGrid}
                  onAssign={(i, id) => setNameOverrides((o) => ({ ...o, [i]: id }))}
                  onCycleCell={onCycleCell}
                />
              )}
              {writeState === 'error' && <p className="text-xs text-red-500">{writeMsg}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {image && status === 'done' && writeState !== 'done' && (
            <button onClick={retake} className="cursor-pointer text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-400">↻ Different photo</button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {image && status === 'done' && writeState !== 'done' && (assignedCount > 0 ? (
              <button
                onClick={confirmWrite}
                disabled={!canWrite}
                className="cursor-pointer rounded-lg bg-fg-yellow px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-fg-yellow-hi disabled:cursor-not-allowed disabled:opacity-40"
              >
                {writeState === 'writing' ? 'Writing…' : `Confirm & write · replaces ${span || 'these dates'}`}
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">Assign at least one name to write.</span>
            ))}
            <button onClick={onClose} className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              {writeState === 'done' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
