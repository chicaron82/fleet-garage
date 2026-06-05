import { describe, it, expect } from 'vitest';
import { buildPtoRequest, ptoTaken } from '../../src/lib/ptoRequest';

describe('buildPtoRequest', () => {
  it('lists the requested days and the post-request balance', () => {
    const msg = buildPtoRequest('Aaron Sauddin', ['2026-06-09', '2026-06-10'], 13, 3);
    expect(msg).toContain('PTO Request — Aaron Sauddin');
    expect(msg).toContain('2 days requested.');
    // used 3 = 1 taken + 2 requested → balance shows days actually taken
    expect(msg).toContain('Balance: 1 of 13 used · 12 remaining.');
    expect(msg).toContain('Please confirm approval');
    // one bullet line per requested day
    expect(msg.split('\n').filter(l => l.trim().startsWith('•')).length).toBe(2);
  });

  it('uses the singular for a single day', () => {
    expect(buildPtoRequest('A', ['2026-06-09'], 13, 1)).toContain('1 day requested.');
  });

  it('never shows a negative remaining', () => {
    expect(buildPtoRequest('A', ['2026-06-09'], 13, 20)).toContain('0 remaining.');
  });

  it('handles the empty case', () => {
    expect(buildPtoRequest('A', [], 13, 0)).toContain('No upcoming PTO days entered.');
  });

  it('omits the approved section when there are no approved days', () => {
    const msg = buildPtoRequest('A', ['2026-06-09'], 13, 1);
    expect(msg).not.toContain('Already approved');
  });

  it('lists already-approved days in their own section so the balance reconciles', () => {
    const msg = buildPtoRequest('Aaron', ['2026-06-09', '2026-06-10'], 15, 15, ['2026-07-01']);
    expect(msg).toContain('2 days requested.');
    expect(msg).toContain('Already approved this year:');
    expect(msg).toContain('1 day already approved.');
    // 15 entered = 12 taken + 2 requested + 1 approved → 12 taken, 3 left (= 2 + 1)
    expect(msg).toContain('Balance: 12 of 15 used · 3 remaining.');
    // pending bullets + approved bullets = 3 total
    expect(msg.split('\n').filter(l => l.trim().startsWith('•')).length).toBe(3);
  });

  it('annotates stat requested days with name + optional alternate, leaves others untouched', () => {
    const statInfo = {
      '2026-07-01': { name: 'Canada Day', alternate: '2026-07-02' },
      '2026-08-03': { name: 'Civic Holiday' }, // no alternate picked
    };
    const msg = buildPtoRequest('A', ['2026-07-01', '2026-08-03', '2026-09-04'], 15, 5, [], statInfo);
    const line = (needle: string) => msg.split('\n').find(l => l.includes(needle))!;
    // stat with alternate
    expect(line('Jul 1')).toContain('(Canada Day — stat)');
    expect(line('Jul 1')).toContain('alternate:');
    expect(line('Jul 1')).toContain('Jul 2, 2026');
    // stat without alternate — name only, no alternate clause
    expect(line('Aug 3')).toContain('(Civic Holiday — stat)');
    expect(line('Aug 3')).not.toContain('alternate:');
    // non-stat day is untouched
    expect(line('Sep 4')).not.toContain('stat');
  });

  it('reconciles the real PDF case: 2 taken, 13 left = 10 requested + 3 approved', () => {
    const requested = ['2026-07-31', '2026-08-06', '2026-08-07', '2026-08-10', '2026-09-04',
                       '2026-09-07', '2026-09-08', '2026-10-16', '2026-10-19', '2026-11-13'];
    const approved  = ['2026-06-29', '2026-06-30', '2026-07-02'];
    const msg = buildPtoRequest('Aaron S.', requested, 15, 15, approved);
    expect(msg).toContain('10 days requested.');
    expect(msg).toContain('3 days already approved.');
    expect(msg).toContain('Balance: 2 of 15 used · 13 remaining.');
  });
});

describe('ptoTaken', () => {
  it('subtracts the upcoming requested + approved days from the total entered', () => {
    expect(ptoTaken(15, 10, 3)).toBe(2);   // Aaron's PDF: 15 entered, 13 upcoming → 2 taken
    expect(ptoTaken(3, 2, 0)).toBe(1);
  });
  it('never goes negative', () => {
    expect(ptoTaken(2, 5, 0)).toBe(0);
  });
  it('equals the total when nothing is upcoming', () => {
    expect(ptoTaken(4, 0, 0)).toBe(4);
  });

  it('renders an approved-only summary (no pending) without asking for approval', () => {
    const msg = buildPtoRequest('A', [], 15, 15, ['2026-07-01', '2026-07-02']);
    expect(msg).not.toContain('No upcoming PTO days entered.');
    expect(msg).toContain('2 days already approved.');
    expect(msg).not.toContain('requested.');
    expect(msg).not.toContain('Please confirm approval');
  });
});
