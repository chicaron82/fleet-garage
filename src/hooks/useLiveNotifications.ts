import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { localDateStr } from './useFleetBalance';
import { offShiftNotifications } from '../lib/notificationShift';
import type { ShiftType, UserRole } from '../types';

export interface LiveNotification {
  id: string;
  branch_id: string;
  recipient_roles: UserRole[];
  recipient_user_id?: string | null;
  icon: string;
  text: string;
  is_read: boolean;
  read_by: string[];
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * ⭐ THE one source of the user's notifications — fetch, realtime, read state, and the
 * off-shift dimming, in one place.
 *
 * There used to be two: the phone header's `NotificationBell` and the desktop sidebar's
 * popover, each with its own fetch and its own realtime channel, born two days apart in
 * April 2026. Every fix after that landed in only one of them, so the phone's badge
 * counted off-shift alerts as urgent while the desktop's rows couldn't be tapped. Aaron,
 * 2026-09-10: *"having it done once would have taken care of both instead of two that do
 * different things half built."* Anything notifications need goes HERE.
 */
export function useLiveNotifications() {
  const { user, activeBranch } = useAuth();
  const { isPeakSeason } = useSchedule();
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [userShifts, setUserShifts] = useState<{ userId: string; date: string; shiftType: ShiftType }[]>([]);

  const userId = user?.id;
  const role = user?.role;

  // ── Load + realtime ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !role) return;
    let query = supabase
      .from('notifications')
      .select('*')
      .or(`recipient_roles.cs.{${role}},recipient_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
    query.then(({ data }) => setNotifications((data ?? []) as LiveNotification[]));

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as LiveNotification;
        if (activeBranch !== 'ALL' && n.branch_id !== activeBranch) return;
        if (!n.recipient_roles.includes(role) && n.recipient_user_id !== userId) return;
        setNotifications(prev => [n, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        const updated = payload.new as LiveNotification;
        setNotifications(prev => prev.map(l => l.id === updated.id ? updated : l));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, role, activeBranch]);

  // ── User's recent roster — to de-prioritize alerts that fired on a day off ───
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('shifts')
      .select('user_id,date,shift_type')
      .eq('user_id', userId)
      .gte('date', localDateStr(-21))
      .then(({ data }) => setUserShifts(
        (data ?? []).map(r => ({ userId: r.user_id as string, date: r.date as string, shiftType: r.shift_type as ShiftType })),
      ));
  }, [userId]);

  // Fired outside the user's shift window (off-day OR off-hours on a worked day) —
  // dimmed + dropped from the urgent badge, never hidden. Oversight roles and a
  // missing roster fail open (empty set).
  const offShiftIds = useMemo(
    () => offShiftNotifications(notifications, userShifts, userId ?? '', role ?? 'Driver', isPeakSeason),
    [notifications, userShifts, userId, role, isPeakSeason],
  );

  const isUnread = useCallback((n: LiveNotification) => !!userId && !n.read_by.includes(userId), [userId]);
  const urgentUnreadCount = notifications.filter(n => isUnread(n) && !offShiftIds.has(n.id)).length;

  const markRead = useCallback((ids: string[]) => {
    if (!userId || ids.length === 0) return Promise.resolve();
    const idSet = new Set(ids);
    setNotifications(prev => prev.map(n =>
      idSet.has(n.id) && !n.read_by.includes(userId) ? { ...n, read_by: [...n.read_by, userId] } : n,
    ));
    return Promise.all(ids.map(id =>
      writeWithRefresh(() => supabase.rpc('mark_notification_read', { p_notification_id: id, p_user_id: userId })),
    )).then(() => undefined);
  }, [userId]);

  const markAllRead = useCallback(
    () => markRead(notifications.filter(isUnread).map(n => n.id)),
    [markRead, notifications, isUnread],
  );

  const markOneRead = useCallback(
    (n: LiveNotification) => (isUnread(n) ? markRead([n.id]) : Promise.resolve()),
    [markRead, isUnread],
  );

  return { notifications, offShiftIds, isUnread, urgentUnreadCount, markAllRead, markOneRead };
}
