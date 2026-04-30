import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { UserProfileMenu } from '../UserProfileMenu';
import { ModuleGuideModal } from '../ModuleGuideModal';
import { NotificationBell } from '../NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { getVisibleNotifications, markNotificationsRead, MOCK_NOTIFICATIONS } from '../../data/notifications';
import { hapticLight } from '../../lib/haptics';
import type { MockNotification } from '../../data/notifications';
import type { Module, Screen } from '../../types';

interface Props {
  activeModule: Module;
  onNavigate: (screen: Screen) => void;
  children: React.ReactNode;
}

export function AppShell({ activeModule, onNavigate, children }: Props) {
  const { user, activeBranch } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guideModule, setGuideModule] = useState<Module | null>(null);
  const [notifications, setNotifications] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);

  const visibleNotifications = getVisibleNotifications(notifications, user, activeBranch);
  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;

  const markVisibleRead = () => {
    setNotifications(prev => markNotificationsRead(prev, visibleNotifications.map(n => n.id)));
  };

  const handleNavigate = (screen: Screen) => {
    onNavigate(screen);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
          onMarkAllRead={markVisibleRead}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Open sidebar"
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
              onClick={() => { hapticLight(); setGuideModule(activeModule); }}
              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer ml-0.5"
              title="Module Guide"
            >
              <span className="text-xs">i</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserProfileMenu />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {guideModule !== null && (
        <ModuleGuideModal
          initialModule={guideModule}
          onClose={() => setGuideModule(null)}
        />
      )}
    </div>
  );
}
