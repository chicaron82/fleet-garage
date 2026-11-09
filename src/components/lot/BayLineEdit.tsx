// The two things he can do to a finished line on the bay log, FG only (docs/ticket-bay-erin-exit-notes-existing-hold.md):
//
// • 📝 A note. Aaron, 2026-11-04: *"on the cleaned list I could add notes to certain ones if needed"*, and they *"can be
//   seen via the read-only link"*. One line, 140 at most (migration 164's check), Save / Clear. A note that did not save
//   stays in the box and says so (CLAUDE.md, "a write that fails must SAY so").
// • Flag it, with the hold already on the car: *"For M and B, if it has an existing flag on it maybe having it available
//   to select?"* → *"Keeping the same flow, going back to it later on the cleaned list"*. The exit stayed one tap; here,
//   "Same as the Oct 28 hold" is one tap and "New hold →" is the form, as Flag it always was.
import { useState } from 'react';
import { NOTE_MAX_CHARS } from '../../lib/lotBayLog';

const QUIET = 'min-h-9 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 text-xs font-bold text-gray-800 dark:text-gray-100 cursor-pointer touch-manipulation disabled:opacity-40';

export function BayNoteEditor({ initial, onSave, onClose }: {
  initial: string;
  /** Null clears the note. Resolves the error text, or null when it saved. */
  onSave: (note: string | null) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (note: string | null) => {
    setBusy(true);
    const e = await onSave(note);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };
  const left = NOTE_MAX_CHARS - draft.trim().length;
  return (
    <div className="space-y-1.5 pt-1">
      <input type="text" value={draft} autoFocus maxLength={NOTE_MAX_CHARS} aria-label="Note"
        onChange={e => { setDraft(e.target.value); setErr(null); }}
        onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) void save(draft); }}
        placeholder="A note on this car"
        className="w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 text-sm text-gray-900 dark:text-gray-100" />
      {err && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{err}</p>}
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void save(draft)}
          className="min-h-9 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-3 text-xs font-bold text-black cursor-pointer touch-manipulation disabled:opacity-40">
          Save
        </button>
        {initial && <button type="button" disabled={busy} onClick={() => void save(null)} className={QUIET}>Clear</button>}
        <button type="button" disabled={busy} onClick={onClose} className={QUIET}>Cancel</button>
        {left < 20 && <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">{left} left</span>}
      </div>
    </div>
  );
}

/** His delete (2026-11-06, docs/ticket-bay-remove-a-row.md): *"We need a delete option for me"*. Asked in the line, never
 *  a dialog. A refusal or a failed save stays here and says so. */
export function BayRemoveConfirm({ what, onRemove, onClose }: {
  /** "LUR367 · Clean 16:40" */
  what: string;
  /** Resolves the error text, or null when it came off. */
  onRemove: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    const e = await onRemove();
    setBusy(false);
    if (e) setErr(e); else onClose();
  };
  return (
    <div role="group" aria-label="Remove from the list" className="space-y-1.5 pt-1">
      <p className="text-xs text-gray-700 dark:text-gray-200">Remove {what} from today's list? The count goes back with it.</p>
      {err && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{err}</p>}
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={busy} onClick={() => void remove()}
          className="min-h-9 rounded-lg bg-red-600 hover:bg-red-700 px-3 text-xs font-bold text-white cursor-pointer touch-manipulation disabled:opacity-40">
          Remove
        </button>
        <button type="button" disabled={busy} onClick={onClose} className={QUIET}>Keep</button>
      </div>
    </div>
  );
}

export interface SameHoldChoice { id: string; label: string }

export function BayFlagChoices({ choices, onSame, onNew, onClose }: {
  choices: readonly SameHoldChoice[];
  /** Resolves the error text, or null when it linked. */
  onSame: (holdId: string) => Promise<string | null>;
  onNew: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const same = async (id: string) => {
    setBusy(true);
    const e = await onSame(id);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };
  return (
    <div role="group" aria-label="Flag it" className="space-y-1.5 pt-1">
      <p className="text-xs text-gray-600 dark:text-gray-300">This car already has a hold.</p>
      <div className="flex flex-wrap gap-1.5">
        {choices.map(c => (
          <button key={c.id} type="button" disabled={busy} onClick={() => void same(c.id)}
            className="min-h-9 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-3 text-xs font-bold text-black cursor-pointer touch-manipulation disabled:opacity-40">
            {c.label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={onNew} className={QUIET}>New hold →</button>
        <button type="button" disabled={busy} onClick={onClose} className={QUIET}>Cancel</button>
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{err}</p>}
    </div>
  );
}

/** The exits a finished line may become (2026-11-09, docs/ticket-bay-sent-up-and-change-exit.md). Bumped never changes. */
export type ChangeTo = 'clean' | 'erin' | 'mhold' | 'bhold';
const CHANGE_LABEL: Record<ChangeTo, string> = { clean: 'Clean', erin: 'Erin', mhold: 'M hold', bhold: 'B hold' };

/** Change, asked in the line: *"Editing a cleaned vehicle to M, B, or Erin afterwards"*. The other three, and Cancel. */
export function BayChangeChoices({ plate, from, onChange, onClose }: {
  plate: string;
  from: ChangeTo;
  /** Resolves the error text, or null when it changed. */
  onChange: (to: ChangeTo) => Promise<string | null>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const change = async (to: ChangeTo) => {
    setBusy(true);
    const e = await onChange(to);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };
  return (
    <div role="group" aria-label="Change the exit" className="space-y-1.5 pt-1">
      <p className="text-xs text-gray-700 dark:text-gray-200">Change {plate} from {CHANGE_LABEL[from]} to:</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CHANGE_LABEL) as ChangeTo[]).filter(k => k !== from).map(k => (
          <button key={k} type="button" disabled={busy} onClick={() => void change(k)}
            className="min-h-9 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-3 text-xs font-bold text-black cursor-pointer touch-manipulation disabled:opacity-40">
            {CHANGE_LABEL[k]}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={onClose} className={QUIET}>Cancel</button>
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{err}</p>}
    </div>
  );
}

/** ✈ Sent up on a Clean line, or taken back (migration 167): *"something we cleaned was sent up right away and marking it
 *  as such"*. No time and no count: a mark. A failed save says so under it. */
export function BaySentUpToggle({ sent, onToggle }: { sent: boolean; onToggle: (sent: boolean) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    const e = await onToggle(!sent);
    setBusy(false);
    setErr(e);
  };
  return (
    <>
      <button type="button" aria-pressed={sent} disabled={busy} onClick={() => void toggle()}
        aria-label={sent ? 'Sent up. Tap to take it back' : 'Mark sent up'}
        className={sent
          ? 'mt-0.5 min-h-8 text-xs font-bold text-sky-700 dark:text-sky-300 cursor-pointer touch-manipulation disabled:opacity-40'
          : `mt-0.5 ${QUIET.replace('min-h-9', 'min-h-8')}`}>
        ✈ {sent ? 'sent up' : 'Sent up'}
      </button>
      {err && <span role="alert" className="block text-[11px] font-semibold text-red-700 dark:text-red-400">{err}</span>}
    </>
  );
}
