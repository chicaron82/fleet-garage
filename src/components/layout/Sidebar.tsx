import { useState, useRef, useEffect } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../context/AuthContext';
import { useGarage } from '../../context/GarageContext';
import { useFleetBalance } from '../../hooks/useFleetBalance';
import { UserProfileMenu } from '../UserProfileMenu';
import { getNavItemsForRole } from '../../lib/navigation';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { loadSidebarPrefs, saveSidebarPrefs, clearSidebarPrefs, fetchSidebarPrefs, syncSidebarPrefs } from '../../lib/sidebarPrefs';
import type { Module, Screen, BranchId } from '../../types';
import type { NavItem } from '../../lib/navigation';
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

function SortableNavItem({
  item, isHidden, onToggleHidden, badge,
}: { item: NavItem; isHidden: boolean; onToggleHidden: () => void; badge?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.module });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isHidden ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
    >
      <button
        type="button"
        onClick={onToggleHidden}
        disabled={item.module === 'fleet-garage'}
        className="text-base leading-none shrink-0 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title={isHidden ? 'Show' : 'Hide'}
      >
        {isHidden ? '🚫' : '👁️'}
      </button>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {item.icon} {item.label}
      </span>
      {badge ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> : null}
      <button
        type="button"
        className="text-gray-400 cursor-grab active:cursor-grabbing px-1 touch-none"
        onPointerDown={() => hapticLight()}
        {...attributes}
        {...listeners}
      >
        ≡
      </button>
    </div>
  );
}

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

export function Sidebar({ activeModule, onNavigate, onClose, onShowGuide, notifications, unreadCount, onMarkAllRead }: Props) {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const { facilityIssues } = useGarage();
  const { getTodayEntry } = useFleetBalance();
  const todayFleetEntry = getTodayEntry();
  const openHighIssues = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
  const MODULE_BADGES: Partial<Record<Module, number>> = { 'issue-log': openHighIssues };
  const [desktopInboxOpen, setDesktopInboxOpen] = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [localOrder, setLocalOrder] = useState<Module[]>([]);
  const [hidden, setHidden]         = useState<Module[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

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

  const defaultNavItems = getNavItemsForRole(user.role, activeBranch);
  const defaultOrder    = defaultNavItems.map(i => i.module);

  useEffect(() => {
    const applyPrefs = (saved: { order: Module[]; hidden: Module[] } | null) => {
      if (saved) {
        const newModules = defaultOrder.filter(
          m => !saved.order.includes(m) && !saved.hidden.includes(m)
        );
        setLocalOrder([...saved.order, ...newModules]);
        setHidden(saved.hidden);
      } else {
        setLocalOrder(defaultOrder);
        setHidden([]);
      }
    };

    // Sync localStorage load — immediate, no flicker
    applyPrefs(loadSidebarPrefs(user.id));

    // Async Supabase hydration — overrides if remote row exists
    fetchSidebarPrefs(user.id).then(remote => {
      if (remote) {
        applyPrefs(remote);
        saveSidebarPrefs(user.id, remote);
      }
    });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedItems = localOrder
    .filter(m => !hidden.includes(m))
    .map(m => defaultNavItems.find(i => i.module === m))
    .filter(Boolean) as NavItem[];

  const allItems = [
    ...localOrder.filter(m => !hidden.includes(m)).map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
    ...hidden.map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    hapticMedium();
    const oldIndex = localOrder.indexOf(active.id as Module);
    const newIndex = localOrder.indexOf(over.id as Module);
    setLocalOrder(arrayMove(localOrder, oldIndex, newIndex));
  };

  const toggleHidden = (module: Module) => {
    if (module === 'fleet-garage') return;
    hapticLight();
    if (hidden.includes(module)) {
      setHidden(h => h.filter(m => m !== module));
    } else {
      setHidden(h => [...h, module]);
    }
  };

  const handleSave = () => {
    hapticMedium();
    const prefs = { order: localOrder, hidden };
    saveSidebarPrefs(user.id, prefs);
    syncSidebarPrefs(user.id, prefs);
    setEditMode(false);
  };

  const handleReset = () => {
    hapticLight();
    clearSidebarPrefs(user.id);
    syncSidebarPrefs(user.id, { order: defaultOrder, hidden: [] });
    setLocalOrder(defaultOrder);
    setHidden([]);
    setEditMode(false);
  };

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

      {/* Fleet balance strip — non-management only */}
      {!['Branch Manager', 'Operations Manager', 'City Manager'].includes(user.role) && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {todayFleetEntry ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fleet Today</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Out</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{todayFleetEntry.outCount}</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">In</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{todayFleetEntry.inCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">No fleet numbers today</p>
          )}
        </div>
      )}

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
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">

        {/* Normal mode */}
        {!editMode && displayedItems.map(item => {
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
                {MODULE_BADGES[item.module] ? (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 shrink-0" />
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
        {editMode && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {allItems.map(item => (
                  <SortableNavItem
                    key={item.module}
                    item={item}
                    isHidden={hidden.includes(item.module)}
                    onToggleHidden={() => toggleHidden(item.module)}
                    badge={MODULE_BADGES[item.module]}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

      </nav>

      {/* Edit / Save / Reset Controls */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-1">
        {!editMode ? (
          <button
            type="button"
            onClick={() => { hapticLight(); setEditMode(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span>⚙️</span>
            <span>Edit Menu</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg bg-yellow-400 dark:bg-yellow-500 text-black text-xs font-semibold transition hover:bg-yellow-500 cursor-pointer"
            >
              ✓ Save
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
              title="Reset to default"
            >
              Reset
            </button>
          </div>
        )}
      </div>

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
