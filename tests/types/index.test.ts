import { describe, it, expect } from 'vitest';
import { canRelease, canLogHandoff, canVsaClear, isFullDayShift } from '../../src/types/index';

describe('canRelease', () => {
  it('Branch Manager can release', () => expect(canRelease('Branch Manager')).toBe(true));
  it('Operations Manager can release', () => expect(canRelease('Operations Manager')).toBe(true));
  it('City Manager can release', () => expect(canRelease('City Manager')).toBe(true));
  it('VSA cannot release', () => expect(canRelease('VSA')).toBe(false));
  it('Lead VSA cannot release', () => expect(canRelease('Lead VSA')).toBe(false));
  it('CSR cannot release', () => expect(canRelease('CSR')).toBe(false));
  it('Driver cannot release', () => expect(canRelease('Driver')).toBe(false));
});

describe('canLogHandoff', () => {
  it('VSA can log handoff', () => expect(canLogHandoff('VSA')).toBe(true));
  it('Lead VSA can log handoff', () => expect(canLogHandoff('Lead VSA')).toBe(true));
  it('Branch Manager can log handoff', () => expect(canLogHandoff('Branch Manager')).toBe(true));
  it('CSR cannot log handoff', () => expect(canLogHandoff('CSR')).toBe(false));
  it('Driver cannot log handoff', () => expect(canLogHandoff('Driver')).toBe(false));
});

describe('canVsaClear', () => {
  it('VSA can clear smoke-vape', () => expect(canVsaClear('smoke-vape')).toBe(true));
  it('VSA can clear too-dirty', () => expect(canVsaClear('too-dirty')).toBe(true));
  it('VSA cannot clear pet-hair', () => expect(canVsaClear('pet-hair')).toBe(false));
});

describe('isFullDayShift', () => {
  it('day-off is full day', () => expect(isFullDayShift('day-off')).toBe(true));
  it('pto is full day', () => expect(isFullDayShift('pto')).toBe(true));
  it('sick is full day', () => expect(isFullDayShift('sick')).toBe(true));
  it('opening is not full day', () => expect(isFullDayShift('opening')).toBe(false));
  it('mid is not full day', () => expect(isFullDayShift('mid')).toBe(false));
  it('closing is not full day', () => expect(isFullDayShift('closing')).toBe(false));
});
