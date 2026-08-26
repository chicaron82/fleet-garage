import { describe, it, expect } from 'vitest';
import { screenToPath, pathToScreen, historyWrite, depthOf } from '../../src/lib/screenRouting';
import type { Screen } from '../../src/types';

describe('screenToPath', () => {
  it('dashboard → /', () => {
    expect(screenToPath({ name: 'dashboard' })).toBe('/');
  });

  it('vehicle → /vehicle/:id', () => {
    expect(screenToPath({ name: 'vehicle', vehicleId: '5426838' })).toBe('/vehicle/5426838');
  });

  it('my-shift → /shift', () => {
    expect(screenToPath({ name: 'my-shift' })).toBe('/shift');
  });

  it('schedule → /schedule', () => {
    expect(screenToPath({ name: 'schedule' })).toBe('/schedule');
  });

  it('lost-and-found → /lost-and-found', () => {
    expect(screenToPath({ name: 'lost-and-found' })).toBe('/lost-and-found');
  });

  it('fleet-master → /fleet', () => {
    expect(screenToPath({ name: 'fleet-master' })).toBe('/fleet');
  });

  it('movement-log → /movement-log', () => {
    expect(screenToPath({ name: 'movement-log' })).toBe('/movement-log');
  });


  it('audits → /audits', () => {
    expect(screenToPath({ name: 'audits' })).toBe('/audits');
  });

  it('analytics → /analytics', () => {
    expect(screenToPath({ name: 'analytics' })).toBe('/analytics');
  });

  it('issue-log → /issue-log', () => {
    expect(screenToPath({ name: 'issue-log' })).toBe('/issue-log');
  });

  it('manifest → /manifest', () => {
    expect(screenToPath({ name: 'manifest' })).toBe('/manifest');
  });

  it('wizard screens all map to / (no stable URL)', () => {
    expect(screenToPath({ name: 'new-hold' })).toBe('/');
    expect(screenToPath({ name: 'new-hold', vehicleId: 'v1' })).toBe('/');
    expect(screenToPath({ name: 'register-vehicle' })).toBe('/');
    expect(screenToPath({ name: 'register-vehicle', fromHold: true, prefill: 'abc' })).toBe('/');
    expect(screenToPath({ name: 'audit-form' })).toBe('/');
  });
});

describe('pathToScreen', () => {
  it('/ → dashboard', () => {
    expect(pathToScreen('/')).toEqual({ name: 'dashboard' });
  });

  it('/holds alias → dashboard', () => {
    expect(pathToScreen('/holds')).toEqual({ name: 'dashboard' });
  });

  it('/vehicle/:id → vehicle screen', () => {
    expect(pathToScreen('/vehicle/5426838')).toEqual({ name: 'vehicle', vehicleId: '5426838' });
  });

  it('/vehicle/:id handles alphanumeric ids', () => {
    expect(pathToScreen('/vehicle/abc-123')).toEqual({ name: 'vehicle', vehicleId: 'abc-123' });
  });

  it('/shift → my-shift', () => {
    expect(pathToScreen('/shift')).toEqual({ name: 'my-shift' });
  });

  it('/my-shift alias → my-shift (the natural guess — module name, and /my-day exists)', () => {
    expect(pathToScreen('/my-shift')).toEqual({ name: 'my-shift' });
  });

  it('/schedule → schedule', () => {
    expect(pathToScreen('/schedule')).toEqual({ name: 'schedule' });
  });

  it('/lost-and-found → lost-and-found', () => {
    expect(pathToScreen('/lost-and-found')).toEqual({ name: 'lost-and-found' });
  });

  it('/fleet → fleet-master', () => {
    expect(pathToScreen('/fleet')).toEqual({ name: 'fleet-master' });
  });

  it('/movement-log → movement-log', () => {
    expect(pathToScreen('/movement-log')).toEqual({ name: 'movement-log' });
  });


  it('/audits → audits', () => {
    expect(pathToScreen('/audits')).toEqual({ name: 'audits' });
  });

  it('/analytics → analytics', () => {
    expect(pathToScreen('/analytics')).toEqual({ name: 'analytics' });
  });

  it('/issue-log → issue-log', () => {
    expect(pathToScreen('/issue-log')).toEqual({ name: 'issue-log' });
  });

  it('/manifest → manifest', () => {
    expect(pathToScreen('/manifest')).toEqual({ name: 'manifest' });
  });

  it('unrecognized paths → null', () => {
    expect(pathToScreen('/bogus')).toBeNull();
    expect(pathToScreen('/vehicle')).toBeNull();
    expect(pathToScreen('/vehicle/')).toBeNull();
    expect(pathToScreen('/admin')).toBeNull();
  });
});

