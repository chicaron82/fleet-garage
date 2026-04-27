import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfileMenu } from '../UserProfileMenu';
import { getNavItemsForRole } from '../../lib/navigation';
import { hapticLight } from '../../lib/haptics';
import type { Module, Screen, BranchId } from '../../types';
import type { MockNotification } from '../../data/notifications';
import { BRANCH_CONFIGS } from '../../data/mock';

interface Props {
  activeModule: Module;
  onNavigate: (screen: Screen) => void;
  onClose?: () => void;
  onShowGuide?: (module: Module) => void;
  notifications: MockNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}

export function Sidebar({ activeModule, onNavigate, onClose, onShowGuide, notifications, unreadCount, onMarkAllRead }: Props) {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const [desktopInboxOpen, setDesktopInboxOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!desktopInboxOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setDesktopInboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [desktopInboxOpen]);

  if (!user) return null;

  const navItems = getNavItemsForRole(user.role, activeBranch);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-colors">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 rounded-lg flex items-center justify-center transition-colors">
            <span className="text-black font-bold text-xs">FG</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight transition-colors">Fleet Garage</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight transition-colors">
                {activeBranch === 'ALL' ? 'Ops Pilot Program' : `${activeBranch} Ops Pilot Program`}
              </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Branch Selector */}
      {user.role === 'City Manager' && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Active Branch
          </label>
          <select
            value={activeBranch}
            onChange={(e) => setActiveBranch(e.target.value as BranchId)}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors cursor-pointer"
          >
            {Object.values(BRANCH_CONFIGS).map(config => (
              <option key={config.id} value={config.id}>{config.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map(item => {
          const isActive = activeModule === item.module;
          return (
            <div key={item.module} className="relative flex items-center group">
              <button
                onClick={() => onNavigate(item.defaultScreen)}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
              {onShowGuide && (
                <button
                  onClick={e => { e.stopPropagation(); hapticLight(); onShowGuide(item.module); }}
                  className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 cursor-pointer"
                  title={`About ${item.label}`}
                >
                  <span className="text-xs">ⓘ</span>
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Section — desktop only */}
      <div className="hidden md:block border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        {/* Desktop notification bell + popover */}
        <div ref={popoverRef} className="relative mb-2">
          <button
            onClick={() => { hapticLight(); setDesktopInboxOpen(o => !o); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer text-sm font-medium"
          >
            <div className="relative">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Notifications</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Demo</span>
                </div>
                {unreadCount > 0 && (
                  <button onClick={onMarkAllRead} className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer">
                    Mark all as read
                  </button>
                )}
              </div>
              {notifications.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">No notifications for this role.</p>
                </div>
              )}
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''} ${i < notifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                >
                  <span className="text-[10px] leading-none mt-0.5 shrink-0 min-w-6 px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-center">
                    {n.icon}
                  </span>
                  <p className={`text-xs leading-relaxed flex-1 ${!n.isRead ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {n.text}
                  </p>
                  {!n.isRead && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <UserProfileMenu dropUp />
      </div>
    </div>
  );
}
