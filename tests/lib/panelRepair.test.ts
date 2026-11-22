import { describe, it, expect } from 'vitest';
import { descriptionParts, offersPanelPick, planPanelRepair, issuePanelPick, planIssuePanels } from '../../src/lib/panelRepair';

// Aaron, 2026-10-21, 0ET075: "went to mark as repaired, but i'm afraid it will "repair" the rim
// damage as well." One hold, the windshield AND the rear rim — and only the chips got fixed.

const RIM = 'https://x/rim.jpg';
const WS = 'https://x/ws.jpg';
const oet075 = {
  holdTypes: ['damage'],
  damageZones: ['windshield', 'wheel-passenger-rear'],
  photos: [RIM, WS],
  damageDescription: 'Windshield chip; Rim / hubcap damage',
};
const none = { zones: [], photos: [], parts: [] };

describe('offersPanelPick', () => {
  it('asks on a one-type hold with two or more panels', () => {
    expect(offersPanelPick(oet075)).toBe(true);
  });

  it('does not ask on one panel, no panels, or a multi-type hold (that one resolves per issue)', () => {
    expect(offersPanelPick({ ...oet075, damageZones: ['windshield'] })).toBe(false);
    expect(offersPanelPick({ ...oet075, damageZones: [] })).toBe(false);
    expect(offersPanelPick({ ...oet075, damageZones: undefined })).toBe(false);
    expect(offersPanelPick({ ...oet075, holdTypes: ['damage', 'detail'] })).toBe(false);
  });

  it('counts a duplicated zone once', () => {
    expect(offersPanelPick({ ...oet075, damageZones: ['windshield', 'windshield'] })).toBe(false);
  });
});

describe('descriptionParts', () => {
  it('splits a multi-pick description back into its presets', () => {
    expect(descriptionParts('Windshield chip; Rim / hubcap damage')).toEqual(['Windshield chip', 'Rim / hubcap damage']);
    expect(descriptionParts('Hail damage')).toEqual(['Hail damage']);
    expect(descriptionParts(' ; Hail damage ;')).toEqual(['Hail damage']);
  });
});

describe('planPanelRepair', () => {
  it('every panel picked is the whole-hold repair it always was', () => {
    expect(planPanelRepair(oet075, { ...none, zones: ['windshield', 'wheel-passenger-rear'] })).toEqual({ kind: 'whole' });
  });

  it('no panel picked is also the whole hold, never an empty split', () => {
    expect(planPanelRepair(oet075, none)).toEqual({ kind: 'whole' });
  });

  // ⭐⭐ THE CAR THIS IS FOR.
  it('0ET075: the windshield leaves fixed, the rim stays on the hold with its own photo and words', () => {
    const plan = planPanelRepair(oet075, { zones: ['windshield'], photos: [WS], parts: ['Windshield chip'] });
    expect(plan).toEqual({
      kind: 'split',
      fixed: { zones: ['windshield'], photos: [WS], description: 'Windshield chip' },
      standing: { zones: ['wheel-passenger-rear'], photos: [RIM], description: 'Rim / hubcap damage' },
    });
  });

  // ⚠️ FG never guesses. What he leaves alone stays with the damage still on the car.
  it('photos and words he does not pick stay on the open hold', () => {
    const plan = planPanelRepair(oet075, { ...none, zones: ['windshield'] });
    expect(plan).toEqual({
      kind: 'split',
      fixed: { zones: ['windshield'], photos: [], description: oet075.damageDescription },
      standing: { zones: ['wheel-passenger-rear'], photos: [RIM, WS], description: oet075.damageDescription },
    });
  });

  it('never leaves a description empty: picking every part keeps the whole on both sides', () => {
    const plan = planPanelRepair(oet075, { ...none, zones: ['windshield'], parts: ['Windshield chip', 'Rim / hubcap damage'] });
    expect(plan.kind === 'split' && [plan.fixed.description, plan.standing.description])
      .toEqual([oet075.damageDescription, oet075.damageDescription]);
  });

  it('a single-preset hold (hail) keeps its description on both sides', () => {
    const hail = { damageZones: ['hood', 'roof', 'trunk-liftgate'], photos: [], damageDescription: 'Hail damage' };
    const plan = planPanelRepair(hail, { ...none, zones: ['hood'], parts: ['Hail damage'] });
    expect(plan).toEqual({
      kind: 'split',
      fixed: { zones: ['hood'], photos: [], description: 'Hail damage' },
      standing: { zones: ['roof', 'trunk-liftgate'], photos: [], description: 'Hail damage' },
    });
  });

  it('ignores a picked zone the hold does not carry', () => {
    expect(planPanelRepair(oet075, { ...none, zones: ['hood'] })).toEqual({ kind: 'whole' });
  });
});

// ── Per issue, on a multi-type hold — LJF720, 2026-11-21 ─────────────────────────────────────────
// Aaron: "if it was hail, then the damage map for hail should be cleared once marked repair. if i marked
// chip repaired, then the windshield would be cleared."
const ljf720 = {
  holdTypes: ['hail', 'damage'], resolvedTypes: [] as string[],
  damageZones: ['hood', 'windshield', 'roof', 'trunk-liftgate'],
  damageDescription: 'Hail damage; Windshield chip',
};

describe('issuePanelPick', () => {
  it('⭐ the hail asks, starting from the hail panels only — the windshield is the chip\'s', () => {
    expect(issuePanelPick(ljf720, 'hail')).toEqual({ last: false, preset: ['hood', 'roof', 'trunk-liftgate'] });
  });

  it('the chip asks too, with nothing ticked: FG never guesses a panel', () => {
    expect(issuePanelPick(ljf720, 'damage')).toEqual({ last: false, preset: [] });
  });

  it('the last open issue starts with every panel left ticked, so a full repair stays one tap', () => {
    expect(issuePanelPick({ ...ljf720, resolvedTypes: ['hail'] }, 'damage'))
      .toEqual({ last: true, preset: ['hood', 'windshield', 'roof', 'trunk-liftgate'] });
  });

  it('one panel, or an issue with no panel, stays today\'s single tap', () => {
    expect(issuePanelPick({ ...ljf720, damageZones: ['windshield'] }, 'hail')).toBeNull();
    expect(issuePanelPick({ ...ljf720, holdTypes: ['hail', 'mechanical'] }, 'mechanical')).toBeNull();
  });

  it('no other panel issue left open: nothing to keep a panel for, so no question', () => {
    expect(issuePanelPick({ ...ljf720, holdTypes: ['damage', 'mechanical'] }, 'damage')).toBeNull();
  });
});

describe('planIssuePanels', () => {
  const hold = { ...ljf720, photos: [] as string[] };
  it('some panels ticked → a split', () => {
    const plan = planIssuePanels(hold, { ...none, zones: ['hood', 'roof', 'trunk-liftgate'] }, false);
    expect(plan).toMatchObject({ kind: 'split', fixed: { zones: ['hood', 'roof', 'trunk-liftgate'] }, standing: { zones: ['windshield'] } });
  });
  it('nothing ticked → the issue is done and every panel stays (today\'s tap)', () => {
    expect(planIssuePanels(hold, none, false)).toEqual({ kind: 'resolve' });
  });
  it('everything ticked while another panel issue is open → blocked', () => {
    expect(planIssuePanels(hold, { ...none, zones: ljf720.damageZones }, false)).toEqual({ kind: 'blocked' });
  });
  it('the last issue, everything ticked → the whole repair', () => {
    expect(planIssuePanels(hold, { ...none, zones: ljf720.damageZones }, true)).toEqual({ kind: 'whole' });
  });
});
