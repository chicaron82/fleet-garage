import type { RefObject } from 'react';
import type { User, UserRole } from '../../types';
import type { MockNotification } from '../../data/notifications';
import { hapticLight } from '../../lib/haptics';

export interface LiveNotification {
  id: string;
  branch_id: string;
  recipient_roles: UserRole[];
  icon: string;
  text: string;
  is_read: boolean;
  read_by: string[];
  created_at: string;
}

interface SidebarNotificationPopoverProps {
  user: User;
  unreadCount: number;
  notifications: MockNotification[];
  liveNotifs: LiveNotification[];
  notifMode: 'demo' | 'live';
  setNotifMode: (mode: 'demo' | 'live') => void;
  desktopInboxOpen: boolean;
  setDesktopInboxOpen: (open: boolean) => void;
  onMarkAllRead: () => void;
  handleMarkLiveAllRead: () => void;
  popoverRef: RefObject<HTMLDivElement | null>;
}

export function SidebarNotificationPopover({
  user,
  unreadCount,
  notifications,
  liveNotifs,
  notifMode,
  setNotifMode,
  desktopInboxOpen,
  setDesktopInboxOpen,
  onMarkAllRead,
  handleMarkLiveAllRead,
  popoverRef,
}: SidebarNotificationPopoverProps) {
  const isDemo = notifMode === 'demo';
  const liveUnread = liveNotifs.filter(n => !n.read_by.includes(user.id)).length;
  const activeUnread = isDemo ? unreadCount : liveUnread;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div ref={popoverRef} className="relative mb-2">
      <button
        onClick={() => {
          hapticLight();
          setDesktopInboxOpen(!desktopInboxOpen);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-green-300 hover:bg-green-800 hover:text-white transition-colors cursor-pointer text-sm font-medium"
      >
        <div className="relative">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Desktop popover — anchored above */}
      {desktopInboxOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl backdrop-blur-xl bg-white/97 dark:bg-gray-900/97 border border-gray-200/60 dark:border-gray-700/60 shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Notifications
              </p>
              <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px]">
                <button
                  onClick={() => setNotifMode('demo')}
                  className={`px-2 py-0.5 font-semibold transition-colors cursor-pointer ${
                    isDemo
                      ? 'bg-amber-400 text-black'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Demo
                </button>
                <button
                  onClick={() => setNotifMode('live')}
                  className={`px-2 py-0.5 font-semibold transition-colors cursor-pointer ${
                    !isDemo
                      ? 'bg-amber-400 text-black'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Live
                </button>
              </div>
            </div>
            {activeUnread > 0 && (
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={isDemo ? onMarkAllRead : handleMarkLiveAllRead}
                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {isDemo ? (
              notifications.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">No notifications for this role.</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      !n.isRead ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                    } ${
                      i < notifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''
                    }`}
                  >
                    <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                      {n.icon}
                    </span>
                    <p
                      className={`text-xs leading-relaxed flex-1 ${
                        !n.isRead ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {n.text}
                    </p>
                    {!n.isRead && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                  </div>
                ))
              )
            ) : liveNotifs.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">No live notifications yet.</p>
              </div>
            ) : (
              liveNotifs.map((n, i) => {
                const isUnread = !n.read_by.includes(user.id);
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      isUnread ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                    } ${i < liveNotifs.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                  >
                    <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                      {n.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-relaxed ${
                          isUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {n.text}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatTime(n.created_at)}
                      </p>
                    </div>
                    {isUnread && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                  </div>
                );
              })
            )}
          </div>

          {isDemo && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Sample data · Switch to Live for real notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
