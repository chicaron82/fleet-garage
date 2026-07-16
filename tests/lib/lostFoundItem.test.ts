import { describe, it, expect } from 'vitest';
import { buildLostFoundItemInput } from '../../src/lib/lostFoundItem';

const draft = {
  keyTagPhoto: null,
  itemPhoto: null,
  description: '',
  location: null,
  licensePlate: '',
  notes: '',
};

describe('buildLostFoundItemInput', () => {
  it('drops every empty field rather than writing blanks', () => {
    expect(buildLostFoundItemInput(draft)).toEqual({
      keyTagPhoto: undefined, itemPhoto: undefined, description: undefined,
      location: undefined, licensePlate: undefined, notes: undefined,
    });
  });

  it('trims text fields', () => {
    const out = buildLostFoundItemInput({ ...draft, description: '  black wallet  ', notes: ' back seat ', licensePlate: ' LUR318 ' });
    expect(out.description).toBe('black wallet');
    expect(out.notes).toBe('back seat');
    expect(out.licensePlate).toBe('LUR318');
  });

  it('whitespace-only is absent, not a blank string', () => {
    const out = buildLostFoundItemInput({ ...draft, description: '   ', licensePlate: '  ' });
    expect(out.description).toBeUndefined();
    expect(out.licensePlate).toBeUndefined();
  });

  it('passes photos + location through', () => {
    const out = buildLostFoundItemInput({
      ...draft, keyTagPhoto: 'data:tag', itemPhoto: 'data:item', location: 'back-seat', description: 'sunglasses',
    });
    expect(out).toEqual({
      keyTagPhoto: 'data:tag', itemPhoto: 'data:item', description: 'sunglasses',
      location: 'back-seat', licensePlate: undefined, notes: undefined,
    });
  });
});
