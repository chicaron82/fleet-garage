import { describe, it, expect } from 'vitest';
import { moduleGreeting } from '../../src/lib/assistantGreeting';

describe('moduleGreeting', () => {
  it('greets by name with a leading, module-specific offer', () => {
    expect(moduleGreeting('lost-and-found', 'Aaron')).toBe(
      "Hi Aaron — you're in Lost & Found. Are we logging a new item?",
    );
    expect(moduleGreeting('my-shift', 'Aaron')).toContain("who's closing with you tonight");
    expect(moduleGreeting('schedule', 'Aaron')).toContain('Schedule');
  });

  it('falls back for an unknown module', () => {
    expect(moduleGreeting('something-new', 'Aaron')).toBe(
      'Hi Aaron — what can I help with? Try "anything on LFJ438?" or "who\'s closing with me tonight?"',
    );
  });

  it('handles a missing name', () => {
    expect(moduleGreeting('holds', '')).toBe("Hi there — you're on Holds. Want to flag a vehicle, or check what's on one?");
  });
});
