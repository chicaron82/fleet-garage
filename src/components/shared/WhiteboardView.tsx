import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { withSubmitLock } from '../../lib/submitLock';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayStartISO } from '../../lib/shiftDay';
import { isNoteActiveForMonth, seasonalStarterBody } from '../../lib/whiteboard-schedule';
import type { WhiteboardNote, WhiteboardSection } from '../../types';
import { canWriteWhiteboard } from '../../types';
import { WhiteboardSectionCard } from './WhiteboardSectionCard';

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
    // Auto-archive shift_board notes from previous shift-days (04:00 cutover, so
    // a note written after midnight stays live for the shift still in progress).
    const { error: archiveErr } = await writeWithRefresh(() =>
      supabase
        .from('whiteboard_notes')
        .update({ status: 'archived', archived_at: new Date().toISOString(), archived_by_id: 'system' })
        .eq('branch_id', branchId)
        .eq('section', 'shift_board')
        .eq('status', 'active')
        .lt('created_at', shiftDayStartISO(localDateStr(0)))
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
    // Each insert mints a fresh row id, so two same-frame taps post two identical
    // notes. Guard on reporter + section + body so a double-tap collapses to one.
    await withSubmitLock(`whiteboard:${user.id}:${section}:${body.trim().toLowerCase()}`, async () => {
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
    });
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
          <WhiteboardSectionCard
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
