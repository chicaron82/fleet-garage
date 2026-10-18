// Lot Lookout crew rules (api/_lib/lotCrew.ts, migration 154). Aaron, 2026-10-15: *"Example myself and Moaz are on and
// I just send Moaz. The display would show just one active cleaner and the other running ... At one point I had 3,
// and two were pulled to move cars to auction. So I only had 1 moving cars to the airport"*.
import { describe, it, expect } from 'vitest';
import { crewOf, crewRoleOf, crewSummary, stateFits, winnipegInstant, type CrewMark, type RosterRow } from '../../api/_lib/lotCrew';

const DAY = '2026-10-15';
const at = (hhmm: string, day = DAY) => winnipegInstant(day, hhmm);
// Marked PRESENT unless a test says otherwise: since 2026-10-18 an unconfirmed person is "not marked yet", and these
// scenarios (his own examples) are about people already working.
const row = (userId: string, name: string, profileRole: string, start: string | null, end: string | null, shiftType = 'opening', attendance: string | null = 'present'): RosterRow =>
  ({ userId, name, profileRole, shiftType, start, end, attendance });
const mark = (userId: string, state: CrewMark['state'], when: string, day = DAY): CrewMark => ({ userId, state, day, at: new Date(at(when)).toISOString() });

const roster: RosterRow[] = [
  row('aaron', 'Aaron S.', 'VSA', '06:45:00', '15:15:00'),
  row('moaz', 'Moaz', 'VSA', '06:45:00', '15:15:00'),
  row('khaiat', 'Khaiat', 'VSA', '14:30:00', '23:00:00', 'closing'),
  row('geoff', 'Geoff N.', 'Lead VSA', null, null, 'day-off'),
  row('larryc', 'Larry C', 'Driver', '07:00:00', '15:30:00'),
  row('rey', 'Rey', 'Driver', '09:00:00', '15:00:00', 'mid'),
  row('larryj', 'Larry J', 'Driver', '10:00:00', '18:30:00', 'mid'),
  row('rena', 'Rena', 'CSR', '06:30:00', '15:00:00'),
];

describe('winnipegInstant', () => {
  it('reads a Winnipeg wall clock through both sides of daylight saving', () => {
    expect(new Date(winnipegInstant('2026-10-15', '14:30:00')).toISOString()).toBe('2026-10-15T19:30:00.000Z'); // CDT
    expect(new Date(winnipegInstant('2026-12-15', '14:30:00')).toISOString()).toBe('2026-12-15T20:30:00.000Z'); // CST
  });
});

describe('crewRoleOf / stateFits', () => {
  it('VSAs and the Lead VSA clean; drivers drive; nobody else is crew', () => {
    expect(crewRoleOf('VSA')).toBe('vsa');
    expect(crewRoleOf('Lead VSA')).toBe('vsa');
    expect(crewRoleOf('Driver')).toBe('driver');
    for (const r of ['CSR', 'HIR', 'GM', null]) expect(crewRoleOf(r)).toBeNull();
  });
  it('a VSA cannot be "to the airport", a driver cannot be "cleaning"', () => {
    expect(stateFits('vsa', 'moving')).toBe(true);
    expect(stateFits('vsa', 'airport')).toBe(false);
    expect(stateFits('driver', 'cleaning')).toBe(false);
  });
});

describe('crewOf + crewSummary', () => {
  it('⭐ his example: he and Moaz on, he sends Moaz — one cleaning, one moving cars', () => {
    const members = crewOf(roster, [mark('moaz', 'moving', '11:00')], DAY, at('11:05'));
    expect(crewSummary(members).vsa).toEqual({ cleaning: 1, moving: 1, out: 0, unmarked: 0 });
  });

  it('⭐ his drivers today: three on, two pulled to the auction run — one to the airport', () => {
    const members = crewOf(roster, [mark('larryc', 'other', '11:00'), mark('rey', 'other', '11:00')], DAY, at('11:05'));
    expect(crewSummary(members).driver).toEqual({ airport: 1, other: 2, out: 0, unmarked: 0 });
  });

  it('counts only who is on right now: not in yet, or gone home, is not counted', () => {
    const s = crewSummary(crewOf(roster, [], DAY, at('09:30')));
    expect(s.vsa).toEqual({ cleaning: 2, moving: 0, out: 0, unmarked: 0 }); // Khaiat starts 14:30
    expect(s.driver).toEqual({ airport: 2, other: 0, out: 0, unmarked: 0 }); // Larry J starts 10:00
    const late = crewSummary(crewOf(roster, [], DAY, at('16:00')));
    expect(late.vsa).toEqual({ cleaning: 1, moving: 0, out: 0, unmarked: 0 }); // only Khaiat
  });

  it('day-off is not today\'s crew; CSRs and HIRs are never crew', () => {
    const names = crewOf(roster, [], DAY, at('10:00')).map(m => m.name);
    expect(names).not.toContain('Geoff N.');
    expect(names).not.toContain('Rena');
  });

  it('a sick shift, or absent, reads as plain out — never with a reason', () => {
    const r = [...roster, row('ray', 'Ray T.', 'VSA', null, null, 'sick'), row('tom', 'Tomek', 'VSA', '06:45:00', '15:15:00', 'opening', 'absent')];
    const members = crewOf(r, [], DAY, at('10:00'));
    expect(members.find(m => m.name === 'Ray T.')!.state).toBe('out');
    expect(crewSummary(members).vsa).toEqual({ cleaning: 2, moving: 0, out: 2, unmarked: 0 });
  });

  it('⭐ overtime: marked after the shift ended means he stayed, so he counts', () => {
    const before = crewOf(roster, [], DAY, at('15:40')).find(m => m.userId === 'aaron')!;
    expect(before).toMatchObject({ onNow: false, phase: 'done' });
    const stayed = crewOf(roster, [mark('aaron', 'cleaning', '15:35')], DAY, at('15:40')).find(m => m.userId === 'aaron')!;
    expect(stayed).toMatchObject({ onNow: true, phase: 'on', state: 'cleaning' });
  });

  it('a pull marked during the shift does not keep someone counted after they go home', () => {
    const m = crewOf(roster, [mark('moaz', 'moving', '11:00')], DAY, at('16:00')).find(x => x.userId === 'moaz')!;
    expect(m.onNow).toBe(false);
  });

  it('a closing shift past midnight still counts at 00:30', () => {
    const r = [row('ray', 'Ray T.', 'VSA', '16:30:00', '01:00:00', 'closing')];
    expect(crewOf(r, [], DAY, at('00:30', '2026-10-16'))[0].onNow).toBe(true);
    expect(crewOf(r, [], DAY, at('01:30', '2026-10-16'))[0].onNow).toBe(false);
  });

  it('⚠️ yesterday\'s mark, or one that does not fit the role, is ignored', () => {
    const members = crewOf(roster, [mark('moaz', 'moving', '11:00', '2026-10-14'), mark('aaron', 'airport', '11:00')], DAY, at('11:05'));
    expect(members.find(m => m.userId === 'moaz')!.state).toBe('cleaning');
    expect(members.find(m => m.userId === 'aaron')!.state).toBe('cleaning');
  });
});

