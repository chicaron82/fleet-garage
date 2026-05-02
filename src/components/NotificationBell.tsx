import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getVisibleNotifications, markNotificationsRead, MOCK_NOTIFICATIONS } from '../data/notifications';
import { hapticLight } from '../lib/haptics';
import type { MockNotification, NotificationSeverity } from '../data/notifications';
import type { UserRole } from '../types';

interface LiveNotification {
  id: string;
  branch_id: string;
  recipient_roles: UserRole[];
  icon: string;
  text: string;
  severity: NotificationSeverity;
  is_read: boolean;
  read_by: string[];
  created_at: string;
  metadata?: Record<string, unknown>;
}

export function NotificationBell() {
  const { user, activeBranch } = useAuth();
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [mockNotifications, setMockNotifications] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);
  const [liveNotifications, setLiveNotifications] = useState<LiveNotification[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'live' || !user) return;
    async function load() {
      let query = supabase
        .from('notifications')
        .select('*')
        .contains('recipient_roles', [user!.role])
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
      const { data } = await query;
      setLiveNotifications((data ?? []) as LiveNotification[]);
    }
    load();
  }, [mode, user, activeBranch]);

  if (!user) return null;

  const isDemo = mode === 'demo';
  const visibleDemo = getVisibleNotifications(mockNotifications, user, activeBranch);
  const unreadCount = isDemo
    ? visibleDemo.filter(n => !n.isRead).length
    : liveNotifications.filter(n => !n.read_by.includes(user.id)).length;

  const handleMarkAllRead = async () => {
    if (isDemo) {
      setMockNotifications(prev => markNotificationsRead(prev, visibleDemo.map(n => n.id)));
    } else {
      const unread = liveNotifications.filter(n => !n.read_by.includes(user.id));
      await Promise.all(unread.map(n =>
        supabase.from('notifications').update({ read_by: [...n.read_by, user.id] }).eq('id', n.id)
      ));
      setLiveNotifications(prev => prev.map(n => ({
        ...n,
        read_by: n.read_by.includes(user.id) ? n.read_by : [...n.read_by, user.id],
      })));
    }
  };

  const handleMarkOneRead = async (n: LiveNotification) => {
    if (n.read_by.includes(user.id)) return;
    await supabase.from('notifications').update({ read_by: [...n.read_by, user.id] }).eq('id', n.id);
    setLiveNotifications(prev => prev.map(l =>
      l.id === n.id ? { ...l, read_by: [...l.read_by, user.id] } : l
    ));
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="relative">
      <button
        onClick={() => { hapticLight(); setInboxOpen(o => !o); }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] leading-4 text-white font-bold text-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {inboxOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setInboxOpen(false)} />
          <div className="absolute top-full right-0 z-50 w-80 max-w-[calc(100vw-1.5rem)] mt-1 rounded-2xl backdrop-blur-xl bg-white/97 dark:bg-gray-900/97 border border-gray-200/60 dark:border-gray-700/60 shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">

            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Notifications</p>
                <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px]">
                  <button
                    onClick={() => setMode('demo')}
                    className={`px-2 py-0.5 font-semibold transition-colors cursor-pointer ${isDemo ? 'bg-amber-400 text-black' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    Demo
                  </button>
                  <button
                    onClick={() => setMode('live')}
                    className={`px-2 py-0.5 font-semibold transition-colors cursor-pointer ${!isDemo ? 'bg-amber-400 text-black' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    Live
                  </button>
                </div>
              </div>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer">
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {isDemo ? (
                visibleDemo.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">No notifications for this role.</p>
                  </div>
                ) : (
                  visibleDemo.map((n, i) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''} ${i < visibleDemo.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                    >
                      <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                        {n.icon}
                      </span>
                      <p className={`text-xs leading-relaxed flex-1 ${!n.isRead ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {n.text}
                      </p>
                      {!n.isRead && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                    </div>
                  ))
                )
              ) : (
                liveNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">No live notifications yet.</p>
                  </div>
                ) : (
                  liveNotifications.map((n, i) => {
                    const isUnread = !n.read_by.includes(user.id);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleMarkOneRead(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${isUnread ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''} ${i < liveNotifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40`}
                      >
                        <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                          {n.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-relaxed ${isUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {n.text}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(n.created_at)}</p>
                        </div>
                        {isUnread && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                      </button>
                    );
                  })
                )
              )}
            </div>

            {/* Demo footer note */}
            {isDemo && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Sample data · Switch to Live to see real notifications</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
