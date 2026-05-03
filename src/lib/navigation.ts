import type { UserRole, Screen, Module, BranchId } from '../types';
import { BRANCH_CONFIGS } from '../data/mock';

// ── Nav items ────────────────────────────────────────────────────────────────

export interface NavItem {
  module: Module;
  label: string;
  icon: string;
  defaultScreen: Screen;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { module: 'fleet-garage',   label: 'Holds',         icon: '🔧', defaultScreen: { name: 'dashboard' } },
  { module: 'check-in',       label: 'Check-in',      icon: '📸', defaultScreen: { name: 'check-in' } },
  { module: 'audits',         label: 'Audits',        icon: '✅', defaultScreen: { name: 'audits' } },
  { module: 'analytics',      label: 'Analytics',     icon: '📊', defaultScreen: { name: 'analytics' } },
  { module: 'movement-log',   label: 'Movement Log',  icon: '🚗', defaultScreen: { name: 'movement-log' } },
  { module: 'schedule',       label: 'Schedule',      icon: '📅', defaultScreen: { name: 'schedule' } },
  { module: 'inventory',      label: 'Inventory',     icon: '📋', defaultScreen: { name: 'inventory' } },
  { module: 'lost-and-found', label: 'Lost & Found',  icon: '📦', defaultScreen: { name: 'lost-and-found' } },
  { module: 'issue-log',      label: 'Issue Log',     icon: '⚠️', defaultScreen: { name: 'issue-log' } },
  { module: 'manifest',       label: 'Outbound Manifest', icon: '📋', defaultScreen: { name: 'manifest' } },
];

const ROLE_MODULES: Record<UserRole, Module[]> = {
  'Driver':              ['movement-log', 'schedule', 'lost-and-found', 'manifest'],
  'VSA':                 ['fleet-garage', 'check-in', 'movement-log', 'schedule', 'inventory', 'lost-and-found', 'issue-log', 'manifest'],
  'Lead VSA':            ['fleet-garage', 'check-in', 'audits', 'movement-log', 'schedule', 'inventory', 'lost-and-found', 'issue-log', 'manifest'],
  'CSR':                 ['fleet-garage', 'check-in', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'HIR':                 ['fleet-garage', 'check-in', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'Branch Manager':      ['fleet-garage', 'check-in', 'audits', 'analytics', 'schedule', 'inventory', 'lost-and-found', 'issue-log', 'manifest'],
  'Operations Manager':  ['fleet-garage', 'check-in', 'audits', 'analytics', 'schedule', 'inventory', 'lost-and-found', 'issue-log', 'manifest'],
  'City Manager':        ['fleet-garage', 'check-in', 'audits', 'analytics', 'schedule', 'inventory', 'lost-and-found', 'issue-log', 'manifest'],
};

export function getNavItemsForRole(role: UserRole, activeBranch: BranchId = 'YWG'): NavItem[] {
  const roleModules = ROLE_MODULES[role] || [];
  const branchModules = BRANCH_CONFIGS[activeBranch]?.enabledModules || [];
  
  return ALL_NAV_ITEMS.filter(item => 
    roleModules.includes(item.module) && branchModules.includes(item.module)
  );
}

// ── Screen → Module mapping ─────────────────────────────────────────────────

const FLEET_GARAGE_SCREENS = new Set(['dashboard', 'vehicle', 'new-hold', 'register-vehicle']);
const AUDIT_SCREENS = new Set(['audits', 'audit-form']);

export function getActiveModule(screen: Screen): Module {
  if (FLEET_GARAGE_SCREENS.has(screen.name)) return 'fleet-garage';
  if (AUDIT_SCREENS.has(screen.name)) return 'audits';
  return screen.name as Module;
}

// ── Default screen per role ─────────────────────────────────────────────────

export function getDefaultScreenForRole(role: UserRole, activeBranch: BranchId = 'YWG'): Screen {
  const navItems = getNavItemsForRole(role, activeBranch);
  
  // Preferred default based on role
  let preferred: Screen = { name: 'dashboard' };
  if (role === 'Driver') preferred = { name: 'movement-log' };
  if (role === 'HIR') preferred = { name: 'check-in' };
  if (role === 'CSR') preferred = { name: 'manifest' };
  if (role === 'Branch Manager' || role === 'Operations Manager' || role === 'City Manager') preferred = { name: 'analytics' };

  // Ensure preferred module is enabled for the branch, otherwise fallback to first available
  const preferredModule = getActiveModule(preferred);
  if (navItems.some(item => item.module === preferredModule)) {
    return preferred;
  }
  
  return navItems[0]?.defaultScreen || { name: 'dashboard' };
}
