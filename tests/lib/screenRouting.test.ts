import { describe, it, expect } from 'vitest';
import { screenToPath, pathToScreen } from '../../src/lib/screenRouting';
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

  it('check-in → /check-in', () => {
    expect(screenToPath({ name: 'check-in' })).toBe('/check-in');
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

  it('/check-in → check-in', () => {
    expect(pathToScreen('/check-in')).toEqual({ name: 'check-in' });
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
    { name: 'check-in' },
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
