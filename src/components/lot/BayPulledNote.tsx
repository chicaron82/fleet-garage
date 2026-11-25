// A note of his own on Pulled away (2026-11-25, migration 172, docs/ticket-lot-bay-pulled-away-note.md). Aaron:
// *"adding a custom note to the read-only link when I get pulled away it's serves as a little heads up"*.
// Optional: Pulled away is still one tap; this sits in the strip after. His last few notes are one-tap picks. The note
// shows on the read-only page only while the pause holds; Back or any count tap ends it. HIS words, so the app's own
// rule (never say what the work was) still holds: it volunteers nothing.
import { useState } from 'react';
import { PAUSE_NOTE_MAX } from '../../lib/lotBay';
import { readPulledNotes, rememberNote, savePulledNotes, tidyNote } from '../../lib/pulledNotes';

const CHIP = 'max-w-full truncate rounded-full border border-sky-300 dark:border-sky-700 bg-white dark:bg-sky-900 px-3 py-1 text-xs font-semibold text-sky-900 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-800 cursor-pointer';

export function BayPulledNote({ note, onNote }: { note: string | null; onNote: (note: string | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>(readPulledNotes);

  const save = async (raw: string | null) => {
    const n = raw == null ? null : tidyNote(raw) || null;
    setBusy(true);
    const ok = await onNote(n);
    setBusy(false);
    if (!ok) return;
    if (n) { const next = rememberNote(recent, n); setRecent(next); savePulledNotes(next); }
    setDraft(''); setEditing(false);
  };

  if (note && !editing) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 text-sm text-sky-900 dark:text-sky-100">
        <p className="min-w-0">On the read-only page: <span className="font-semibold">“{note}”</span></p>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" disabled={busy} onClick={() => { setDraft(note); setEditing(true); }} className={CHIP}>Change</button>
          <button type="button" disabled={busy} onClick={() => void save(null)} className={CHIP}>Remove</button>
        </div>
      </div>
    );
  }

  const picks = recent.filter(r => r !== note);
  return (
    <form className="mt-2 space-y-2" onSubmit={e => { e.preventDefault(); if (tidyNote(draft)) void save(draft); }}>
      <div className="flex gap-2">
        <input type="text" value={draft} maxLength={PAUSE_NOTE_MAX} onChange={e => setDraft(e.target.value)}
          aria-label="Note for the read-only page" placeholder="Add a note for the read-only page (optional)"
          className="min-w-0 flex-1 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500" />
        <button type="submit" disabled={busy || !tidyNote(draft)}
          className="shrink-0 rounded-xl border border-sky-600 px-3 py-2 text-sm font-bold text-sky-700 dark:text-sky-200 disabled:opacity-40 cursor-pointer">
          Save
        </button>
      </div>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Recent notes">
          {picks.map(p => <button key={p} type="button" disabled={busy} onClick={() => void save(p)} className={CHIP}>{p}</button>)}
        </div>
      )}
    </form>
  );
}
