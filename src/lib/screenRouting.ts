import type { Screen } from '../types';

export function screenToPath(screen: Screen): string {
  switch (screen.name) {
    case 'dashboard':       return '/';
    case 'vehicle':         return `/vehicle/${screen.vehicleId}`;
    case 'my-shift':        return '/shift';
    case 'schedule':        return '/schedule';
    case 'lost-and-found':  return '/lost-and-found';
    case 'fleet-master':    return '/fleet';
    case 'movement-log':    return '/movement-log';
    case 'check-in':        return '/check-in';
    case 'audits':          return '/audits';
    case 'analytics':       return '/analytics';
    case 'issue-log':       return '/issue-log';
    case 'manifest':        return '/manifest';
    // Wizard screens carry context that doesn't survive a fresh load — no stable URL.
    case 'new-hold':
    case 'register-vehicle':
    case 'audit-form':
      return '/';
  }
}

export function pathToScreen(path: string): Screen | null {
  if (path === '/' || path === '/holds') return { name: 'dashboard' };
  const vehicleMatch = path.match(/^\/vehicle\/(.+)$/);
  if (vehicleMatch) return { name: 'vehicle', vehicleId: vehicleMatch[1] };
  switch (path) {
    case '/shift':          return { name: 'my-shift' };
    case '/schedule':       return { name: 'schedule' };
    case '/lost-and-found': return { name: 'lost-and-found' };
    case '/fleet':          return { name: 'fleet-master' };
    case '/movement-log':   return { name: 'movement-log' };
    case '/check-in':       return { name: 'check-in' };
    case '/audits':         return { name: 'audits' };
    case '/analytics':      return { name: 'analytics' };
    case '/issue-log':      return { name: 'issue-log' };
    case '/manifest':       return { name: 'manifest' };
    default:                return null;
  }
}
