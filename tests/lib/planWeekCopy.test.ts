import { describe, it, expect } from 'vitest';
import { planWeekCopy, describeWeekCopy, shiftISODate, statDatesIn } from '../../src/lib/planWeekCopy';
import type { Shift } from '../../src/types';

type Src = Pick<Shift, 'userId' | 'date' | 'startTime' | 'endTime' | 'shiftType'>;
const shift = (userId: string, date: string, o: Partial<Src> = {}): Src =>
  ({ userId, date, startTime: '07:00', endTime: '15:30', shiftType: 'opening', ...o });

const noStats = () => false;

describe('planWeekCopy', () => {
  it('carries a week forward seven days', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24'), shift('u2', '2026-08-26')], [], 7, noStats);
    expect(p.creates.map(c => c.date)).toEqual(['2026-08-31', '2026-09-02']);
    expect(p.creates[0]).toMatchObject({ userId: 'u1', startTime: '07:00', endTime: '15:30', shiftType: 'opening' });
    expect(p.skips).toEqual([]);
  });

  it('carries a day-off as a day-off — an empty day is a decision, not an absence', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24', { shiftType: 'day-off', startTime: undefined, endTime: undefined })], [], 7, noStats);
    expect(p.creates[0]).toMatchObject({ shiftType: 'day-off', startTime: undefined, endTime: undefined });
  });

  // ⚠️⚠️ THE RULE THE WHOLE FEATURE RESTS ON. Aaron: *"as for if drivers have something off i can
  // still manually flip those."* That only works if a flip survives the next copy.
  it('⚠️ never overwrites a day that already has a row', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24')], [{ userId: 'u1', date: '2026-08-31' }], 7, noStats);
    expect(p.creates).toEqual([]);
    expect(p.skips).toEqual([{ userId: 'u1', date: '2026-08-31', reason: 'already scheduled' }]);
  });

  it('⚠️ is idempotent — the second run creates nothing', () => {
    const src = [shift('u1', '2026-08-24'), shift('u1', '2026-08-25')];
    const first = planWeekCopy(src, [], 7, noStats);
    const second = planWeekCopy(src, first.creates, 7, noStats);
    expect(first.creates).toHaveLength(2);
    expect(second.creates).toHaveLength(0);
    expect(second.skips).toHaveLength(2);
  });

  it('⚠️ a duplicated source row cannot become two target rows', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24'), shift('u1', '2026-08-24')], [], 7, noStats);
    expect(p.creates).toHaveLength(1);
    expect(p.skips).toHaveLength(1);
  });

  // ⚠️ These describe the week that HAPPENED. Copying `attendance` forward would invent an
  // observation of a week that has not occurred.
  it('⚠️ notes, actual hours, attendance and pto approval do NOT travel', () => {
    const rich = { ...shift('u1', '2026-08-24'), notes: 'covered for Ray', actualStartTime: '07:12',
                   actualEndTime: '15:41', attendance: 'present', ptoApproved: true } as Src;
    const [c] = planWeekCopy([rich], [], 7, noStats).creates;
    expect(Object.keys(c).sort()).toEqual(['date', 'endTime', 'isStat', 'shiftType', 'startTime', 'userId']);
  });
});

// ⚠️⚠️ THE SHARPEST EDGE, and it was live the week this shipped. Copy the Aug 31 week onto Sep 7 and
// Labour Day arrives flagged false, because the source Monday was not a stat. FG's own isStatDay
// knows only MB legislated stats, so it would not self-heal. On 2026-08-31 all 9 VSA rows for Sep 7
// were correctly flagged from the PDF import — a blind copy would have made the drivers the only
// people at that branch whose Labour Day did not know it was Labour Day.
describe('planWeekCopy — the stat flag', () => {
  const labourDay = (d: string) => d === '2026-09-07';

  it('⭐ re-derives the stat for the TARGET date, never the source', () => {
    const p = planWeekCopy([shift('u1', '2026-08-31')], [], 7, labourDay);
    expect(p.creates[0]).toMatchObject({ date: '2026-09-07', isStat: true });
  });

  it('⚠️ and clears it when the SOURCE was the stat and the target is not', () => {
    const p = planWeekCopy([shift('u1', '2026-09-07')], [], 7, labourDay);
    expect(p.creates[0]).toMatchObject({ date: '2026-09-14', isStat: false });
  });

  it('names the stat dates so the preview can show them', () => {
    const p = planWeekCopy([shift('u1', '2026-08-31'), shift('u2', '2026-09-01')], [], 7, labourDay);
    expect(statDatesIn(p)).toEqual(['2026-09-07']);
  });
});

describe('shiftISODate', () => {
  it('crosses a month boundary', () => {
    expect(shiftISODate('2026-08-31', 7)).toBe('2026-09-07');
  });
  // ⚠️ Noon UTC, so a DST shift cannot roll the day backwards — the bug that makes a Monday a Sunday.
  it('⚠️ survives the DST boundary', () => {
    expect(shiftISODate('2026-11-01', 7)).toBe('2026-11-08');
    expect(shiftISODate('2026-03-08', 7)).toBe('2026-03-15');
  });
  it('goes backwards too', () => {
    expect(shiftISODate('2026-09-07', -7)).toBe('2026-08-31');
  });
});

describe('describeWeekCopy', () => {
  it('says what it will do', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24')], [], 7, noStats);
    expect(describeWeekCopy(p)).toBe('Will add 1 shift.');
  });

  it('names the skips alongside', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24'), shift('u2', '2026-08-24')],
                           [{ userId: 'u1', date: '2026-08-31' }], 7, noStats);
    expect(describeWeekCopy(p)).toBe('Will add 1 shift · skipping 1 already scheduled.');
  });

  // ⚠️ THE NO-OP HAS TO SPEAK. After one copy every day is taken, so a second run does nothing —
  // correct, and indistinguishable from a broken button unless the preview says so first.
  it('⚠️ explains a run that would do nothing', () => {
    const p = planWeekCopy([shift('u1', '2026-08-24')], [{ userId: 'u1', date: '2026-08-31' }], 7, noStats);
    expect(describeWeekCopy(p)).toBe('Nothing to add — all 1 day already scheduled.');
  });

  it('and an empty source week', () => {
    expect(describeWeekCopy(planWeekCopy([], [], 7, noStats))).toBe('Nothing in the source week to copy.');
  });
});
