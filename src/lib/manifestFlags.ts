import type { UserRole } from '../types';

const flagKey = (date: Date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `fg_manifest_flags_${y}-${m}-${d}`;
};

export function canFlagReservation(role: UserRole): boolean {
  return ['Branch Manager', 'Operations Manager', 'City Manager', 'CSR'].includes(role);
}

export function loadFlags(date?: Date): Set<string> {
  try {
    const raw = localStorage.getItem(flagKey(date));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveFlag(id: string, date?: Date): void {
  try {
    const flags = loadFlags(date);
    flags.add(id);
    localStorage.setItem(flagKey(date), JSON.stringify([...flags]));
  } catch { /* localStorage unavailable */ }
}

export function removeFlag(id: string, date?: Date): void {
  try {
    const flags = loadFlags(date);
    flags.delete(id);
    localStorage.setItem(flagKey(date), JSON.stringify([...flags]));
  } catch { /* localStorage unavailable */ }
}
