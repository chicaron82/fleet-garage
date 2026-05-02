import { supabase } from './supabase';
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

export async function fetchSidebarPrefs(userId: string): Promise<SidebarPrefs | null> {
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('sidebar')
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.sidebar as SidebarPrefs) ?? null;
  } catch {
    return null;
  }
}

export async function syncSidebarPrefs(userId: string, prefs: SidebarPrefs): Promise<void> {
  try {
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, sidebar: prefs, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
  } catch {
    // Supabase unavailable — localStorage copy persists
  }
}
