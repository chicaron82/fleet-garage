import { describe, it, expect } from 'vitest';
import {
  getNavItemsForRole,
  getActiveModule,
  getDefaultScreenForRole,
  canAccessScreen,
} from '../../src/lib/navigation';
import type { UserRole } from '../../src/types';

// ── getNavItemsForRole ────────────────────────────────────────────────────────

describe('getNavItemsForRole', () => {
  it('Driver only sees movement-log and lost-and-found', () => {
    const modules = getNavItemsForRole('Driver').map(n => n.module);
    expect(modules).toContain('movement-log');
    expect(modules).toContain('lost-and-found');
    expect(modules).not.toContain('holds');
    expect(modules).not.toContain('fleet-master');
    expect(modules).not.toContain('check-in');
  });

  it('VSA sees holds', () => {
    const modules = getNavItemsForRole('VSA').map(n => n.module);
    expect(modules).toContain('holds');
  });

  it('CSR does not see fleet-master', () => {
    const modules = getNavItemsForRole('CSR').map(n => n.module);
    expect(modules).not.toContain('fleet-master');
  });

  it('CSR sees manifest', () => {
    const modules = getNavItemsForRole('CSR').map(n => n.module);
    expect(modules).toContain('manifest');
  });

  it('Branch Manager sees all modules including holds (check-in is demo-gated)', () => {
    const modules = getNavItemsForRole('Branch Manager').map(n => n.module);
    expect(modules).toContain('holds');
    expect(modules).not.toContain('check-in'); // demo-only — hidden from real accounts
    expect(modules).toContain('analytics');
    expect(modules).toContain('fleet-master');
    expect(modules).toContain('lost-and-found');
  });

  it('returns NavItem objects with required shape', () => {
    const items = getNavItemsForRole('VSA');
    for (const item of items) {
      expect(item).toHaveProperty('module');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('icon');
      expect(item).toHaveProperty('defaultScreen');
    }
  });
});

// ── check-in demo gating ──────────────────────────────────────────────────────

describe('check-in demo gating', () => {
  it('hides check-in from real accounts by default', () => {
    expect(getNavItemsForRole('VSA').map(n => n.module)).not.toContain('check-in');
    expect(getNavItemsForRole('Branch Manager').map(n => n.module)).not.toContain('check-in');
  });

  it('shows check-in to demo personas', () => {
    expect(getNavItemsForRole('VSA', 'YWG', true).map(n => n.module)).toContain('check-in');
    expect(getNavItemsForRole('Branch Manager', 'YWG', true).map(n => n.module)).toContain('check-in');
  });

  it('does not grant check-in to roles that never had it, even in demo', () => {
    expect(getNavItemsForRole('Driver', 'YWG', true).map(n => n.module)).not.toContain('check-in');
  });
});

// ── getActiveModule ───────────────────────────────────────────────────────────

describe('getActiveModule', () => {
  it('dashboard screen → holds module', () => {
    expect(getActiveModule({ name: 'dashboard' })).toBe('holds');
  });

  it('vehicle screen → holds module', () => {
    expect(getActiveModule({ name: 'vehicle', vehicleId: 'v1' })).toBe('holds');
  });

  it('new-hold screen → holds module', () => {
    expect(getActiveModule({ name: 'new-hold' })).toBe('holds');
  });

  it('register-vehicle screen → holds module', () => {
    expect(getActiveModule({ name: 'register-vehicle' })).toBe('holds');
  });

  it('movement-log screen → movement-log module', () => {
    expect(getActiveModule({ name: 'movement-log' })).toBe('movement-log');
  });

  it('check-in screen → check-in module', () => {
    expect(getActiveModule({ name: 'check-in' })).toBe('check-in');
  });

  it('fleet-master screen → fleet-master module', () => {
    expect(getActiveModule({ name: 'fleet-master' })).toBe('fleet-master');
  });

  it('lost-and-found screen → lost-and-found module', () => {
    expect(getActiveModule({ name: 'lost-and-found' })).toBe('lost-and-found');
  });
});

// ── getDefaultScreenForRole ───────────────────────────────────────────────────

describe('getDefaultScreenForRole', () => {
  const DASHBOARD_ROLES: UserRole[] = ['VSA', 'Lead VSA'];
  const ANALYTICS_ROLES: UserRole[] = ['Branch Manager', 'Operations Manager', 'City Manager'];

  it('Driver lands on movement-log', () => {
    expect(getDefaultScreenForRole('Driver')).toEqual({ name: 'movement-log' });
  });

  it('HIR (real account) falls back to holds dashboard — check-in is demo-gated', () => {
    expect(getDefaultScreenForRole('HIR')).toEqual({ name: 'dashboard' });
  });

  it('HIR (demo persona) lands on check-in', () => {
    expect(getDefaultScreenForRole('HIR', 'YWG', true)).toEqual({ name: 'check-in' });
  });

  it('CSR lands on manifest', () => {
    expect(getDefaultScreenForRole('CSR')).toEqual({ name: 'manifest' });
  });

  it.each(ANALYTICS_ROLES)('%s lands on analytics', (role) => {
    expect(getDefaultScreenForRole(role)).toEqual({ name: 'analytics' });
  });

  it.each(DASHBOARD_ROLES)('%s lands on dashboard', (role) => {
    expect(getDefaultScreenForRole(role)).toEqual({ name: 'dashboard' });
  });
});

// ── canAccessScreen (the deep-link access guard) ──────────────────────────────

describe('canAccessScreen', () => {
  it('lets a Lead VSA reach the audit screens', () => {
    expect(canAccessScreen({ name: 'audits' }, 'Lead VSA')).toBe(true);
    expect(canAccessScreen({ name: 'audit-form' }, 'Lead VSA')).toBe(true);
  });

  it('blocks a VSA from the audit module — the reported bug', () => {
    // A leftover /audits deep-link after switching from a Lead VSA account must not
    // land a VSA on a module their role is gated out of.
    expect(canAccessScreen({ name: 'audits' }, 'VSA')).toBe(false);
    expect(canAccessScreen({ name: 'audit-form' }, 'VSA')).toBe(false);
  });

  it('still allows deep-links the role CAN access', () => {
    expect(canAccessScreen({ name: 'schedule' }, 'VSA')).toBe(true);
    expect(canAccessScreen({ name: 'my-shift' }, 'VSA')).toBe(true);
    // holds-family screens map to the holds module, which VSA has
    expect(canAccessScreen({ name: 'dashboard' }, 'VSA')).toBe(true);
  });

  it('blocks analytics/fleet-master for a frontline role', () => {
    expect(canAccessScreen({ name: 'analytics' }, 'VSA')).toBe(false);
    expect(canAccessScreen({ name: 'fleet-master' }, 'VSA')).toBe(false);
    expect(canAccessScreen({ name: 'analytics' }, 'GM')).toBe(true);
  });
});
