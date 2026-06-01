import { describe, it, expect } from 'vitest';
import { buildPtoRequest } from '../../src/lib/ptoRequest';

describe('buildPtoRequest', () => {
  it('lists the requested days and the post-request balance', () => {
    const msg = buildPtoRequest('Aaron Sauddin', ['2026-06-09', '2026-06-10'], 13, 3);
    expect(msg).toContain('PTO Request — Aaron Sauddin');
    expect(msg).toContain('2 days requested.');
    expect(msg).toContain('Balance: 3 of 13 used · 10 remaining.');
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
    expect(msg).toContain('Balance: 15 of 15 used · 0 remaining.');
    // pending bullets + approved bullets = 3 total
    expect(msg.split('\n').filter(l => l.trim().startsWith('•')).length).toBe(3);
  });

  it('renders an approved-only summary (no pending) without asking for approval', () => {
    const msg = buildPtoRequest('A', [], 15, 15, ['2026-07-01', '2026-07-02']);
    expect(msg).not.toContain('No upcoming PTO days entered.');
    expect(msg).toContain('2 days already approved.');
    expect(msg).not.toContain('requested.');
    expect(msg).not.toContain('Please confirm approval');
  });
});
