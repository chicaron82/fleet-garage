import type { ShiftType } from '../types';

export function getTypeDefaults(isPeakSeason: boolean): Record<ShiftType, { start: string; end: string }> {
  return {
    'opening': { start: '06:45', end: '15:15' },
    'mid':     { start: '10:30', end: '19:00' },
    'closing': isPeakSeason ? { start: '14:30', end: '23:00' } : { start: '13:30', end: '22:00' },
    'day-off': { start: '',      end: ''      },
  };
}
