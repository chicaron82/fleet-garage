// Per-user quick-start ordering, persisted client-side (no migration — same
// localStorage approach as sidebarPrefs). A saved order is the user's explicit
// arrangement from the customizer; absence means "use the schedule-aware default".
const storageKey = (userId: string) => `fg_quickstart_${userId}`;

export function loadQuickStartOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveQuickStartOrder(userId: string, order: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(order));
  } catch {
    // localStorage unavailable — fail silently (matches sidebarPrefs)
  }
}

export function clearQuickStartOrder(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // fail silently
  }
}
