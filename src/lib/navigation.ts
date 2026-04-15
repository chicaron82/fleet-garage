import type { UserRole, Screen, Module } from '../types';

// ── Nav items ────────────────────────────────────────────────────────────────

export interface NavItem {
  module: Module;
  label: string;
  icon: string;
  defaultScreen: Screen;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { module: 'fleet-garage',   label: 'Fleet Garage',  icon: '🔧', defaultScreen: { name: 'dashboard' } },
  { module: 'trips',          label: 'Trips',         icon: '🚗', defaultScreen: { name: 'trips' } },
  { module: 'inventory',      label: 'Inventory',     icon: '📋', defaultScreen: { name: 'inventory' } },
  { module: 'lost-and-found', label: 'Lost & Found',  icon: '📦', defaultScreen: { name: 'lost-and-found' } },
];

const ROLE_MODULES: Record<UserRole, Module[]> = {
  'Driver':              ['trips', 'lost-and-found'],
  'VSA':                 ['fleet-garage', 'trips', 'inventory', 'lost-and-found'],
  'Lead VSA':            ['fleet-garage', 'trips', 'inventory', 'lost-and-found'],
  'CSR':                 ['fleet-garage', 'trips', 'lost-and-found'],
  'HIR':                 ['fleet-garage', 'trips', 'lost-and-found'],
  'Branch Manager':      ['fleet-garage', 'trips', 'inventory', 'lost-and-found'],
  'Operations Manager':  ['fleet-garage', 'trips', 'inventory', 'lost-and-found'],
};

export function getNavItemsForRole(role: UserRole): NavItem[] {
  const modules = ROLE_MODULES[role];
  return ALL_NAV_ITEMS.filter(item => modules.includes(item.module));
}

// ── Screen → Module mapping ─────────────────────────────────────────────────

const FLEET_GARAGE_SCREENS = new Set(['dashboard', 'vehicle', 'new-hold', 'register-vehicle']);

export function getActiveModule(screen: Screen): Module {
  if (FLEET_GARAGE_SCREENS.has(screen.name)) return 'fleet-garage';
  return screen.name as Module;
}

// ── Default screen per role ─────────────────────────────────────────────────

export function getDefaultScreenForRole(role: UserRole): Screen {
  if (role === 'Driver') return { name: 'trips' };
  return { name: 'dashboard' };
}
