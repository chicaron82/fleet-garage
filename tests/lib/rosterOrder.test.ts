/**
 * ⭐⭐⭐ THE SCHEDULE ROSTER HAS AN ORDER NOW — and the reason is a misread shift, not tidiness.
 *
 * Aaron, 2026-09-06: *"when i looked at tomorrow's schedule and saw only erick closing by himself i
 * had to question it, it wasn't until i scrolled further after the blank driver block that i saw the
 * other two VSA listed."*
 */
import { describe, expect, it } from 'vitest';
import { orderRoster, rosterRank, driverBlockUnloaded } from '../../src/lib/rosterOrder';
import type { UserRole } from '../../src/types';

const m = (id: string, name: string, role: UserRole) => ({ id, name, role });

// The live shape of the bug: Supabase order, VSAs on both sides of the driver block.
const asItCame = [
  m('aaron', 'Aaron', 'VSA'), m('geoff', 'Geoff', 'Lead VSA'), m('ray', 'Ray', 'VSA'),
  m('erick', 'Erick', 'VSA'),
  m('eugene', 'Eugene', 'Driver'), m('robert', 'Robert', 'Driver'), m('carlos', 'Carlos', 'Driver'),
  m('parth', 'Parth', 'VSA'), m('khaiat', 'Khaiat', 'VSA'),
];

describe('roster order', () => {
  it('⭐⭐⭐ no VSA is left below the drivers — the whole bug, in one assertion', () => {
    const ordered = orderRoster(asItCame, 'aaron');
    const firstDriver = ordered.findIndex(u => u.role === 'Driver');
    const lastFloor = ordered.map(u => u.role).lastIndexOf('VSA');
    expect(lastFloor).toBeLessThan(firstDriver);
  });

  it('keeps him pinned first — the one row he finds by position, not by name', () => {
    expect(orderRoster(asItCame, 'aaron')[0]!.id).toBe('aaron');
    // …and without a self id it is purely grouped, no accidental favourite
    expect(orderRoster(asItCame)[0]!.role).not.toBe('Driver');
  });

  it('groups floor → counter → drivers, the order the filter bar above it already uses', () => {
    const roles = orderRoster([
      m('d', 'D', 'Driver'), m('c', 'C', 'CSR'), m('v', 'V', 'VSA'), m('h', 'H', 'HIR'),
    ]).map(u => u.role);
    expect(roles).toEqual(['VSA', 'CSR', 'HIR', 'Driver']);
  });

  it('sorts alphabetically inside a group so a name is findable', () => {
    const names = orderRoster([m('c', 'Carlos', 'Driver'), m('a', 'Aaron2', 'Driver'), m('b', 'Bob', 'Driver')])
      .map(u => u.name);
    expect(names).toEqual(['Aaron2', 'Bob', 'Carlos']);
  });

  it('⚠️ a role outside the groups still sorts — after the crew, never interleaved', () => {
    // Managers are deliberately absent from SCHEDULE_GROUPS. Unranked would mean "wherever Supabase
    // put you", which is exactly the defect.
    expect(rosterRank('Branch Manager')).toBeGreaterThan(rosterRank('Driver'));
    const ordered = orderRoster([m('bm', 'Boss', 'Branch Manager'), m('d', 'Dee', 'Driver')]);
    expect(ordered.map(u => u.role)).toEqual(['Driver', 'Branch Manager']);
  });
});

describe('a blank driver block is a STATE, not an absence', () => {
  const drivers = [m('d1', 'Dee', 'Driver'), m('d2', 'Eve', 'Driver')];
  const floor = [m('a', 'Aaron', 'VSA')];

  it('⭐⭐ blank across every driver → FG has not been given the week', () => {
    expect(driverBlockUnloaded([...floor, ...drivers], () => false)).toBe(true);
  });

  it('one driver with one shift is enough — the week IS loaded, they are just off', () => {
    expect(driverBlockUnloaded([...floor, ...drivers], u => u.id === 'd1')).toBe(false);
  });

  it('⚠️ no drivers on screen → no claim at all (the Floor-only filter must stay silent)', () => {
    expect(driverBlockUnloaded(floor, () => false)).toBe(false);
  });

  it('an empty FLOOR says nothing about drivers — the notice is driver-specific on purpose', () => {
    // VSAs come as a four-week block, so a blank floor week means something different and is not
    // this function's business.
    expect(driverBlockUnloaded([m('v', 'V', 'VSA')], () => false)).toBe(false);
  });
});

/**
 * ⭐⭐ THE SHADED ROW WAS A FULL STOP (Aaron, 2026-09-12, after closing a 66-car night):
 *
 *   *"having larry (utility) shaded i accidentally stopped reading and missed the second driver
 *    starting in the morning… can we have larry displayed first on the drivers so that his shaded
 *    schedule looks like the boundary that separates the VSA and drivers?"*
 *
 * ⚠️ Larry C sorted alphabetically, which put his slate band BETWEEN Krish and Larry J — mid-block,
 * where a shaded row reads as the end of the list. The data was all there; the ordering hid it.
 */
const u = (id: string, name: string, role: UserRole, utility = false) => ({ id, name, role, utility });

// Saturday 2026-09-12 as FG actually held it, drivers in the order that caused the miss.
const realSaturday = [
  u('geoff', 'Geoff N.', 'Lead VSA'), u('moaz', 'Moaz', 'VSA'),
  u('jose', 'Jose', 'Driver'), u('krish', 'Krish', 'Driver'),
  u('larryc', 'Larry C', 'Driver', true), u('larryj', 'Larry J', 'Driver'),
  u('reo', 'Reo', 'Driver'),
];

describe('the utility row is a boundary, not a terminator', () => {
  it('puts utility FIRST among the drivers', () => {
    const drivers = orderRoster(realSaturday).filter(x => x.role === 'Driver');
    expect(drivers[0]!.name).toBe('Larry C');
  });

  it('lands it exactly on the seam — last floor row, then the shaded row', () => {
    const ordered = orderRoster(realSaturday);
    const i = ordered.findIndex(x => x.utility);
    expect(ordered[i - 1]!.role).toBe('VSA');      // last of the floor block
    expect(ordered[i]!.name).toBe('Larry C');       // the divider itself
  });

  it('⚠️ no driver is left BELOW the shaded row unread — the two openers both sort after it', () => {
    const names = orderRoster(realSaturday).map(x => x.name);
    expect(names.indexOf('Larry C')).toBeLessThan(names.indexOf('Jose'));
    expect(names.indexOf('Larry C')).toBeLessThan(names.indexOf('Reo'));
  });

  it('keeps everyone else alphabetical inside the group', () => {
    const rest = orderRoster(realSaturday).filter(x => x.role === 'Driver' && !x.utility).map(x => x.name);
    expect(rest).toEqual(['Jose', 'Krish', 'Larry J', 'Reo']);
  });

  it('still pins self above even a utility row', () => {
    const ordered = orderRoster(realSaturday, 'larryj');
    expect(ordered[0]!.name).toBe('Larry J');
  });
});
