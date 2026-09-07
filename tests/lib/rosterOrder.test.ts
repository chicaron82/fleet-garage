/**
 * ⭐⭐⭐ THE SCHEDULE ROSTER HAS AN ORDER NOW — and the reason is a misread shift, not tidiness.
 *
 * Aaron, 2026-09-06: *"when i looked at tomorrow's schedule and saw only erick closing by himself i
 * had to question it, it wasn't until i scrolled further after the blank driver block that i saw the
 * other two VSA listed."*
 */
import { describe, expect, it } from 'vitest';
import { orderRoster, rosterRank } from '../../src/lib/rosterOrder';
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
