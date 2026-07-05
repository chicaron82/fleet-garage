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
  { module: 'my-day',  label: 'My Day',        icon: '🌅', defaultScreen: { name: 'my-day' } },
  { module: 'holds',   label: 'Holds',         icon: '🔧', defaultScreen: { name: 'dashboard' } },
  { module: 'check-in',       label: 'Check-in',      icon: '📸', defaultScreen: { name: 'check-in' } },
  { module: 'audits',         label: 'Audits',        icon: '✅', defaultScreen: { name: 'audits' } },
  { module: 'analytics',      label: 'Analytics',     icon: '📊', defaultScreen: { name: 'analytics' } },
  { module: 'movement-log',   label: 'Movement Log',  icon: '🚗', defaultScreen: { name: 'movement-log' } },
  { module: 'schedule',       label: 'Schedule',      icon: '📅', defaultScreen: { name: 'schedule' } },
  { module: 'my-shift',       label: 'My Shift',      icon: '📋', defaultScreen: { name: 'my-shift' } },
  { module: 'lost-and-found', label: 'Lost & Found',  icon: '📦', defaultScreen: { name: 'lost-and-found' } },
  { module: 'issue-log',      label: 'Issue Log',     icon: '⚠️', defaultScreen: { name: 'issue-log' } },
  { module: 'manifest',       label: 'Outbound Manifest', icon: '📋', defaultScreen: { name: 'manifest' } },
  { module: 'fleet-master',   label: 'Fleet',             icon: '🚘', defaultScreen: { name: 'fleet-master' } },
];

const ROLE_MODULES: Record<UserRole, Module[]> = {
  'Driver':              ['movement-log', 'schedule', 'lost-and-found', 'manifest'],
  'VSA':                 ['my-day', 'holds', 'check-in', 'movement-log', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'Lead VSA':            ['my-day', 'holds', 'check-in', 'audits', 'movement-log', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'CSR':                 ['holds', 'check-in', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'HIR':                 ['holds', 'check-in', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'Branch Manager':      ['holds', 'check-in', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'Operations Manager':  ['holds', 'check-in', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'City Manager':        ['holds', 'check-in', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'AGM':                 ['holds', 'check-in', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'GM':                  ['holds', 'check-in', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
};

// Modules kept only for demo personas — present as a showcase, hidden from real
// production accounts. Check-in was built for an HIR role nobody fills today; its
// one live workflow (exception re-hold) now lives in the holds module.
const DEMO_ONLY_MODULES = new Set<Module>(['check-in']);

export function getNavItemsForRole(role: UserRole, activeBranch: BranchId = 'YWG', canDemo = false): NavItem[] {
  const roleModules = ROLE_MODULES[role] || [];
  const branchModules = BRANCH_CONFIGS[activeBranch]?.enabledModules || [];

  return ALL_NAV_ITEMS.filter(item =>
    roleModules.includes(item.module) &&
    branchModules.includes(item.module) &&
    (canDemo || !DEMO_ONLY_MODULES.has(item.module))
  );
}

// ── Screen → Module mapping ─────────────────────────────────────────────────

const HOLDS_SCREENS = new Set(['dashboard', 'vehicle', 'new-hold', 'register-vehicle']);
const AUDIT_SCREENS = new Set(['audits', 'audit-form']);

export function getActiveModule(screen: Screen): Module {
  if (HOLDS_SCREENS.has(screen.name)) return 'holds';
  if (AUDIT_SCREENS.has(screen.name)) return 'audits';
  return screen.name as Module;
}

// ── Default screen per role ─────────────────────────────────────────────────

export function getDefaultScreenForRole(role: UserRole, activeBranch: BranchId = 'YWG', canDemo = false): Screen {
  const navItems = getNavItemsForRole(role, activeBranch, canDemo);
  
  // Preferred default based on role
  let preferred: Screen = { name: 'dashboard' };
  if (role === 'VSA' || role === 'Lead VSA') preferred = { name: 'my-day' };
  if (role === 'Driver') preferred = { name: 'movement-log' };
  if (role === 'HIR') preferred = { name: 'check-in' };
  if (role === 'CSR') preferred = { name: 'manifest' };
  if (role === 'Branch Manager' || role === 'Operations Manager' || role === 'City Manager' || role === 'AGM' || role === 'GM') preferred = { name: 'analytics' };

  // Ensure preferred module is enabled for the branch, otherwise fallback to first available
  const preferredModule = getActiveModule(preferred);
  if (navItems.some(item => item.module === preferredModule)) {
    return preferred;
  }

  return navItems[0]?.defaultScreen || { name: 'dashboard' };
}

// ── Access guard ─────────────────────────────────────────────────────────────

/**
 * Whether a role (at this branch) can actually reach a screen. Guards a restored
 * deep-link / saved route from landing a user on a module they're gated out of —
 * e.g. a leftover `/audits` URL after switching accounts in the same browser tab
 * would otherwise bypass the role gate that hides Audits from the sidebar.
 */
export function canAccessScreen(screen: Screen, role: UserRole, activeBranch: BranchId = 'YWG', canDemo = false): boolean {
  const allowed = new Set(getNavItemsForRole(role, activeBranch, canDemo).map(i => i.module));
  return allowed.has(getActiveModule(screen));
}
