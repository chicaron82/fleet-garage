import { describe, it, expect } from 'vitest';
import { buildEventProposal, describeEventProposal } from '../../../api/_lib/eventProposal';

describe('buildEventProposal', () => {
  it('builds a dated event carrying title, date, and time under the event kind', () => {
    expect(buildEventProposal('Staff BBQ', '2026-07-20', '12:30')).toEqual({
      kind: 'event',
      title: 'Staff BBQ',
      date: '2026-07-20',
      time: '12:30',
    });
  });

  it('trims surrounding whitespace so the chip title lands clean', () => {
    expect(buildEventProposal('  Staff BBQ \n', '2026-07-20', null).title).toBe('Staff BBQ');
  });

  it('coerces an absent time to null (an all-day note)', () => {
    expect(buildEventProposal('Payday', '2026-07-24', null).time).toBeNull();
  });

  it('coerces an empty or whitespace-only time to null, not an empty string', () => {
    // The one subtlety: `time?.trim() || null` — a blank time must read as all-day,
    // never as a '' that downstream formatting would render as "at ".
    expect(buildEventProposal('Payday', '2026-07-24', '').time).toBeNull();
    expect(buildEventProposal('Payday', '2026-07-24', '   ').time).toBeNull();
  });

  it('trims a padded but valid time to clean HH:MM', () => {
    // Pins the trim half of the same expression: without this, a refactor that
    // only null-checks (e.g. `!time || !time.trim() ? null : time`) passes the
    // suite while letting ' 12:30 ' through to render as "at  12:30 ".
    expect(buildEventProposal('Payday', '2026-07-24', ' 12:30 ').time).toBe('12:30');
  });
});

describe('describeEventProposal', () => {
  it('echoes a timed event with its date and time', () => {
    expect(
      describeEventProposal({ kind: 'event', title: 'Staff BBQ', date: '2026-07-20', time: '12:30' }),
    ).toBe('remember "Staff BBQ" on 2026-07-20 at 12:30');
  });

  it('drops the time clause for an all-day note', () => {
    expect(
      describeEventProposal({ kind: 'event', title: 'Payday', date: '2026-07-24', time: null }),
    ).toBe('remember "Payday" on 2026-07-24');
  });
});
