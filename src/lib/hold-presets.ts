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
  subType: 'tire-swap' | 'tire-repair' | 'tire-replacement' | 'pm-due' | 'safety-recall' | 'other';
}

export const MECHANICAL_PRESET_META: Record<string, MechanicalPresetMeta> = {
  'PM due':               { emoji: '⚙️',  subType: 'pm-due' },
  'Tire repair needed':   { emoji: '🛞',  subType: 'tire-repair' },
  'Seasonal tire swap':   { emoji: '🔄',  subType: 'tire-swap' },
  // ⚠️ WAS `tire-repair` until 2026-09-13, and that button had never once been pressed — every
  // tire hold on record was a repair or a seasonal swap, so the mis-mapping produced ZERO bad
  // rows. Low tread is new rubber, not a patch: *"Low tread needs tire replacement"* (Aaron).
  'Low tread':            { emoji: '🛞',  subType: 'tire-replacement' },
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
