import type { BranchId, User, UserRole } from '../types';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'urgent';

export interface MockNotification {
  id: string;
  icon: string;
  text: string;
  isRead: boolean;
  roles: UserRole[];
  branchIds?: BranchId[];
  severity: NotificationSeverity;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'ops-anomaly-transit',
    icon: '!',
    text: "Anomaly Detected: GenZee's transit time exceeded baseline by 22m. Notes: 'Traffic deadlocked on Route 90.'",
    isRead: false,
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'],
    branchIds: ['YWG'],
    severity: 'warning',
  },
  {
    id: 'ops-code-red-shuttle',
    icon: '!!',
    text: 'Shift Interruption: Geoff logged a Code Red shuttle run. Washbay queue currently 14.',
    isRead: false,
    roles: ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'],
    branchIds: ['YWG'],
    severity: 'urgent',
  },
  {
    id: 'audit-shift-score',
    icon: 'QA',
    text: 'Audit Complete: Your Shift QA scored 96%. Tap to review.',
    isRead: false,
    roles: ['VSA', 'Lead VSA'],
    branchIds: ['YWG', 'YWG-South'],
    severity: 'success',
  },
  {
    id: 'transfer-hold-bay',
    icon: '<>',
    text: '5 units automatically moved to Hold Bay from YYC transfer.',
    isRead: true,
    roles: ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'],
    branchIds: ['YWG', 'YYC'],
    severity: 'info',
  },
  {
    id: 'stale-hold-risk',
    icon: '48h',
    text: '3 active holds are past the 48h follow-up window. Manager review recommended.',
    isRead: false,
    roles: ['Branch Manager', 'Operations Manager', 'City Manager'],
    branchIds: ['YWG', 'YVR'],
    severity: 'warning',
  },
  {
    id: 'driver-shuttle-route',
    icon: 'RUN',
    text: 'Route update: Airport shuttle handoff moved to Door 3 for the next two runs.',
    isRead: false,
    roles: ['Driver'],
    branchIds: ['YWG'],
    severity: 'info',
  },
];

export function getVisibleNotifications(
  notifications: MockNotification[],
  user: Pick<User, 'role'> | null,
  activeBranch: BranchId,
): MockNotification[] {
  return notifications.filter(n => {
    if (!user || !n.roles.includes(user.role)) return false;
    if (!n.branchIds || activeBranch === 'ALL') return true;
    return n.branchIds.includes(activeBranch);
  });
}

export function markNotificationsRead(
  notifications: MockNotification[],
  visibleIds: string[],
): MockNotification[] {
  const ids = new Set(visibleIds);
  return notifications.map(n => ids.has(n.id) ? { ...n, isRead: true } : n);
}
