import type { UserRole } from '../types';
import type { RentalClass } from '../data/manifest';

// Common → specialty order — how staff think about classes
export const ALL_RENTAL_CLASSES: RentalClass[] = [
  'C', 'F', 'B', 'B4', 'B5', 'D', 'A',
  'Q4', 'L', 'L2', 'T', 'T4', 'T6',
  'E7', 'E8', 'E9', 'E1', 'E6',
  'R', 'S', 'O6', 'A6',
];

export const CLASS_LABELS: Record<RentalClass, string> = {
  'A':  'Economy',      'A6': "Mgr's Special",
  'B':  'Small Sedan',  'B4': 'Small CUV',    'B5': 'Std CUV',
  'C':  'Compact',      'D':  'Regular',       'F':  'Full Size',
  'E1': 'EV (Niro)',    'E6': 'Hybrid',        'E7': 'Tesla Std',
  'E8': 'Tesla AWD',    'E9': 'Tesla Y',
  'Q4': 'SUV Compact',  'L':  'SUV Std',       'L2': 'SUV 7-seater',
  'R':  'Minivan',      'S':  'Truck',
  'T':  'Large SUV',    'T4': 'Large SUV+',    'T6': 'XL SUV',
  'O6': 'Mid Truck',
};

const CAN_OVERRIDE: UserRole[] = ['Lead VSA', 'CSR', 'Branch Manager', 'Operations Manager', 'City Manager'];

export function canSetOverride(role: UserRole): boolean {
  return CAN_OVERRIDE.includes(role);
}

function storageKey(): string {
  return `fg_class_overrides_${new Date().toLocaleDateString('en-CA')}`;
}

export function loadOverrides(): Set<RentalClass> {
  try {
    const raw = localStorage.getItem(storageKey());
    return new Set((raw ? JSON.parse(raw) : []) as RentalClass[]);
  } catch {
    return new Set();
  }
}

export function toggleOverride(cls: RentalClass): Set<RentalClass> {
  const current = loadOverrides();
  if (current.has(cls)) current.delete(cls); else current.add(cls);
  localStorage.setItem(storageKey(), JSON.stringify([...current]));
  return new Set(current);
}

export function clearAllOverrides(): void {
  localStorage.removeItem(storageKey());
}
