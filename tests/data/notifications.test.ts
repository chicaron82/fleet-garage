import { describe, expect, it } from 'vitest';
import {
  getVisibleNotifications,
  markNotificationsRead,
  MOCK_NOTIFICATIONS,
  type MockNotification,
} from '../../src/data/notifications';
import type { BranchId, UserRole } from '../../src/types';

function user(role: UserRole) {
  return { role };
}

function ids(list: MockNotification[]) {
  return list.map(n => n.id);
}

describe('getVisibleNotifications', () => {
  it('returns nothing when no user is logged in', () => {
    expect(getVisibleNotifications(MOCK_NOTIFICATIONS, null, 'YWG')).toEqual([]);
  });

  it('routes VSA notifications by role and branch', () => {
    expect(ids(getVisibleNotifications(MOCK_NOTIFICATIONS, user('VSA'), 'YWG'))).toEqual([
      'audit-shift-score',
      'transfer-hold-bay',
    ]);
  });

  it('filters out notifications outside the active branch', () => {
    expect(ids(getVisibleNotifications(MOCK_NOTIFICATIONS, user('VSA'), 'YVR'))).toEqual([]);
  });

  it('lets ALL branch see role-matching notifications across branches', () => {
    expect(ids(getVisibleNotifications(MOCK_NOTIFICATIONS, user('Branch Manager'), 'ALL'))).toEqual([
      'ops-anomaly-transit',
      'ops-code-red-shuttle',
      'transfer-hold-bay',
      'stale-hold-risk',
    ]);
  });

  it('does not leak manager-only notifications to drivers', () => {
    const visible = getVisibleNotifications(MOCK_NOTIFICATIONS, user('Driver'), 'YWG');
    expect(ids(visible)).toEqual(['driver-shuttle-route']);
    expect(visible.every(n => n.roles.includes('Driver'))).toBe(true);
  });

  it('supports fixture rows without branchIds as global per-role messages', () => {
    const global: MockNotification = {
      id: 'global-vsa',
      icon: 'G',
      text: 'Global VSA message',
      isRead: false,
      roles: ['VSA'],
      severity: 'info',
    };
    expect(ids(getVisibleNotifications([global], user('VSA'), 'YVR' as BranchId))).toEqual(['global-vsa']);
  });
});

describe('markNotificationsRead', () => {
  it('marks only visible ids as read', () => {
    const next = markNotificationsRead(MOCK_NOTIFICATIONS, ['audit-shift-score']);
    expect(next.find(n => n.id === 'audit-shift-score')?.isRead).toBe(true);
    expect(next.find(n => n.id === 'ops-anomaly-transit')?.isRead).toBe(false);
  });

  it('does not mutate the source list', () => {
    const original = MOCK_NOTIFICATIONS.find(n => n.id === 'audit-shift-score');
    markNotificationsRead(MOCK_NOTIFICATIONS, ['audit-shift-score']);
    expect(original?.isRead).toBe(false);
  });
});
