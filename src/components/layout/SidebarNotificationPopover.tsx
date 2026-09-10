import { useState, useRef, useEffect, useCallback } from 'react';
import { hapticLight } from '../../lib/haptics';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useLiveNotifications, type LiveNotification } from '../../hooks/useLiveNotifications';
import { notificationRoute } from '../../lib/notificationRoute';
import type { Screen } from '../../types';

/** What a tapped approval-request notification opens. The sheets live in AppShell. */
export interface NotificationActions {
  onOffStdEditApproval: (entryId: string) => void;
  onBackdateApproval: (entryId: string) => void;
  onVehicleEditApproval: (vehicleId: string) => void;
}

interface Props {
  onNavigate: (screen: Screen) => void;
  actions?: NotificationActions;
}

/**
 * The ONE notifications inbox — rendered once, in the sidebar, at every screen size
 * (the phone drawer and the desktop column). It replaced the phone header's
 * `NotificationBell` on 2026-09-10; see `useLiveNotifications` for why there is only one.
 * Opens upward from the bottom of the sidebar.
 */
export function SidebarNotificationPopover({ onNavigate, actions }: Props) {
  const { notifications, offShiftIds, isUnread, urgentUnreadCount, markAllRead, markOneRead } = useLiveNotifications();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(close);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleTap = (n: LiveNotification) => {
    hapticLight();
    void markOneRead(n);
    const route = notificationRoute(n.metadata);
    if (!route) return;
    setOpen(false);
    switch (route.kind) {
      case 'oth-edit-approval':     actions?.onOffStdEditApproval(route.entryId); break;
      case 'backdate-approval':     actions?.onBackdateApproval(route.entryId); break;
      case 'vehicle-edit-approval': actions?.onVehicleEditApproval(route.vehicleId); break;
      case 'vehicle':               onNavigate({ name: 'vehicle', vehicleId: route.vehicleId }); break;
    }
  };

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
          setOpen(!open);
        }}
        aria-label="Notifications"
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
          {urgentUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 motion-safe:animate-pulse" />
          )}
        </div>
        <span>Notifications</span>
        {urgentUnreadCount > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            {urgentUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl backdrop-blur-xl bg-white/97 dark:bg-gray-900/97 border border-gray-200/60 dark:border-gray-700/60 shadow-xl overflow-hidden motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 z-50">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Notifications
              </p>
              {/* Any unread, not just urgent — off-shift alerts are dimmed, not un-clearable. */}
              {notifications.some(isUnread) && (
                <button
                  onClick={() => void markAllRead()}
                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">No live notifications yet.</p>
              </div>
            ) : (
              notifications.map((n, i) => {
                const isOff = offShiftIds.has(n.id);
                // Off-shift alerts stay readable but lose the urgent treatment.
                const urgentUnread = isUnread(n) && !isOff;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleTap(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                      urgentUnread ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                    } ${isOff ? 'opacity-60' : ''} ${i < notifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
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
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
