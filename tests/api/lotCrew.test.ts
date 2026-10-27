// Lot Lookout crew rules (api/_lib/lotCrew.ts). ⭐ Since 2026-10-24 the crew line IS the schedule. Aaron: *"So who's on
// just shows who's scheduled (regardless if I've marked present or not)"*; sick and no-shows drop off the count.
// docs/ticket-crew-line-is-the-schedule.md.
import { describe, it, expect } from 'vitest';
import { crewOf, crewRoleOf, crewSummary, winnipegInstant, type RosterRow } from '../../api/_lib/lotCrew';

const DAY = '2026-10-15';
const at = (hhmm: string, day = DAY) => winnipegInstant(day, hhmm);
// NOT marked present by default: present no longer matters, and these rows prove it.
const row = (userId: string, name: string, profileRole: string, start: string | null, end: string | null, shiftType = 'opening', attendance: string | null = null): RosterRow =>
  ({ userId, name, profileRole, shiftType, start, end, attendance });

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

describe('crewRoleOf', () => {
  it('VSAs and the Lead VSA are VSAs; drivers drive; nobody else is crew', () => {
    expect(crewRoleOf('VSA')).toBe('vsa');
    expect(crewRoleOf('Lead VSA')).toBe('vsa');
    expect(crewRoleOf('Driver')).toBe('driver');
    for (const r of ['CSR', 'HIR', 'GM', null]) expect(crewRoleOf(r)).toBeNull();
  });
});

describe('who is on = who is scheduled now', () => {
  it('⭐ nobody marked present, and everyone in their window still counts', () => {
    const s = crewSummary(crewOf(roster, DAY, at('11:00')));
    expect(s.vsa).toEqual({ on: 2, out: 0 });     // Aaron, Moaz (Khaiat starts 14:30)
    expect(s.driver).toEqual({ on: 3, out: 0 });  // Larry C, Rey, Larry J
  });

  it('marking present changes nothing', () => {
    const marked = roster.map(r => ({ ...r, attendance: 'present' }));
    expect(crewSummary(crewOf(marked, DAY, at('11:00')))).toEqual(crewSummary(crewOf(roster, DAY, at('11:00'))));
  });

  it('not in yet, or gone home, is not on', () => {
    const early = crewSummary(crewOf(roster, DAY, at('09:30')));
    expect(early.driver.on).toBe(2); // Larry J starts 10:00
    const late = crewSummary(crewOf(roster, DAY, at('16:00')));
    expect(late.vsa.on).toBe(1); // only Khaiat
  });

  it('day-off is not today\'s crew; CSRs and HIRs are never crew', () => {
    const names = crewOf(roster, DAY, at('10:00')).map(m => m.name);
    expect(names).not.toContain('Geoff N.');
    expect(names).not.toContain('Rena');
  });

  it('⭐ sick on the schedule, or a no-show, is OUT: off the on count, said as out, never with a reason', () => {
    const r = [...roster, row('ray', 'Ray T.', 'VSA', null, null, 'sick'), row('tom', 'Tomek', 'VSA', '06:45:00', '15:15:00', 'opening', 'absent')];
    const members = crewOf(r, DAY, at('10:00'));
    expect(members.find(m => m.name === 'Ray T.')).toMatchObject({ out: true, onNow: false });
    expect(members.find(m => m.name === 'Tomek')).toMatchObject({ out: true, onNow: false });
    expect(crewSummary(members).vsa).toEqual({ on: 2, out: 2 });
  });

  it('a closing shift past midnight still counts at 00:30', () => {
    const r = [row('ray', 'Ray T.', 'VSA', '16:30:00', '01:00:00', 'closing')];
    expect(crewOf(r, DAY, at('00:30', '2026-10-16'))[0].onNow).toBe(true);
    expect(crewOf(r, DAY, at('01:30', '2026-10-16'))[0].onNow).toBe(false);
  });
});