describe('round-trip: pathToScreen(screenToPath(screen))', () => {
  const nonWizardScreens: Screen[] = [
    { name: 'dashboard' },
    { name: 'vehicle', vehicleId: '5426838' },
    { name: 'my-shift' },
    { name: 'schedule' },
    { name: 'lost-and-found' },
    { name: 'fleet-master' },
    { name: 'movement-log' },
    { name: 'audits' },
    { name: 'analytics' },
    { name: 'issue-log' },
    { name: 'manifest' },
  ];

  for (const screen of nonWizardScreens) {
    it(`${screen.name} survives round-trip`, () => {
      expect(pathToScreen(screenToPath(screen))).toEqual(screen);
    });
  }
});


// ── historyWrite ───────────────────────────────────────────────────────────────────────────────
// Aaron, 2026-08-26: "after registering a vehicle… when I hit back, it takes me back into the form
// I completed where it tells me that something already exists with this info." `navigate` only ever
// PUSHED, so a submitted register form stayed in the stack — and a submitted register form is a
// one-shot whose only remaining action is creating a duplicate of the car it just made.
describe('historyWrite — push descends, replace does not', () => {
  it('a normal navigation pushes one level deeper', () => {
    expect(historyWrite({ _depth: 1 })).toEqual({ method: 'push', depth: 2 });
    expect(historyWrite({ _depth: 0 })).toEqual({ method: 'push', depth: 1 });
  });

  // ⭐⭐ THE LOAD-BEARING ONE. backAction reads this depth to decide whether there is anywhere to go
  // back to. A replace that incremented would make the stack look one level deeper than it is, and
  // strand him at a fallback that never fires.
  it('a replace keeps the depth of the entry it is swapping', () => {
    expect(historyWrite({ _depth: 2 }, true)).toEqual({ method: 'replace', depth: 2 });
    expect(historyWrite({ _depth: 1 }, true)).toEqual({ method: 'replace', depth: 1 });
  });

  it('defaults to pushing when nothing is said', () => {
    expect(historyWrite({ _depth: 3 }).method).toBe('push');
    expect(historyWrite({ _depth: 3 }, false).method).toBe('push');
  });

  it('treats a missing or junk state as the app root', () => {
    expect(historyWrite(null)).toEqual({ method: 'push', depth: 1 });
    expect(historyWrite(undefined)).toEqual({ method: 'push', depth: 1 });
    expect(historyWrite({})).toEqual({ method: 'push', depth: 1 });
    expect(historyWrite(null, true)).toEqual({ method: 'replace', depth: 0 });
  });

  // ⭐ The property that makes the fix work: replacing NEVER grows the stack, however many times a
  // one-shot screen resolves. Pushing the same journey twice would put two entries behind him.
  it('repeated replaces stay at one depth; repeated pushes do not', () => {
    let state: { _depth: number } = { _depth: 1 };
    for (let i = 0; i < 5; i++) state = { _depth: historyWrite(state, true).depth };
    expect(state._depth).toBe(1);

    let pushed: { _depth: number } = { _depth: 1 };
    for (let i = 0; i < 5; i++) pushed = { _depth: historyWrite(pushed).depth };
    expect(pushed._depth).toBe(6);
  });

  it('agrees with depthOf about what it wrote', () => {
    const w = historyWrite({ _depth: 4 });
    expect(depthOf({ _depth: w.depth })).toBe(5);
  });
});