// ⭐ Aaron, 2026-10-15 21:17: *"i've logged my actual hours to extend my shift. so shouldn't i techinically be seen
// until 17:15"*. He logged 06:45–17:15 at 15:41; the crew line only read the schedule and called him done at 15:15.
describe('logged hours win (shifts.actual_*)', () => {
  const now = at('16:30');
  it('⭐ his overtime: scheduled to 15:15, logged to 17:15, still cleaning at 16:30 with no tap', () => {
    const aaron = { ...row('aaron', 'Aaron S.', 'VSA', '06:45:00', '15:15:00'), actualStart: '06:45:00', actualEnd: '17:15:00' };
    const [m] = crewOf([aaron], [], DAY, now);
    expect(m).toMatchObject({ onNow: true, phase: 'on', state: 'cleaning', start: '06:45', end: '17:15' });
  });
  it('left early by the log: off the line at the logged end', () => {
    const r = { ...row('moaz', 'Moaz', 'VSA', '06:45:00', '18:00:00'), actualEnd: '16:00:00' };
    expect(crewOf([r], [], DAY, now)[0]).toMatchObject({ onNow: false, phase: 'done', end: '16:00' });
  });
  it('no log yet: the schedule stands', () => {
    expect(crewOf([row('rey', 'Rey', 'Driver', '09:00:00', '15:00:00', 'mid')], [], DAY, now)[0]).toMatchObject({ phase: 'done', end: '15:00' });
  });
});

// Aaron, 2026-10-15 21:03: *"removing Larry C from being displayed as a driver. even though he's on the driver
// schedule, he's our in-house utility guy doing vehicle maintenence"* (migration 155).
describe('left off the crew line', () => {
  it('⭐ a left-off driver is not a member, so never counted to the airport', () => {
    const now = at('09:30');
    const kept = crewOf(roster, [], DAY, now, new Set(['larryc']));
    expect(kept.map(m => m.userId)).not.toContain('larryc');
    expect(crewSummary(kept).driver.airport).toBe(crewSummary(crewOf(roster, [], DAY, now)).driver.airport - 1);
  });
});

// ⭐ 2026-10-18, his "triple yes": the crew line waits for present, so it agrees with My Day's box.
describe('confirmed — the crew line waits for present', () => {
  const r = [row('moaz', 'Moaz', 'VSA', '06:45:00', '15:15:00', 'opening', null), row('erick', 'Erick', 'VSA', '06:45:00', '15:15:00', 'opening', 'present')];
  it('⭐ on now but not marked present: counted as "not marked yet", never assumed cleaning', () => {
    const members = crewOf(r, [], DAY, at('10:00'));
    expect(members.find(m => m.userId === 'moaz')).toMatchObject({ confirmed: false, onNow: true });
    expect(crewSummary(members).vsa).toEqual({ cleaning: 1, moving: 0, out: 0, unmarked: 1 });
  });
  it('a hand mark confirms them; so does a no-show', () => {
    expect(crewOf(r, [mark('moaz', 'moving', '09:00')], DAY, at('10:00')).find(m => m.userId === 'moaz')!.confirmed).toBe(true);
    const absent = [row('moaz', 'Moaz', 'VSA', '06:45:00', '15:15:00', 'opening', 'absent')];
    expect(crewSummary(crewOf(absent, [], DAY, at('10:00'))).vsa).toEqual({ cleaning: 0, moving: 0, out: 1, unmarked: 0 });
  });
});
