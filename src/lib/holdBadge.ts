import type { HoldType, MechanicalSubType, DetailReason, VehicleStatus } from '../types';
// The WORD comes from the one label list, the glyph from HOLD_TYPE_EMOJI — the badge owns neither, so
// neither can drift (it once said "Missing Assets" while the list said "Missing Accessories").
import { HOLD_TYPE_LABELS } from './holdTypeLabels';

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

/**
 * ⭐ ONE EMOJI PER HOLD TYPE — the single source every surface reads (2026-09-14).
 *
 * The same type used to wear different glyphs depending on where he looked: the re-hold form had the
 * wrench and gear SWAPPED (`🔧 Damage`, `⚙️ Mechanical`), and the scan sheet hardcoded `🔧` in front of
 * every type, so it said `🔧 Hail` and `🔧 Sale Car` at the car. A glyph is only worth having if it means
 * the same thing on the sheet at the car, in the form that flags it, and on the badge on the list.
 *
 * ⚠️ The wrench is MECHANICAL's — Aaron: *"a wrench on a mechanical hold is enough."* Damage is 💥.
 * 🧹 Detail and 🏷️ Sale came from the hold forms, 🔌 from the row context emojis, ⚠️ from the
 * Safety / Recall preset.
 */
export const HOLD_TYPE_EMOJI: Readonly<Record<HoldType, string>> = {
  damage:              '💥',
  hail:                '⛈️',
  detail:              '🧹',
  mechanical:          '🔧',
  sale_car:            '🏷️',
  missing_accessories: '🔌',
};

/** The emoji for a whole hold: 🧩 when it carries several types, else its type — refined by the
 *  mechanical sub-type where one has its own (PM, tires, recall). */
export function holdEmoji(holdTypes: readonly HoldType[], mechanicalSubType?: MechanicalSubType | null): string {
  if (holdTypes.length > 1) return '🧩';
  if (holdTypes[0] === 'mechanical') {
    if (mechanicalSubType === 'tire-swap') return getTireSwapSeason();
    if (mechanicalSubType === 'tire-repair' || mechanicalSubType === 'tire-replacement') return '🛞';
    if (mechanicalSubType === 'pm-due') return '⚙️';
    if (mechanicalSubType === 'safety-recall') return '⚠️';
  }
  return HOLD_TYPE_EMOJI[holdTypes[0] ?? 'damage'];
}

export function holdBadgeConfig(
  holdTypes: HoldType[],
  mechanicalSubType?: MechanicalSubType | null,
): { label: string; className: string } {
  if (holdTypes.length > 1) {
    return {
      label: `${holdEmoji(holdTypes)} Multi-Hold`,
      className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-swap') {
    return {
      label: `${holdEmoji(holdTypes, mechanicalSubType)} Tire Swap`,
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-replacement') {
    return {
      label: `${holdEmoji(holdTypes, mechanicalSubType)} Tire Replacement`,
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'tire-repair') {
    return {
      label: `${holdEmoji(holdTypes, mechanicalSubType)} Tire Repair`,
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
      label: `${holdEmoji(holdTypes, mechanicalSubType)} PM Due`,
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  if (holdTypes[0] === 'mechanical' && mechanicalSubType === 'safety-recall') {
    return {
      label: `${holdEmoji(holdTypes, mechanicalSubType)} Safety Recall`,
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    };
  }
  switch (holdTypes[0]) {
    case 'mechanical':
      return {
        label: `${HOLD_TYPE_EMOJI.mechanical} ${HOLD_TYPE_LABELS.mechanical}`,
        className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      };
    case 'detail':
      return {
        label: `${HOLD_TYPE_EMOJI.detail} ${HOLD_TYPE_LABELS.detail}`,
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    case 'sale_car':
      return {
        label: `${HOLD_TYPE_EMOJI.sale_car} ${HOLD_TYPE_LABELS.sale_car}`,
        className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      };
    case 'missing_accessories':
      return {
        label: `${HOLD_TYPE_EMOJI.missing_accessories} ${HOLD_TYPE_LABELS.missing_accessories}`,
        className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      };
    case 'hail':
      return {
        label: `${HOLD_TYPE_EMOJI.hail} ${HOLD_TYPE_LABELS.hail}`,
        className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      };
    default:
      // 'damage' — the one type that lands here. Red, as it always was.
      return {
        label: `${HOLD_TYPE_EMOJI.damage} ${HOLD_TYPE_LABELS.damage}`,
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
  if (holdTypes.includes('mechanical') && !mechanicalSubType || mechanicalSubType === 'other') emojis.push(HOLD_TYPE_EMOJI.mechanical);
  if (holdTypes.includes('missing_accessories'))                               emojis.push(HOLD_TYPE_EMOJI.missing_accessories);
  if (holdTypes.includes('hail'))                                              emojis.push(HOLD_TYPE_EMOJI.hail);
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
