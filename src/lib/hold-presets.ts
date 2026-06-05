export const DAMAGE_PRESETS = [
  'Scratch — paint surface',
  'Scratch — to bare metal',
  'Dent — minor (no paint break)',
  'Dent — major / crumple',
  'Cracked windshield',
  'Windshield chip',
  'Windshield chip — repaired (scar remaining)',
  'Broken glass (window / mirror)',
  'Bumper damage — cosmetic',
  'Bumper damage — structural',
  'Rim / hubcap damage',
  'Interior stain',
  'Interior damage (seat / trim)',
  'Mechanical concern',
  'Missing part / accessory',
  'Tire damage / flat',
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
