import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { hapticLight } from '../../lib/haptics';
import { isNoteActiveForMonth, seasonalStarterBody, VISIBILITY_PRESETS } from '../../lib/whiteboard-schedule';
import type { VisibilityPreset } from '../../lib/whiteboard-schedule';
import type { WhiteboardNote, WhiteboardSection } from '../../types';
import { canWriteWhiteboard } from '../../types';

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function mapNote(row: Record<string, unknown>): WhiteboardNote {
  return {
    id:           row.id as string,
    branchId:     row.branch_id as string,
    section:      row.section as WhiteboardSection,
    body:         row.body as string,
    authorId:     row.author_id as string,
    authorName:   row.author_name as string,
    authorRole:   row.author_role as string,
    triggerType:  row.trigger_type as WhiteboardNote['triggerType'],
    activeMonths: row.active_months as number[] | undefined,
    status:       row.status as 'active' | 'archived',
    createdAt:    row.created_at as string,
    archivedAt:   row.archived_at as string | undefined,
    archivedById: row.archived_by_id as string | undefined,
  };
}

// ── Section component ─────────────────────────────────────────────────────────

const SHIFT_BOARD_MAX = 200;

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

function WhiteboardSection({ icon, title, section, active, archived, canWrite, isShiftBoard, onArchive, onRestore, onAdd }: SectionProps) {
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
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
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
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
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
              className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
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

// ── Main view ─────────────────────────────────────────────────────────────────

const SECTIONS: { section: WhiteboardSection; icon: string; title: string; shiftBoard?: boolean }[] = [
  { section: 'shift_board', icon: '📌', title: 'Shift Board', shiftBoard: true },
  { section: 'reminders',   icon: '📋', title: 'Reminders' },
  { section: 'downtime',    icon: '⏱',  title: 'Downtime' },
  { section: 'airport',     icon: '✈️',  title: 'Airport' },
];

export function WhiteboardView() {
  const { user, activeBranch } = useAuth();
  const { isPeakSeason }       = useSchedule();

  const [notes, setNotes]   = useState<WhiteboardNote[]>([]);
  const [loading, setLoading] = useState(true);

  const prevPeakRef = useRef<boolean | null>(null);

  const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
  const canWrite = user ? canWriteWhiteboard(user.role) : false;
  const currentMonth = new Date().getMonth() + 1;

  async function loadNotes() {
    // Auto-archive shift_board notes from previous days
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { error: archiveErr } = await writeWithRefresh(() =>
      supabase
        .from('whiteboard_notes')
        .update({ status: 'archived', archived_at: new Date().toISOString(), archived_by_id: 'system' })
        .eq('branch_id', branchId)
        .eq('section', 'shift_board')
        .eq('status', 'active')
        .lt('created_at', todayStart.toISOString())
    );
    if (archiveErr) console.error('[WhiteboardView] shift_board auto-archive failed:', archiveErr);

    const { data } = await supabase
      .from('whiteboard_notes')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    setNotes((data ?? []).map(mapNote));
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Auto-archive seasonal notes and inject starter when peak season flips
  useEffect(() => {
    if (prevPeakRef.current === null) {
      prevPeakRef.current = isPeakSeason;
      return;
    }
    if (prevPeakRef.current === isPeakSeason) return;
    prevPeakRef.current = isPeakSeason;

    (async () => {
      const now = new Date().toISOString();
      const toArchive = notes.filter(n => n.status === 'active' && n.triggerType === 'seasonal');
      if (toArchive.length > 0) {
        const { error: seasonArchiveErr } = await writeWithRefresh(() =>
          supabase
            .from('whiteboard_notes')
            .update({ status: 'archived', archived_at: now, archived_by_id: 'system' })
            .in('id', toArchive.map(n => n.id))
        );
        if (seasonArchiveErr) console.error('[WhiteboardView] seasonal auto-archive failed:', seasonArchiveErr);
      }
      const starterBody = seasonalStarterBody(isPeakSeason);
      const { error: starterErr } = await writeWithRefresh(() => supabase.from('whiteboard_notes').insert({
        branch_id: branchId,
        section: 'reminders',
        body: starterBody,
        author_id: 'system',
        author_name: 'System',
        author_role: 'Seasonal',
        trigger_type: 'seasonal',
        status: 'active',
      }));
      if (starterErr) console.error('[WhiteboardView] seasonal starter insert failed:', starterErr);
      loadNotes();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPeakSeason]);

  const handleArchive = async (id: string) => {
    const now = new Date().toISOString();
    await writeWithRefresh(() =>
      supabase
        .from('whiteboard_notes')
        .update({ status: 'archived', archived_at: now, archived_by_id: user?.id ?? null })
        .eq('id', id)
    );
    setNotes(prev => prev.map(n => n.id !== id ? n : { ...n, status: 'archived', archivedAt: now }));
  };

  const handleRestore = async (id: string) => {
    await writeWithRefresh(() =>
      supabase
        .from('whiteboard_notes')
        .update({ status: 'active', archived_at: null, archived_by_id: null })
        .eq('id', id)
    );
    setNotes(prev => prev.map(n => n.id !== id ? n : { ...n, status: 'active', archivedAt: undefined, archivedById: undefined }));
  };

  const handleAdd = async (section: WhiteboardSection, body: string, activeMonths: number[]) => {
    if (!user) return;
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('whiteboard_notes')
        .insert({
          branch_id:    branchId,
          section,
          body,
          author_id:    user.id,
          author_name:  user.name,
          author_role:  user.role,
          trigger_type: 'manual',
          active_months: activeMonths.length > 0 ? activeMonths : null,
          status:       'active',
        })
        .select()
        .single()
    );
    if (!error && data) {
      setNotes(prev => [mapNote(data), ...prev]);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
        Loading whiteboard…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 transition-colors">Shift Whiteboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">Operational notes for today's shift</p>
      </div>

      {SECTIONS.map(({ section, icon, title, shiftBoard }) => {
        const sectionNotes = notes.filter(n => n.section === section);
        const active = sectionNotes.filter(n =>
          n.status === 'active' && isNoteActiveForMonth(n, currentMonth)
        );
        const archived = sectionNotes.filter(n =>
          n.status === 'archived' || (n.status === 'active' && !isNoteActiveForMonth(n, currentMonth))
        );
        return (
          <WhiteboardSection
            key={section}
            icon={icon}
            title={title}
            section={section}
            active={active}
            archived={archived}
            canWrite={shiftBoard ? !!user : canWrite}
            isShiftBoard={shiftBoard}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onAdd={handleAdd}
          />
        );
      })}
    </div>
  );
}
