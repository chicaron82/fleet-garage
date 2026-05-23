import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAuth } from '../../context/AuthContext';
import { UserProfileMenu } from '../UserProfileMenu';
import { hapticLight } from '../../lib/haptics';
import type { Module, BranchId } from '../../types';
import type { MockNotification } from '../../data/notifications';
import { useNavigatorOnLine } from '../../hooks/useNavigatorOnLine';
import { BRANCH_CONFIGS } from '../../data/mock';
import { SortableNavItem, restrictToVerticalAxis } from './SortableNavItem';
import { SidebarNotificationPopover } from './SidebarNotificationPopover';
import { useSidebar } from './useSidebar';

interface Props {
  activeModule: Module;
  onNavigate: (screen: import('../../types').Screen) => void;
  onClose?: () => void;
  onShowGuide?: (module: Module) => void;
  notifications: MockNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}

export function Sidebar({ activeModule, onNavigate, onClose, onShowGuide, notifications, unreadCount, onMarkAllRead }: Props) {
  const { setActiveBranch } = useAuth();
  const isOnline = useNavigatorOnLine();
  const s = useSidebar();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  if (!s.user) return null;

  const isVSA    = s.user.role === 'VSA' || s.user.role === 'Lead VSA';
  const isDriver = s.user.role === 'Driver';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-colors">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 rounded-lg flex items-center justify-center transition-colors relative">
            <span className="text-black font-bold text-xs">FG</span>
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900 transition-colors ${
                isOnline ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight transition-colors">Fleet Garage</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight transition-colors">
              {s.activeBranch === 'ALL' ? 'Ops Pilot Program' : `${s.activeBranch} Ops Pilot Program`}
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

      {/* Fleet balance strip — non-management only */}
      {!['Branch Manager', 'Operations Manager', 'City Manager'].includes(s.user.role) && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {s.todayFleetEntry ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fleet Today</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Out</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.todayFleetEntry.outCount}</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">In</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.todayFleetEntry.inCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">No fleet numbers today</p>
          )}
        </div>
      )}

      {/* VSA productivity strip */}
      {isVSA && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {s.recentRate != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {s.resolvedShiftIcon ? `${s.resolvedShiftIcon} ` : ''}{s.recentLabel}{s.resolvedShiftIcon && s.userShiftType ? ` (${s.userShiftType})` : ''}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{s.recentRate}/hr</span>
                {s.deltaLabel && <span className={`text-xs font-semibold ${s.deltaColor}`}>{s.deltaLabel}</span>}
              </div>
              {s.hasSplit && !s.userShiftType && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">☀️ AM: {s.morningRate}/hr</span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">🌙 PM: {s.closingRate}/hr</span>
                </div>
              )}
              {!s.hasSplit && s.userShiftType && s.dailyRate != null && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {s.userShiftType === 'opening' ? '☀️ AM' : '🌙 PM'}: {s.dailyRate}/hr
                  </span>
                </div>
              )}
              {s.weekAvgRate != null && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">This week avg: {s.weekAvgRate}/hr</p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No closing log yet</p>
          )}
        </div>
      )}

      {/* Driver productivity strip */}
      {isDriver && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Trips Today</span>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
              {s.tripsToday === 0 ? '0 runs logged' : `${s.tripsToday} run${s.tripsToday !== 1 ? 's' : ''}`}
            </span>
          </div>
          {s.weekAvgTrips != null && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">This week avg: {s.weekAvgTrips} trips/day</p>
          )}
        </div>
      )}

      {/* Branch Selector */}
      {s.user.role === 'City Manager' && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Active Branch
          </label>
          <select
            value={s.activeBranch}
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
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {/* Normal mode */}
        {!s.editMode && s.displayedItems.map(item => {
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
                {s.MODULE_BADGES[item.module] ? (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shrink-0">
                    {s.MODULE_BADGES[item.module]}
                  </span>
                ) : null}
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

        {/* Edit mode */}
        {s.editMode && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (over) s.handleDragEnd(active.id as string, over.id as string);
            }}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={s.localOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {s.allItems.map(item => (
                  <SortableNavItem
                    key={item.module}
                    item={item}
                    isHidden={s.hidden.includes(item.module)}
                    onToggleHidden={() => s.toggleHidden(item.module)}
                    badge={s.MODULE_BADGES[item.module]}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </nav>

      {/* Edit / Save / Reset Controls */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-1">
        {!s.editMode ? (
          <button
            type="button"
            onClick={() => { hapticLight(); s.setEditMode(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span>⚙️</span>
            <span>Edit Menu</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={s.handleSave} className="flex-1 py-2 rounded-lg bg-yellow-400 dark:bg-yellow-500 text-black text-xs font-semibold transition hover:bg-yellow-500 cursor-pointer">
              ✓ Save
            </button>
            <button type="button" onClick={s.handleReset} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer" title="Reset to default">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* User Section — desktop only */}
      <div className="hidden md:block border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        <SidebarNotificationPopover
          user={s.user}
          unreadCount={unreadCount}
          notifications={notifications}
          liveNotifs={s.liveNotifs}
          notifMode={s.notifMode}
          setNotifMode={s.setNotifMode}
          desktopInboxOpen={s.desktopInboxOpen}
          setDesktopInboxOpen={s.setDesktopInboxOpen}
          onMarkAllRead={onMarkAllRead}
          handleMarkLiveAllRead={s.handleMarkLiveAllRead}
          popoverRef={s.popoverRef}
        />
        <UserProfileMenu dropUp />
      </div>
    </div>
  );
}
