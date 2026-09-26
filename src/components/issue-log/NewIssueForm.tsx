import { useState } from 'react';
import { useIssueContext } from '../../context/IssueContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useWriteGuard } from '../../hooks/useWriteGuard';
import { PhotoError } from '../shared/PhotoError';
import type { FacilityIssue, IssueSeverity } from '../../types';

// The New Issue form, with its duplicate catch and "Reopen instead".
//
// Its own file because IssueLogView reached 326 lines (docs/September/ticket-split-issue-card.md).
// ⚠️ And the reason it is not only a move: "Reopen instead" fired `reopenIssue` into a `void`, so a
// reopen that failed closed the form and cleared what he'd typed, with nothing said. Both doors now
// wait for the write and keep the form (and his words) when it doesn't land. Same channel as
// hooks/useWriteGuard: "a tap that didn't save now says so".

const SEVERITY_CONFIG: Record<IssueSeverity, { icon: string; label: string }> = {
  low:    { icon: '🟢', label: 'Low' },
  medium: { icon: '🟡', label: 'Medium' },
  high:   { icon: '🔴', label: 'High' },
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';

export function NewIssueForm({ issues, onClose }: { issues: FacilityIssue[]; onClose: () => void }) {
  const { addIssue, reopenIssue } = useIssueContext();
  const { photoError, takeOne } = usePhotoIntake();
  const { writeError, guard } = useWriteGuard();

  const [newTitle, setNewTitle]             = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity]       = useState<IssueSeverity>('medium');
  const [newPhoto, setNewPhoto]             = useState<string | null>(null);
  const [submitting, setSubmitting]         = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const photo = await takeOne(file);
    if (photo) setNewPhoto(photo);
    e.target.value = '';
  };

  const handleSubmitNew = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    hapticMedium();
    const ok = await guard(
      () => addIssue({ title: newTitle.trim(), description: newDescription.trim() || undefined, severity: newSeverity, photo: newPhoto ?? undefined }),
      "That didn't save — tap it again.",
    );
    setSubmitting(false);
    if (ok) onClose();
  };

  // ⚠️ The SECOND reopen door, and it must obey the card's rule (08d4bee): the note is the fault.
  // Aaron, 2026-09-24: *"couldn't explain what broke."* The description he wrote IS the note, and the
  // photo rides on the reopen as THIS fault's picture.
  const handleReopenDuplicate = async (dup: FacilityIssue) => {
    const note = newDescription.trim();
    if (!note) return;
    setSubmitting(true);
    hapticMedium();
    const ok = await guard(() => reopenIssue(dup.id, note, newPhoto ?? undefined), "The reopen didn't save — tap it again.");
    setSubmitting(false);
    if (ok) onClose();
  };

  // Catch a duplicate before it's created: does the typed title match an existing issue (open or
  // cleared)? Either-direction substring so "Mat" finds "Mat machine electrical" and vice versa. The
  // cleared case is the dangerous one — a fixed problem re-logged as new instead of reopened.
  const titleQ = newTitle.trim().toLowerCase();
  const duplicateMatch = titleQ.length >= 3
    ? issues.find(i => i.title.toLowerCase().includes(titleQ) || titleQ.includes(i.title.toLowerCase()))
    : undefined;

  return (
    <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10 p-4 space-y-3">
      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">New Issue</p>

      <input
        type="text"
        placeholder="Title (required)"
        value={newTitle}
        onChange={e => setNewTitle(e.target.value)}
        className={inputCls}
        autoFocus
      />

      {duplicateMatch && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">"{duplicateMatch.title}"</span> already exists
            {duplicateMatch.status === 'resolved'
              ? ' (cleared). Reopen it instead of logging a duplicate?'
              : ' and is already open.'}
          </p>
          {duplicateMatch.status === 'resolved' && !newDescription.trim() && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Say what&apos;s wrong this time in the description first.</p>
          )}
          {duplicateMatch.status === 'resolved' && (
            <button
              type="button"
              disabled={!newDescription.trim()}
              onClick={() => handleReopenDuplicate(duplicateMatch)}
              className="px-3 py-1.5 rounded-lg border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              ↩ Reopen instead
            </button>
          )}
        </div>
      )}

      <textarea
        placeholder="Description (optional)"
        value={newDescription}
        onChange={e => setNewDescription(e.target.value)}
        rows={2}
        className={`${inputCls} resize-none`}
      />

      {/* Photo (optional) */}
      <div className="flex items-center gap-3">
        {newPhoto ? (
          <>
            <img src={newPhoto} alt="Issue" className="w-14 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
            <button type="button" onClick={() => setNewPhoto(null)} className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer">
              Remove photo
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <label className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer">
              📷 Take photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            </label>
            <label className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer">
              Gallery
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <PhotoError message={photoError} />
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(['low', 'medium', 'high'] as IssueSeverity[]).map(s => {
          const cfg    = SEVERITY_CONFIG[s];
          const active = newSeverity === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => { hapticLight(); setNewSeverity(s); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                active
                  ? 'bg-fg-yellow border-fg-yellow text-black'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {writeError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{writeError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmitNew}
          disabled={!newTitle.trim() || submitting}
          className="flex-1 py-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Logging…' : '+ Log Issue'}
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); onClose(); }}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
