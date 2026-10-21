import { describe, it, expect } from 'vitest';
import { descriptionParts, offersPanelPick, planPanelRepair } from '../../src/lib/panelRepair';

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
