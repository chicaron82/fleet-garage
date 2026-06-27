import { describe, it, expect } from 'vitest';
import { moduleGreeting } from '../../src/lib/assistantGreeting';

describe('moduleGreeting', () => {
  it('greets by name with a leading, module-specific offer', () => {
    expect(moduleGreeting('lost-and-found', 'Aaron')).toBe(
      "Effie here, Aaron — you're in Lost & Found — logging something new?",
    );
    expect(moduleGreeting('my-shift', 'Aaron')).toContain("who you're closing with tonight");
    expect(moduleGreeting('schedule', 'Aaron')).toContain('Schedule');
  });

  it('falls back for an unknown module', () => {
    expect(moduleGreeting('something-new', 'Aaron')).toBe(
      'Effie here, Aaron — what can I help with? Try "anything on LFJ438?" or "who\'s closing with me tonight?"',
    );
  });

  it('handles a missing name', () => {
    expect(moduleGreeting('holds', '')).toBe("Effie here, there — you're on Holds — flag a vehicle, or check what's sitting on one?");
  });
});
