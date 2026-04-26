import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { UserProfileMenu } from '../UserProfileMenu';
import { ModuleGuideModal } from '../ModuleGuideModal';
import { useAuth } from '../../context/AuthContext';
import { hapticLight } from '../../lib/haptics';
import type { Module, Screen, UserRole } from '../../types';

interface Notification {
  id: string;
  icon: string;
  text: string;
  isRead: boolean;
  roles: UserRole[];
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    icon: '⏱️',
    text: "Anomaly Detected: GenZee's transit time exceeded baseline by 22m. Notes: 'Traffic deadlocked on Route 90.'",
    isRead: false,
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'],
  },
  {
    id: 'n2',
    icon: '🚨',
    text: 'Shift Interruption: Geoff logged a Code Red shuttle run. Washbay queue currently 14.',
    isRead: false,
    roles: ['Branch Manager', 'Operations Manager', 'City Manager'],
  },
  {
    id: 'n3',
    icon: '📋',
    text: 'Audit Complete: Morning shift — 8 vehicles inspected, all categories passed.',
    isRead: false,
    roles: ['VSA', 'Lead VSA'],
  },
  {
    id: 'n4',
    icon: '🚗',
    text: 'New vehicle on lot: HRZ-9041 (2024 Honda CR-V, White) — registered by DiZee, pending first inspection.',
    isRead: false,
    roles: ['VSA', 'Lead VSA'],
  },
  {
    id: 'n5',
    icon: '🔄',
    text: '5 units automatically moved to Hold Bay from YYC transfer.',
    isRead: true,
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'],
  },
];

interface Props {
  activeModule: Module;
  onNavigate: (screen: Screen) => void;
  children: React.ReactNode;
}

export function AppShell({ activeModule, onNavigate, children }: Props) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guideModule, setGuideModule] = useState<Module | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);

  const visibleNotifications = notifications.filter(n => user && n.roles.includes(user.role));
  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

  const handleNavigate = (screen: Screen) => {
    onNavigate(screen);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          activeModule={activeModule}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
          onShowGuide={setGuideModule}
          notifications={visibleNotifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="relative md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 transition-colors">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-400 dark:bg-yellow-500 rounded flex items-center justify-center transition-colors">
              <span className="text-black font-bold text-[10px]">FG</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">Fleet Garage</span>
            <button
              onClick={() => setGuideModule(activeModule)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer ml-0.5"
              title="Module Guide"
            >
              <span className="text-xs">ⓘ</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile bell */}
            <button
              onClick={() => { hapticLight(); setMobileInboxOpen(o => !o); }}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
            <UserProfileMenu />
          </div>

          {/* Mobile inbox panel — slides down from header */}
          {mobileInboxOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMobileInboxOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 z-20 px-3 pt-1.5 pb-2 animate-in slide-in-from-top-2 duration-200">
                <div className="rounded-2xl backdrop-blur-xl bg-white/97 dark:bg-gray-900/97 border border-gray-200/60 dark:border-gray-700/60 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Notifications</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Demo</span>
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {visibleNotifications.map((n, i) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''} ${i < visibleNotifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                    >
                      <span className="text-base leading-none mt-0.5 shrink-0">{n.icon}</span>
                      <p className={`text-xs leading-relaxed flex-1 ${!n.isRead ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {n.text}
                      </p>
                      {!n.isRead && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Module Guide — triggered from sidebar ⓘ or mobile header ⓘ */}
      {guideModule !== null && (
        <ModuleGuideModal
          initialModule={guideModule}
          onClose={() => setGuideModule(null)}
        />
      )}
    </div>
  );
}
