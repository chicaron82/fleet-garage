import { describe, it, expect } from 'vitest';
import { attendanceForCrew, boxOf, crewWriteForAttendance, crewWriteForBox, hasBox, shiftsToMark } from '../../src/lib/rosterCrew';

describe('the box on My Day — his rulings, 2026-10-18', () => {
  it('only VSAs and drivers carry one', () => {
    expect(hasBox('vsa')).toBe(true);
    expect(hasBox('driver')).toBe(true);
    expect(hasBox('counter')).toBe(false);
    expect(hasBox('hir')).toBe(false);
  });
  it('⭐ empty until marked present ("stay empty until marked present")', () => {
    expect(boxOf('vsa', undefined, undefined)).toBe('off');
    expect(boxOf('vsa', 'absent', undefined)).toBe('off');
  });
  it('⭐ present ticks it by itself: they are on their usual job', () => {
    expect(boxOf('vsa', 'present', undefined)).toBe('on');
    expect(boxOf('driver', 'present', { state: 'airport', marked: false })).toBe('on');
  });
  it('present and pulled reads as pulled; only HIS mark pulls', () => {
    expect(boxOf('vsa', 'present', { state: 'moving', marked: true })).toBe('pulled');
    expect(boxOf('driver', 'present', { state: 'other', marked: true })).toBe('pulled');
  });
  it('untick writes the pulled state; tick again clears back to the default', () => {
    expect(crewWriteForBox('vsa', 'on')).toBe('moving');
    expect(crewWriteForBox('driver', 'on')).toBe('other');
    expect(crewWriteForBox('vsa', 'pulled')).toBe('clear');
    expect(crewWriteForBox('vsa', 'off')).toBeNull();
  });
  it('a name tap clears a mark so the attendance shows through (a pulled VSA marked no-show reads OUT, not moving)', () => {
    expect(crewWriteForAttendance('vsa', { state: 'moving', marked: true })).toBe('clear');
    expect(crewWriteForAttendance('vsa', { state: 'cleaning', marked: false })).toBeNull();
    expect(crewWriteForAttendance('counter', { state: 'moving', marked: true })).toBeNull();
  });
});

describe('round two (his "triple yes", 2026-10-18)', () => {
  it('⭐ present but the crew line has not answered: "unknown", never "on", and it writes nothing', () => {
    expect(boxOf('vsa', 'present', undefined, false)).toBe('unknown');
    expect(crewWriteForBox('vsa', 'unknown')).toBeNull();
  });
  it('a crew chip in Lot Lookout: a job is present, Out is a no-show', () => {
    expect(attendanceForCrew('moving')).toBe('present');
    expect(attendanceForCrew('clear')).toBe('present');
    expect(attendanceForCrew('out')).toBe('absent');
  });
  it("only today's working rows that are not already there get written", () => {
    const today = [
      { id: 's1', userId: 'u1', shiftType: 'opening' as const, attendance: undefined },
      { id: 's2', userId: 'u2', shiftType: 'mid' as const, attendance: 'present' as const },
      { id: 's3', userId: 'u3', shiftType: 'sick' as const, attendance: undefined },
      { id: 's4', userId: 'u9', shiftType: 'closing' as const, attendance: undefined },
    ];
    expect(shiftsToMark(today, ['u1', 'u2', 'u3'], 'present')).toEqual(['s1']);
  });
});
