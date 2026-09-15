import type { HoldType, MechanicalSubType, DetailReason, VehicleStatus } from '../types';

/**
 * The hold types still OPEN — `holdTypes` minus what's been resolved. A resolved
 * type stays in `holdTypes` (the historical record) but shouldn't drive the
 * Multi-Hold badge or the active type pills. The single source for "which issues
 * are still active," so the history card and the dashboard row can't disagree.
 */
export function unresolvedHoldTypes(hold: { holdTypes: HoldType[]; resolvedTypes?: HoldType[] | null }): HoldType[] {
  // resolvedTypes can be missing on holds created before migration 077 added it —
  // treat absent as "nothing resolved" so every type reads open.
  const resolved = hold.resolvedTypes ?? [];
  return hold.holdTypes.filter(t => !resolved.includes(t));
}

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
      label: '🧩 Multi-Hold',
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
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-replacement') {
    return {
      label: '🛞 Tire Replacement',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-repair') {
    return {
      label: '🛞 Tire Repair',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  // ⭐ NO BADGE SAYS "HELD" ANY MORE (Aaron, 2026-09-14): *"things there are all held vehicles so having
  // a "held" badge is redundant. whatcha think of matching it to the hold type."* Every card on the
  // Holds list is held, so the word carried nothing — while damage, PM due and detail, the commonest
  // holds after sale cars, all hid behind it. The badge now says WHAT; the colour lanes are unchanged.
  // Multi-Hold stays as it is — *"listing everything might be too much to show"*.
  //
  // ⭐ EVERY BADGE IS EMOJI + WORD (Aaron, same evening: *"let's finish it off and plate things properly
  // add emojis to the other badges too"*). Half of them had one and half didn't, which read as unfinished
  // rather than chosen. REUSED from FG's own vocabulary so a type looks the same on the badge as in the
  // form that created it: 🧹 Detail and 🏷️ Sale (NewIssueReHoldForm / NewHoldDetailsSection), 🔌 missing
  // accessories (`holdContextEmojis` below), ⚠️ Safety / Recall (`hold-presets.ts`).
  // ⚠️ DAMAGE IS NOT 🔧, even though the re-hold form and scan sheet use 🔧 for it: the wrench belongs to
  // Mechanical — *"a wrench on a mechanical hold is enough"* — and two badges must not share a glyph. So
  // damage takes 💥, and 🧩 Multi-Hold is the one with no prior in FG at all.
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'pm-due') {
    return {
      label: '⚙️ PM Due',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'safety-recall') {
    return {
      label: '⚠️ Safety Recall',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  switch (holdTypes[0]) {
    case 'mechanical':
      return {
        label: '🔧 Mechanical',
        className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      };
    case 'detail':
      return {
        label: '🧹 Detail',
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    case 'sale_car':
      return {
        label: '🏷️ Sale Car',
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    case 'missing_accessories':
      return {
        label: '🔌 Missing Assets',
        className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      };
    case 'hail':
      return {
        label: '⛈️ Hail',
        className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      };
    default:
      // 'damage' — the one type that lands here. Red, as it always was.
      return {
        label: '💥 Damage',
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
  if (mechanicalSubType === 'tire-replacement')                                emojis.push('🛞');
  if (mechanicalSubType === 'pm-due')                                          emojis.push('⚙️');
  if (holdTypes.includes('mechanical') && !mechanicalSubType || mechanicalSubType === 'other') emojis.push('🔧');
  if (holdTypes.includes('missing_accessories'))                               emojis.push('🔌');
  if (holdTypes.includes('hail'))                                              emojis.push('⛈️');
  if (detailReason === 'smoke-vape')                                           emojis.push('🚬');
  if (detailReason === 'pet-hair')                                             emojis.push('🐾');
  return emojis;
}

export function holdTypePillClass(type: HoldType): string {
  switch (type) {
    case 'mechanical': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700';
    case 'detail':     return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800';
    case 'sale_car':   return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    case 'missing_accessories': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    case 'hail':       return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
    default:           return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  }
}
