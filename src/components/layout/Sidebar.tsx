import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAuth } from '../../context/AuthContext';
import { UserProfileMenu } from '../shared/UserProfileMenu';
import { hapticLight } from '../../lib/haptics';
import type { Module, BranchId } from '../../types';
import type { MockNotification } from '../../data/notifications';
import { useNavigatorOnLine } from '../../hooks/useNavigatorOnLine';
import { BRANCH_CONFIGS } from '../../data/mock';
import { SortableNavItem } from './SortableNavItem';
import { restrictToVerticalAxis } from './dndModifiers';
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
    <div className="h-full flex flex-col bg-green-900 border-r border-green-800 transition-colors">
      {/* Header */}
      <div className="px-4 py-4 border-b border-green-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center relative">
            <img src="/FG.webp" alt="Fleet Garage" className="w-full h-full object-cover" />
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-green-900 transition-colors ${
                isOnline ? 'bg-green-400' : 'bg-amber-500 motion-safe:animate-pulse'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Fleet Garage</p>
            <p className="text-[10px] text-green-400 leading-tight">
              {s.activeBranch === 'ALL' ? 'Ops Pilot Program' : `${s.activeBranch} Ops Pilot Program`}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-green-300 hover:text-white hover:bg-green-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Fleet balance strip — non-management only; tappable shortcut to My Shift */}
      {!['Branch Manager', 'Operations Manager', 'City Manager'].includes(s.user.role) && (
        <button
          type="button"
          onClick={() => onNavigate({ name: 'my-shift' })}
          className="w-full px-4 py-2.5 border-b border-green-800 hover:bg-green-800/50 active:bg-green-800 transition-colors cursor-pointer text-left"
        >
          {s.todayFleetEntry ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Fleet Today</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Out</span>
                  <span className="text-sm font-bold text-white">{s.todayFleetEntry.outCount}</span>
                </div>
                <span className="text-green-700">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">In</span>
                  <span className="text-sm font-bold text-white">{s.todayFleetEntry.inCount}</span>
                </div>
              </div>
            </div>
          ) : s.fleetProjection ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider italic">Est. Today</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Out</span>
                  <span className="text-sm font-bold text-green-300 italic">~{s.fleetProjection.avgOut}</span>
                </div>
                <span className="text-green-700">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">In</span>
                  <span className="text-sm font-bold text-green-300 italic">~{s.fleetProjection.avgIn}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-green-500">No fleet numbers today</p>
          )}
        </button>
      )}

      {/* VSA productivity strip */}
      {isVSA && (
        <div className="px-4 py-2.5 border-b border-green-800">
          {s.recentRate != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                  {s.resolvedShiftIcon ? `${s.resolvedShiftIcon} ` : ''}{s.recentLabel}{s.resolvedShiftIcon && s.userShiftType ? ` (${s.userShiftType})` : ''}
                </span>
                <span className="text-xs font-bold text-white">{s.recentRate}/hr</span>
                {s.deltaLabel && <span className={`text-xs font-semibold ${s.deltaColor}`}>{s.deltaLabel}</span>}
              </div>
              {s.hasSplit && !s.userShiftType && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-500">☀️ AM: {s.morningRate}/hr</span>
                  <span className="text-[10px] text-green-700">·</span>
                  <span className="text-[10px] text-green-500">🌙 PM: {s.closingRate}/hr</span>
                </div>
              )}
              {!s.hasSplit && s.userShiftType && s.dailyRate != null && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-500">
                    {s.userShiftType === 'opening' ? '☀️ AM' : '🌙 PM'}: {s.dailyRate}/hr
                  </span>
                </div>
              )}
              {s.weekAvgRate != null && (
                <p className="text-[10px] text-green-500">This week avg: {s.weekAvgRate}/hr</p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-green-500 italic">No closing log yet</p>
          )}
        </div>
      )}

      {/* Driver productivity strip */}
      {isDriver && (
        <div className="px-4 py-2.5 border-b border-green-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Trips Today</span>
            <span className="text-xs font-bold text-white">
              {s.tripsToday === 0 ? '0 runs logged' : `${s.tripsToday} run${s.tripsToday !== 1 ? 's' : ''}`}
            </span>
          </div>
          {s.weekAvgTrips != null && (
            <p className="text-[10px] text-green-500">This week avg: {s.weekAvgTrips} trips/day</p>
          )}
        </div>
      )}

      {/* Branch Selector */}
      {s.user.role === 'City Manager' && (
        <div className="px-4 py-3 border-b border-green-800 bg-green-800/40">
          <label className="block text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1.5">
            Active Branch
          </label>
          <select
            value={s.activeBranch}
            onChange={(e) => setActiveBranch(e.target.value as BranchId)}
            className="w-full bg-green-800 border border-green-700 text-white rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-fg-yellow focus:border-fg-yellow outline-none transition-colors cursor-pointer"
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
                    ? 'bg-fg-yellow/15 text-yellow-300'
                    : 'text-green-300 hover:bg-green-800 hover:text-white'
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
                  className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full text-green-500 hover:text-yellow-400 hover:bg-green-800 cursor-pointer"
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
      <div className="border-t border-green-800 px-3 py-2 space-y-1">
        {!s.editMode ? (
          <button
            type="button"
            onClick={() => { hapticLight(); s.setEditMode(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-green-400 hover:text-green-200 hover:bg-green-800 transition-colors cursor-pointer"
          >
            <span>⚙️</span>
            <span>Edit Menu</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={s.handleSave} className="flex-1 py-2 rounded-lg bg-fg-yellow text-black text-xs font-semibold transition hover:bg-fg-yellow-hi cursor-pointer">
              ✓ Save
            </button>
            <button type="button" onClick={s.handleReset} className="px-3 py-2 rounded-lg border border-green-700 text-xs font-medium text-green-400 hover:border-green-600 hover:text-green-200 transition cursor-pointer" title="Reset to default">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* User Section — desktop only */}
      <div className="hidden md:block border-t border-green-800 px-3 py-3">
        <SidebarNotificationPopover
          user={s.user}
          unreadCount={unreadCount}
          notifications={notifications}
          liveNotifs={s.liveNotifs}
          offShiftNotifIds={s.offShiftNotifIds}
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
