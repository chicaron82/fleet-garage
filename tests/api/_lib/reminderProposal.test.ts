import { describe, it, expect } from 'vitest';
import { buildReminderProposal, describeReminderProposal } from '../../../api/_lib/reminderProposal';

describe('buildReminderProposal', () => {
  it('builds a reminder carrying the text under the reminder kind', () => {
    expect(buildReminderProposal('pack the airport')).toEqual({
      kind: 'reminder',
      text: 'pack the airport',
    });
  });

  it('trims surrounding whitespace so the whiteboard note lands clean', () => {
    expect(buildReminderProposal('  restock the key box \n').text).toBe('restock the key box');
  });
});

describe('describeReminderProposal', () => {
  it('echoes the reminder text in next-shift phrasing', () => {
    expect(describeReminderProposal({ kind: 'reminder', text: 'pack the airport' })).toBe(
      'leave a next-shift reminder: pack the airport',
    );
  });
});
