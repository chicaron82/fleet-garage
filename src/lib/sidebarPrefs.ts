import type { Module } from '../types';

const storageKey = (userId: string) => `fg_sidebar_${userId}`;

export interface SidebarPrefs {
  order: Module[];
  hidden: Module[];
}

export function loadSidebarPrefs(userId: string): SidebarPrefs | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSidebarPrefs(userId: string, prefs: SidebarPrefs): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — fail silently
  }
}

export function clearSidebarPrefs(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}
