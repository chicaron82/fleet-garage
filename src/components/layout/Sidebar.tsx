import { useAuth } from '../../context/AuthContext';
import { UserProfileMenu } from '../UserProfileMenu';
import { getNavItemsForRole } from '../../lib/navigation';
import type { Module, Screen, BranchId } from '../../types';
import { BRANCH_CONFIGS } from '../../data/mock';

interface Props {
  activeModule: Module;
  onNavigate: (screen: Screen) => void;
  onClose?: () => void;
}

export function Sidebar({ activeModule, onNavigate, onClose }: Props) {
  const { user, activeBranch, setActiveBranch } = useAuth();
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
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight transition-colors">Location Ops</p>
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
            <button
              key={item.module}
              onClick={() => onNavigate(item.defaultScreen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Section — desktop only */}
      <div className="hidden md:block border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        <UserProfileMenu dropUp />
      </div>
    </div>
  );
}
