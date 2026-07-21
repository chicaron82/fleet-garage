export const DAMAGE_PRESETS = [
  'Scratch — paint surface',
  'Scratch — to bare metal',
  'Dent — minor (no paint break)',
  'Dent — major / crumple',
  'Cracked windshield',
  'Windshield chip',
  'Broken glass (window / mirror)',
  'Mirror damage / missing',
  'Bumper damage — cosmetic',
  'Bumper damage — structural',
  'Collision',
  'Rim / hubcap damage',
  'Missing part / accessory',
  'Other',
];

export interface MechanicalPresetMeta {
  emoji?: string;
  subType: 'tire-swap' | 'tire-repair' | 'pm-due' | 'safety-recall' | 'other';
}

export const MECHANICAL_PRESET_META: Record<string, MechanicalPresetMeta> = {
  'PM due':               { emoji: '⚙️',  subType: 'pm-due' },
  'Tire repair needed':   { emoji: '🛞',  subType: 'tire-repair' },
  'Seasonal tire swap':   { emoji: '🔄',  subType: 'tire-swap' },
  'Low tread':            { emoji: '🛞',  subType: 'tire-repair' },
  'Check engine light':   { emoji: '🔦',  subType: 'other' },
  'Brake service needed': { emoji: '🔧',  subType: 'other' },
  'Battery concern':      { emoji: '🔋',  subType: 'other' },
  'AC / heat issue':      { emoji: '❄️',  subType: 'other' },
  'Wiper replacement':    { emoji: '🌂',  subType: 'other' },
  'Geotab not installed': { emoji: '📡',  subType: 'other' },
  'Safety / Recall':      { emoji: '⚠️',  subType: 'safety-recall' },
  'Other':                { subType: 'other' },
};

export const MECHANICAL_PRESETS = Object.keys(MECHANICAL_PRESET_META);

/** The hold description that marks a car as "held until a Geotab unit is installed". Shared so the
 *  geotab-watchlist sync (on resolve) and the return-card filter key off ONE string, not two copies. */
export const GEOTAB_HOLD_DESC = 'Geotab not installed';
