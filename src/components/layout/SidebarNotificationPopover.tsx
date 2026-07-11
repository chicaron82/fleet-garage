import type { RefObject } from 'react';
import type { User, UserRole } from '../../types';
import { hapticLight } from '../../lib/haptics';

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

interface SidebarNotificationPopoverProps {
  user: User;
  liveNotifs: LiveNotification[];
  offShiftNotifIds: Set<string>;
  desktopInboxOpen: boolean;
  setDesktopInboxOpen: (open: boolean) => void;
  handleMarkLiveAllRead: () => void;
  popoverRef: RefObject<HTMLDivElement | null>;
}

export function SidebarNotificationPopover({
  user,
  liveNotifs,
  offShiftNotifIds,
  desktopInboxOpen,
  setDesktopInboxOpen,
  handleMarkLiveAllRead,
  popoverRef,
}: SidebarNotificationPopoverProps) {
  // Off-shift alerts stay in the feed but don't count toward the urgent badge.
  const activeUnread = liveNotifs.filter(n => !n.read_by.includes(user.id) && !offShiftNotifIds.has(n.id)).length;

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
          {activeUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
        <span>Notifications</span>
        {activeUnread > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            {activeUnread}
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
              {activeUnread > 0 && (
                <button
                  onClick={handleMarkLiveAllRead}
                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {liveNotifs.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">No live notifications yet.</p>
              </div>
            ) : (
              liveNotifs.map((n, i) => {
                const isOff = offShiftNotifIds.has(n.id);
                // Off-shift alerts stay readable but lose the urgent treatment.
                const urgentUnread = !n.read_by.includes(user.id) && !isOff;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      urgentUnread ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                    } ${isOff ? 'opacity-60' : ''} ${i < liveNotifs.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                  >
                    <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                      {n.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-relaxed ${
                          urgentUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {n.text}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatTime(n.created_at)}
                        {isOff && <span className="ml-1.5 text-gray-400 dark:text-gray-500">· off-shift</span>}
                      </p>
                    </div>
                    {urgentUnread && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
