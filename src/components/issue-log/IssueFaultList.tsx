import { useState } from 'react';
import { useIssueContext } from '../../context/IssueContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useWriteGuard } from '../../hooks/useWriteGuard';
import { PhotoError } from '../shared/PhotoError';
import { daysOpen } from './issueDate';
import type { FacilityIssue } from '../../types';
import type { IssueFault } from '../../../api/_lib/issueFaults';

// Every open fault on one machine — its own note, photo, day count and Clear (migration 150).
//
// ⭐ Aaron, 2026-09-24, at the auto wash: *"there's also another issue … The wheel brush on the
// passenger side isn't spinning. That one has been non functional for a month now"* — on top of the
// rinse pipe that snapped that afternoon. Two faults, fixed on different days, one machine.
// His picks: each fault clears on its own; "+ Add fault" on the card; each counts its own days.
// docs/September/ticket-faults-as-rows.md
//
// Its own file because IssueCard was over the line cap; the fault UI is what moved out.

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';
const linkCls = 'text-xs text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer';

export function IssueFaultList({ issue, getUserName }: { issue: FacilityIssue; getUserName: (id: string) => string }) {
  const { addFault } = useIssueContext();
  const { writeError, guard } = useWriteGuard();
  const faults = issue.faults ?? [];
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className="space-y-2">
      {faults.map(f => (
        <FaultRow key={f.id} fault={f} alone={faults.length === 1} getUserName={getUserName} />
      ))}

      {adding ? (
        <div className="space-y-2 pt-1">
          <input type="text" placeholder="What else is wrong with it?" value={note}
            onChange={e => setNote(e.target.value)} className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button type="button" disabled={!note.trim()}
              onClick={async () => { hapticMedium(); if (await guard(() => addFault(issue.id, note.trim()), "That didn't save — tap it again.")) { setNote(''); setAdding(false); } }}
              className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed">
              + Add fault
            </button>
            <button type="button" onClick={() => { hapticLight(); setAdding(false); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 transition cursor-pointer">
              Cancel
            </button>
          </div>
          {writeError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{writeError}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => { hapticLight(); setAdding(true); }} className={linkCls}>
          + Add fault
        </button>
      )}
    </div>
  );
}

/** One fault. Its own Clear appears only when the machine has others — with one fault, the card's
 *  own Clear already means "this is fixed", and two buttons for one act would imply a difference. */
function FaultRow({ fault, alone, getUserName }: { fault: IssueFault; alone: boolean; getUserName: (id: string) => string }) {
  const { clearFault, attachFaultPhoto } = useIssueContext();
  const { photoError, takeOne } = usePhotoIntake();
  const { writeError, guard } = useWriteGuard();
  const [clearing, setClearing] = useState(false);
  const [clearNote, setClearNote] = useState('');
  const [uploading, setUploading] = useState(false);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const compressed = await takeOne(file);
    if (compressed) await guard(() => attachFaultPhoto(fault, compressed), "The photo didn't save — try it again.");
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className={alone ? 'space-y-1.5' : 'space-y-1.5 rounded-lg border border-gray-100 dark:border-gray-800 p-2'}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{fault.note}"</p>
          {/* Its own count: the brush is Day 31 while the pipe is Today. */}
          {!alone && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {getUserName(fault.openedBy)} · {daysOpen(fault.openedAt)}
            </p>
          )}
        </div>
        {!alone && !clearing && (
          <button type="button" onClick={() => { hapticLight(); setClearing(true); }}
            className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 transition cursor-pointer">
            Clear
          </button>
        )}
      </div>

      {fault.photoUrl ? (
        <img loading="lazy" src={fault.photoUrl} alt="Issue photo"
          className="w-full max-h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
      ) : uploading ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Uploading…</p>
      ) : (
        <div className="flex items-center gap-3">
          <label className={linkCls}>+ Add photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          </label>
          <label className={linkCls}>Gallery
            <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </label>
          <PhotoError message={photoError} />
        </div>
      )}
      {writeError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{writeError}</p>}

      {clearing && (
        <div className="space-y-2">
          <input type="text" placeholder="What fixed it? (optional)" value={clearNote}
            onChange={e => setClearNote(e.target.value)} className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button type="button"
              onClick={async () => { hapticMedium(); if (await guard(() => clearFault(fault, clearNote.trim() || undefined), "That didn't save — tap it again.")) setClearing(false); }}
              className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition cursor-pointer">
              ✓ Clear this fault
            </button>
            <button type="button" onClick={() => { hapticLight(); setClearing(false); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 transition cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
