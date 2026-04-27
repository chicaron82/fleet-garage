import { describe, it, expect } from 'vitest';
import {
  getNavItemsForRole,
  getActiveModule,
  getDefaultScreenForRole,
} from '../../src/lib/navigation';
import type { UserRole } from '../../src/types';

// ── getNavItemsForRole ────────────────────────────────────────────────────────

describe('getNavItemsForRole', () => {
  it('Driver only sees trips and lost-and-found', () => {
    const modules = getNavItemsForRole('Driver').map(n => n.module);
    expect(modules).toContain('trips');
    expect(modules).toContain('lost-and-found');
    expect(modules).not.toContain('fleet-garage');
    expect(modules).not.toContain('inventory');
    expect(modules).not.toContain('check-in');
  });

  it('VSA sees fleet-garage', () => {
    const modules = getNavItemsForRole('VSA').map(n => n.module);
    expect(modules).toContain('fleet-garage');
  });

  it('CSR does not see inventory', () => {
    const modules = getNavItemsForRole('CSR').map(n => n.module);
    expect(modules).not.toContain('inventory');
  });

  it('Branch Manager sees all modules', () => {
    const modules = getNavItemsForRole('Branch Manager').map(n => n.module);
    expect(modules).toContain('fleet-garage');
    expect(modules).toContain('check-in');
    expect(modules).toContain('trips');
    expect(modules).toContain('inventory');
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

// ── getActiveModule ───────────────────────────────────────────────────────────

describe('getActiveModule', () => {
  it('dashboard screen → fleet-garage module', () => {
    expect(getActiveModule({ name: 'dashboard' })).toBe('fleet-garage');
  });

  it('vehicle screen → fleet-garage module', () => {
    expect(getActiveModule({ name: 'vehicle', vehicleId: 'v1' })).toBe('fleet-garage');
  });

  it('new-hold screen → fleet-garage module', () => {
    expect(getActiveModule({ name: 'new-hold' })).toBe('fleet-garage');
  });

  it('register-vehicle screen → fleet-garage module', () => {
    expect(getActiveModule({ name: 'register-vehicle' })).toBe('fleet-garage');
  });

  it('trips screen → trips module', () => {
    expect(getActiveModule({ name: 'trips' })).toBe('trips');
  });

  it('check-in screen → check-in module', () => {
    expect(getActiveModule({ name: 'check-in' })).toBe('check-in');
  });

  it('inventory screen → inventory module', () => {
    expect(getActiveModule({ name: 'inventory' })).toBe('inventory');
  });

  it('lost-and-found screen → lost-and-found module', () => {
    expect(getActiveModule({ name: 'lost-and-found' })).toBe('lost-and-found');
  });
});

// ── getDefaultScreenForRole ───────────────────────────────────────────────────

describe('getDefaultScreenForRole', () => {
  const NON_DRIVER_ROLES: UserRole[] = [
    'VSA', 'Lead VSA', 'CSR', 'Branch Manager', 'Operations Manager',
  ];

  it('Driver lands on trips', () => {
    expect(getDefaultScreenForRole('Driver')).toEqual({ name: 'trips' });
  });

  it.each(NON_DRIVER_ROLES)('%s lands on dashboard', (role) => {
    expect(getDefaultScreenForRole(role)).toEqual({ name: 'dashboard' });
  });

  it('HIR lands on check-in', () => {
    expect(getDefaultScreenForRole('HIR')).toEqual({ name: 'check-in' });
  });

  it('City Manager lands on analytics', () => {
    expect(getDefaultScreenForRole('City Manager')).toEqual({ name: 'analytics' });
  });
});
