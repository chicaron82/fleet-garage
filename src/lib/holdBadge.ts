import type { HoldType, MechanicalSubType, DetailReason, VehicleStatus } from '../types';

export function getTireSwapSeason(): '☀️' | '❄️' {
  const month = new Date().getMonth() + 1; // 1–12
  return (month >= 5 && month <= 8) ? '☀️' : '❄️';
}

export function holdBadgeConfig(
  holdTypes: HoldType[],
  mechanicalSubType?: MechanicalSubType | null,
): { label: string; className: string } {
  if (holdTypes.length > 1) {
    return {
      label: 'Multi-Hold',
      className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-swap') {
    const season = getTireSwapSeason();
    return {
      label: `${season} Tire Swap`,
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-repair') {
    return {
      label: '🛞 Tire Repair',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  switch (holdTypes[0]) {
    case 'mechanical':
      return {
        label: 'Held',
        className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      };
    case 'detail':
      return {
        label: 'Held',
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    case 'sale_car':
      return {
        label: 'Sale Car',
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    default:
      return {
        label: 'Held',
        className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      };
  }
}

export function holdContextEmojis(
  vehicleStatus: VehicleStatus,
  holdTypes: HoldType[],
  detailReason?: DetailReason | null,
  mechanicalSubType?: MechanicalSubType | null,
): string[] {
  const emojis: string[] = [];
  if (vehicleStatus === 'OUT_ON_EXCEPTION')                                   emojis.push('⚠️');
  if (mechanicalSubType === 'tire-swap')                                       emojis.push(getTireSwapSeason());
  if (mechanicalSubType === 'tire-repair')                                     emojis.push('🛞');
  if (mechanicalSubType === 'pm-due')                                          emojis.push('⚙️');
  if (holdTypes.includes('mechanical') && !mechanicalSubType || mechanicalSubType === 'other') emojis.push('🔧');
  if (detailReason === 'smoke-vape')                                           emojis.push('🚬');
  if (detailReason === 'pet-hair')                                             emojis.push('🐾');
  return emojis;
}

export function holdTypePillClass(type: HoldType): string {
  switch (type) {
    case 'mechanical': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700';
    case 'detail':     return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800';
    case 'sale_car':   return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    default:           return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  }
}
