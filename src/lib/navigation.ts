import type { UserRole, Screen, Module, BranchId, LandingTab } from '../types';
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

// Effie's home is NOT a role/branch module — she's the assistant, gated by the allowlist at
// the surface (the FAB/module hide for non-allowlisted accounts; the server 403s regardless).
// So her nav item is appended to every role's nav rather than sprinkled through ROLE_MODULES /
// BRANCH_CONFIGS, and canAccessScreen always permits it (a non-allowlisted user reaching it
// just can't send). See docs/ticket-misc-effie-module.md.
const EFFIE_NAV_ITEM: NavItem = { module: 'effie', label: 'Effie', icon: '✨', defaultScreen: { name: 'effie' } };

const ROLE_MODULES: Record<UserRole, Module[]> = {
  'Driver':              ['movement-log', 'schedule', 'lost-and-found', 'manifest'],
  'VSA':                 ['my-day', 'holds', 'movement-log', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'Lead VSA':            ['my-day', 'holds', 'audits', 'movement-log', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'CSR':                 ['holds', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'HIR':                 ['holds', 'movement-log', 'schedule', 'lost-and-found', 'issue-log', 'manifest'],
  'Branch Manager':      ['holds', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'Operations Manager':  ['holds', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'City Manager':        ['holds', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'AGM':                 ['holds', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
  'GM':                  ['holds', 'audits', 'analytics', 'schedule', 'my-shift', 'lost-and-found', 'issue-log', 'manifest', 'fleet-master'],
};

export function getNavItemsForRole(role: UserRole, activeBranch: BranchId = 'YWG'): NavItem[] {
  const roleModules = ROLE_MODULES[role] || [];
  const branchModules = BRANCH_CONFIGS[activeBranch]?.enabledModules || [];

  const items = ALL_NAV_ITEMS.filter(item =>
    roleModules.includes(item.module) &&
    branchModules.includes(item.module)
  );
  return [...items, EFFIE_NAV_ITEM]; // Effie's home rides along for everyone (allowlist-gated at the surface)
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

export function getDefaultScreenForRole(role: UserRole, activeBranch: BranchId = 'YWG'): Screen {
  const navItems = getNavItemsForRole(role, activeBranch);

  // Preferred default based on role
  let preferred: Screen = { name: 'dashboard' };
  if (role === 'VSA' || role === 'Lead VSA') preferred = { name: 'my-day' };
  if (role === 'Driver') preferred = { name: 'movement-log' };
  if (role === 'CSR') preferred = { name: 'manifest' };
  if (role === 'Branch Manager' || role === 'Operations Manager' || role === 'City Manager' || role === 'AGM' || role === 'GM') preferred = { name: 'analytics' };

  // Ensure preferred module is enabled for the branch, otherwise fallback to first available
  const preferredModule = getActiveModule(preferred);
  if (navItems.some(item => item.module === preferredModule)) {
    return preferred;
  }

  return navItems[0]?.defaultScreen || { name: 'dashboard' };
}

// ── Landing screen at login ──────────────────────────────────────────────────

/**
 * Resolve the screen to land on at login. An explicit deep-link URL always wins.
 * Otherwise the user's landing preference decides:
 *   - 'my-shift'      → pin My Shift (falls back to the role default if the role
 *                       can't reach it — Driver/CSR/HIR have no My Shift).
 *   - 'last-visited'  → resume the last module (`fg_last_module`), falling back to
 *                       the role default when there's no saved/reachable module.
 * The `savedModule` caller passes the (already legacy-remapped) last-visited module.
 */
export function resolveLandingScreen(opts: {
  deepLink: Screen | null;
  savedModule: Module | null;
  landingPref: LandingTab;
  role: UserRole;
  activeBranch?: BranchId;
}): Screen {
  const { deepLink, savedModule, landingPref, role, activeBranch = 'YWG' } = opts;
  if (deepLink) return deepLink;

  const navItems = getNavItemsForRole(role, activeBranch);

  if (landingPref === 'my-shift') {
    const myShift = navItems.find(i => i.module === 'my-shift');
    if (myShift) return myShift.defaultScreen;
    // Role can't reach My Shift — fall through to the role default below.
  } else {
    const savedNavItem = savedModule ? navItems.find(i => i.module === savedModule) : null;
    if (savedNavItem) return savedNavItem.defaultScreen;
  }

  return getDefaultScreenForRole(role, activeBranch);
}

// ── Access guard ─────────────────────────────────────────────────────────────

/**
 * Whether a role (at this branch) can actually reach a screen. Guards a restored
 * deep-link / saved route from landing a user on a module they're gated out of —
 * e.g. a leftover `/audits` URL after switching accounts in the same browser tab
 * would otherwise bypass the role gate that hides Audits from the sidebar.
 */
export function canAccessScreen(screen: Screen, role: UserRole, activeBranch: BranchId = 'YWG'): boolean {
  if (screen.name === 'effie') return true; // assistant home — gated by the allowlist at the surface, not by role
  const allowed = new Set(getNavItemsForRole(role, activeBranch).map(i => i.module));
  return allowed.has(getActiveModule(screen));
}
