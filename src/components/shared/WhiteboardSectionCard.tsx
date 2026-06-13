import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { VISIBILITY_PRESETS } from '../../lib/whiteboard-schedule';
import type { VisibilityPreset } from '../../lib/whiteboard-schedule';
import type { WhiteboardNote, WhiteboardSection } from '../../types';

const SHIFT_BOARD_MAX = 200;

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

interface SectionProps {
  icon: string;
  title: string;
  section: WhiteboardSection;
  active: WhiteboardNote[];
  archived: WhiteboardNote[];
  canWrite: boolean;
  isShiftBoard?: boolean;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onAdd: (section: WhiteboardSection, body: string, activeMonths: number[]) => Promise<void>;
}

/** One whiteboard section card: header + post form + active notes + archive drawer. */
export function WhiteboardSectionCard({ icon, title, section, active, archived, canWrite, isShiftBoard, onArchive, onRestore, onAdd }: SectionProps) {
  const [archiveOpen, setArchiveOpen]   = useState(false);
  const [addOpen, setAddOpen]           = useState(false);
  const [body, setBody]                 = useState('');
  const [visibility, setVisibility]     = useState<VisibilityPreset>('always');
  const [saving, setSaving]             = useState(false);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    if (isShiftBoard && body.length > SHIFT_BOARD_MAX) return;
    setSaving(true);
    await onAdd(section, body.trim(), isShiftBoard ? [] : VISIBILITY_PRESETS[visibility].months);
    setBody('');
    setVisibility('always');
    setAddOpen(false);
    setSaving(false);
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden transition-colors ${
      isShiftBoard
        ? 'border-amber-200 dark:border-amber-800/50'
        : 'border-gray-200 dark:border-gray-800'
    }`}>
      {/* Section header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${
        isShiftBoard
          ? 'border-amber-100 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10'
          : 'border-gray-100 dark:border-gray-800'
      }`}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 transition-colors">
          {icon} {title}
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={() => { hapticLight(); setAddOpen(o => !o); }}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition"
          >
            {addOpen ? 'Cancel' : '+ Post'}
          </button>
        )}
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800/40 space-y-2">
          <textarea
            rows={2}
            autoFocus
            placeholder="Quick note for the shift…"
            value={body}
            onChange={e => isShiftBoard ? setBody(e.target.value.slice(0, SHIFT_BOARD_MAX)) : setBody(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
          />
          <div className="flex items-center gap-2">
            {isShiftBoard ? (
              <p className={`flex-1 text-xs transition-colors ${body.length > SHIFT_BOARD_MAX * 0.9 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {body.length}/{SHIFT_BOARD_MAX}
              </p>
            ) : (
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value as VisibilityPreset)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition cursor-pointer"
              >
                {(Object.entries(VISIBILITY_PRESETS) as [VisibilityPreset, { label: string }][]).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={!body.trim() || saving}
              onClick={handleSubmit}
              className="px-4 py-1.5 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
            >
              {saving ? 'Saving…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Active notes */}
      {active.length === 0 && !addOpen ? (
        <p className="px-4 py-4 text-xs text-gray-400 dark:text-gray-500 italic transition-colors">No active notes.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {active.map(note => (
            <div key={note.id} className="px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                    {note.authorName} · {note.authorRole} · {fmtNoteDate(note.createdAt)}
                  </p>
                  {note.activeMonths && note.activeMonths.length > 0 && (() => {
                    const preset = Object.values(VISIBILITY_PRESETS).find(p =>
                      p.months.length === note.activeMonths!.length &&
                      p.months.every(m => note.activeMonths!.includes(m))
                    );
                    return preset ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                        {preset.label}
                      </span>
                    ) : null;
                  })()}</div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => { hapticLight(); onArchive(note.id); }}
                    className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archive toggle */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => { hapticLight(); setArchiveOpen(o => !o); }}
          className="w-full px-4 py-2.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition cursor-pointer"
        >
          <span>{archiveOpen ? '▾' : '▸'}</span>
          <span>{archived.length > 0 ? `${archived.length} archived note${archived.length !== 1 ? 's' : ''}` : 'No archived notes'}</span>
        </button>
        {archiveOpen && archived.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {archived.map(note => (
              <div key={note.id} className="px-4 py-3 space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors whitespace-pre-wrap">{note.body}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                    {note.authorName} · {fmtNoteDate(note.createdAt)}
                    {note.archivedAt && ` · Archived ${fmtNoteDate(note.archivedAt)}`}
                  </p>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => { hapticLight(); onRestore(note.id); }}
                      className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition shrink-0"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
