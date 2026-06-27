// Schedule-from-photo import (Phase 1: parse + preview, NO write). Upload a printed
// schedule → vision parses it to a typed grid → verify it against the photo, assigning any
// unmatched names. Writing the shifts is Phase 2 — this modal deliberately writes nothing.
import { useState, useMemo, useRef } from 'react';
import { useProfiles } from '../../context/ProfilesContext';
import { useScheduleImport } from '../../hooks/useScheduleImport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { compressImage } from '../../lib/image';
import { matchSchedule, type RosterProfile } from '../../../api/_lib/scheduleParse';
import { ScheduleImportGrid } from './ScheduleImportGrid';

export function ScheduleImportModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const profiles = useProfiles();
  const roster: RosterProfile[] = useMemo(
    () => [...profiles.values()].map((p) => ({ id: p.id, name: p.name })),
    [profiles],
  );
  const { status, schedule, error, parse, reset } = useScheduleImport();
  const [image, setImage] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Name→profile assignments are DERIVED: the matcher's result with any manual
  // reassignments layered on top — so editing a row needs no sync effect.
  const matched = useMemo(
    () => (schedule ? matchSchedule(schedule.staff, roster).map((m) => m.profileId) : []),
    [schedule, roster],
  );
  const assignments = matched.map((m, i) => (i in overrides ? overrides[i] : m));

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await compressImage(file);
    setOverrides({});
    setImage(dataUrl);
    void parse(dataUrl);
  };

  const retake = () => {
    setOverrides({});
    setImage(null);
    reset();
  };

  const unmatchedCount = assignments.filter((a) => !a).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-colors dark:bg-gray-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import schedule from photo</p>
            <p className="text-[11px] text-gray-400">Review only — writing the shifts comes next.</p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!image && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">Photograph or upload the printed staff schedule.</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-lg bg-fg-yellow px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-fg-yellow-hi"
              >
                📷 Choose schedule photo
              </button>
            </div>
          )}

          {image && status === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <img src={image} alt="Schedule" className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
              <p className="animate-pulse text-sm text-gray-500 dark:text-gray-400">Reading the schedule…</p>
            </div>
          )}

          {image && status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button onClick={retake} className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700">Try another photo</button>
            </div>
          )}

          {image && status === 'done' && schedule && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <img src={image} alt="Schedule" className="max-h-40 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {schedule.staff.length === 0
                    ? "Couldn't find any staff rows — make sure the photo is a staff schedule."
                    : <>Parsed <b>{schedule.staff.length}</b> staff{schedule.weekStart ? ` · week of ${schedule.weekStart}` : ''}. Check each row against the photo.{unmatchedCount > 0 && <span className="text-rose-600 dark:text-rose-400"> {unmatchedCount} name{unmatchedCount === 1 ? '' : 's'} need assigning.</span>}</>}
                </p>
              </div>
              {schedule.staff.length > 0 && (
                <ScheduleImportGrid
                  schedule={schedule}
                  roster={roster}
                  assignments={assignments}
                  onAssign={(i, id) => setOverrides((o) => ({ ...o, [i]: id }))}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {image && status === 'done' && (
            <button onClick={retake} className="cursor-pointer text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-400">↻ Different photo</button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-gray-400">Writing the schedule is the next phase.</span>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
