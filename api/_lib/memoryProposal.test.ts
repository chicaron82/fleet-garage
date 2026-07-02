import { describe, it, expect } from 'vitest';
import { buildMemoryProposal, describeMemoryProposal, MEMORY_MAX_LEN } from './memoryProposal';

describe('buildMemoryProposal', () => {
  it('builds a memory from usable content, collapsing whitespace', () => {
    expect(buildMemoryProposal({ content: '  Aaron   runs   mids  ' })).toEqual({
      kind: 'memory',
      content: 'Aaron runs mids',
    });
  });

  it('returns null for empty / whitespace / missing content (ask for specifics instead)', () => {
    expect(buildMemoryProposal({ content: '' })).toBeNull();
    expect(buildMemoryProposal({ content: '   ' })).toBeNull();
    expect(buildMemoryProposal({ content: null })).toBeNull();
    expect(buildMemoryProposal({})).toBeNull();
  });

  it('caps content at MEMORY_MAX_LEN — a fact, not an essay', () => {
    const long = 'x'.repeat(MEMORY_MAX_LEN + 50);
    const p = buildMemoryProposal({ content: long });
    expect(p?.content).toHaveLength(MEMORY_MAX_LEN);
  });
});

describe('describeMemoryProposal', () => {
  it('quotes the content and reads as drafted-not-saved', () => {
    const line = describeMemoryProposal({ kind: 'memory', content: 'prefers set schedules' });
    expect(line).toContain('"prefers set schedules"');
    expect(line.toLowerCase()).toContain('awaiting');
  });
});
