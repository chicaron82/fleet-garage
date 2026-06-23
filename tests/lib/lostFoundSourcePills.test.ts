import { describe, it, expect } from 'vitest';
import { appendSourceText, removeSourceText } from '../../src/lib/lostFoundSourcePills';

describe('appendSourceText', () => {
  it('sets text when notes are empty', () => {
    expect(appendSourceText('', 'Airport return')).toBe('Airport return');
  });
  it('appends with separator when notes already have content', () => {
    expect(appendSourceText('Blue bag', 'Airport return')).toBe('Blue bag · Airport return');
  });
  it('trims leading/trailing whitespace from current before appending', () => {
    expect(appendSourceText('  Blue bag  ', 'Erin St')).toBe('Blue bag · Erin St');
  });
});

describe('removeSourceText', () => {
  it('removes text that was the entire notes value', () => {
    expect(removeSourceText('Airport return', 'Airport return')).toBe('');
  });
  it('removes the separator + text suffix appended to existing notes', () => {
    expect(removeSourceText('Blue bag · Airport return', 'Airport return')).toBe('Blue bag');
  });
  it('leaves unrelated notes intact when removing suffix', () => {
    expect(removeSourceText('Found at gate · Erin St', 'Erin St')).toBe('Found at gate');
  });
  it('switching pills: remove old text first then caller appends new', () => {
    const after = removeSourceText('Blue bag · Airport return', 'Airport return');
    expect(appendSourceText(after, 'Erin St')).toBe('Blue bag · Erin St');
  });
  it('known edge: removes first occurrence when text appears in existing notes', () => {
    // If the user had typed "Airport return" before tapping the pill,
    // deselect strips the inline occurrence, not the appended one.
    // Documenting observed behaviour — acceptable for the L&F use case.
    const notes = 'Airport return found in car · Airport return';
    expect(removeSourceText(notes, 'Airport return')).toBe('Airport return found in car');
  });
});