// ⭐ Aaron, 2026-10-15 21:17: *"i've logged my actual hours to extend my shift. so shouldn't i techinically be seen
// until 17:15"*. Staying late is just logging it.
describe('logged hours win (shifts.actual_*)', () => {
  const now = at('16:30');
  it('⭐ his overtime: scheduled to 15:15, logged to 17:15, still on at 16:30 with no tap', () => {
    const aaron = { ...row('aaron', 'Aaron S.', 'VSA', '06:45:00', '15:15:00'), actualStart: '06:45:00', actualEnd: '17:15:00' };
    expect(crewOf([aaron], DAY, now)[0]).toMatchObject({ onNow: true, phase: 'on', start: '06:45', end: '17:15' });
  });
  it('left early by the log: off the line at the logged end', () => {
    const r = { ...row('moaz', 'Moaz', 'VSA', '06:45:00', '18:00:00'), actualEnd: '16:00:00' };
    expect(crewOf([r], DAY, now)[0]).toMatchObject({ onNow: false, phase: 'done', end: '16:00' });
  });
  it('no log yet: the schedule stands', () => {
    expect(crewOf([row('rey', 'Rey', 'Driver', '09:00:00', '15:00:00', 'mid')], DAY, now)[0]).toMatchObject({ phase: 'done', end: '15:00' });
  });
});

// ⭐ Aaron, 2026-10-26: opened 06:45–15:15, went home, and came back 17:00–21:00 so Erick wasn't cleaning solo. The [+]
// block (migration 160) is logged hours too. docs/ticket-more-hours-reach-crew-and-my-day.md.
describe('more hours the same day ([+] blocks)', () => {
  const asked = { ...row('aaron', 'Aaron S.', 'VSA', '06:45:00', '15:15:00'), actualStart: '06:45:00', actualEnd: '15:15:00', extraBlocks: [{ start: '17:00', end: '21:00' }] };
  const at1 = (t: string) => crewOf([asked], DAY, at(t))[0];

  it('⭐ inside the block he is ON, and counted', () => {
    expect(at1('18:00')).toMatchObject({ onNow: true, phase: 'on', more: [{ start: '17:00', end: '21:00' }] });
    expect(crewSummary(crewOf([asked], DAY, at('18:00'))).vsa.on).toBe(1);
  });
  it('home between the two: not on, and coming back (later), so never folded away as finished', () => {
    expect(at1('16:00')).toMatchObject({ onNow: false, phase: 'later' });
  });
  it('after the last block: done', () => {
    expect(at1('21:30')).toMatchObject({ onNow: false, phase: 'done' });
  });
  it('a block past midnight belongs to that night', () => {
    const late = { ...asked, extraBlocks: [{ start: '23:00', end: '01:00' }] };
    expect(crewOf([late], DAY, at('00:30', '2026-10-16'))[0].onNow).toBe(true);
    const after = { ...asked, extraBlocks: [{ start: '00:30', end: '02:00' }] };
    expect(crewOf([after], DAY, at('01:00', '2026-10-16'))[0].onNow).toBe(true);
    expect(crewOf([after], DAY, at('16:00'))[0].phase).toBe('later');
  });
  it('a half-typed block counts nothing', () => {
    const half = { ...asked, extraBlocks: [{ start: '17:00', end: '' }] };
    expect(crewOf([half], DAY, at('18:00'))[0]).toMatchObject({ onNow: false, phase: 'done', more: [] });
  });
});

// Aaron, 2026-10-15 21:03: *"removing Larry C from being displayed as a driver. even though he's on the driver
// schedule, he's our in-house utility guy doing vehicle maintenence"* (migration 155).
describe('left off the crew line', () => {
  it('⭐ a left-off driver is not a member, so never counted', () => {
    const now = at('09:30');
    const kept = crewOf(roster, DAY, now, new Set(['larryc']));
    expect(kept.map(m => m.userId)).not.toContain('larryc');
    expect(crewSummary(kept).driver.on).toBe(crewSummary(crewOf(roster, DAY, now)).driver.on - 1);
  });
});
