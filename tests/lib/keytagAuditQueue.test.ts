import { describe, it, expect } from 'vitest';
import {
  AUDIT_FIELDS,
  AUDIT_FIELD_LABELS,
  isBlankField,
  missingTagFields,
  isAuditable,
  buildAuditQueue,
  retakeWatchlist,
  auditQueueStats,
  type AuditableVehicle,
} from '../../src/lib/keytagAuditQueue';

/** A fully-known, already-audited car. Each test overrides only what it is about. */
function car(over: Partial<AuditableVehicle> = {}): AuditableVehicle {
  return {
    id: over.id ?? 'v1',
    licensePlate: 'LUR202',
    keytagPhotoUrl: 'https://example.test/tag.jpg',
    keytagAuditedAt: null,
    keytagAuditResult: null,
    owningArea: '8199',
    rentalClass: 'Q4',
    classCode: 'CCVL',
    unitNumber: '5420427',
    vinLast9: 'ABC123456',
    ...over,
  };
}

describe('isBlankField', () => {
  it('treats null, undefined and whitespace as blank', () => {
    expect(isBlankField(null)).toBe(true);
    expect(isBlankField(undefined)).toBe(true);
    expect(isBlankField('')).toBe(true);
    expect(isBlankField('   ')).toBe(true);
  });

  it('treats a real value as present', () => {
    expect(isBlankField('8199')).toBe(false);
    expect(isBlankField('0')).toBe(false);
  });
});

describe('AUDIT_FIELDS', () => {
  it('covers exactly what is printed on a tag — no key count, no plate', () => {
    expect(AUDIT_FIELDS).toEqual(['owningArea', 'rentalClass', 'classCode', 'unitNumber', 'vinLast9']);
  });

  it('has a label for every field, so a new field cannot ship unlabelled', () => {
    for (const f of AUDIT_FIELDS) {
      expect(AUDIT_FIELD_LABELS[f], `missing label for ${f}`).toBeTruthy();
    }
    expect(Object.keys(AUDIT_FIELD_LABELS)).toHaveLength(AUDIT_FIELDS.length);
  });
});

describe('missingTagFields', () => {
  it('is empty when the record already holds every tag field', () => {
    expect(missingTagFields(car())).toEqual([]);
  });

  it('reports the blanks in tag reading order, not the order they were nulled', () => {
    const v = car({ vinLast9: null, owningArea: null, classCode: '  ' });
    expect(missingTagFields(v)).toEqual(['owningArea', 'classCode', 'vinLast9']);
  });
});

describe('isAuditable', () => {
  it('queues a car with a photo that nobody has read', () => {
    expect(isAuditable(car())).toBe(true);
  });

  it('excludes a car with no stored photo — there is nothing to look at', () => {
    expect(isAuditable(car({ keytagPhotoUrl: null }))).toBe(false);
    expect(isAuditable(car({ keytagPhotoUrl: '  ' }))).toBe(false);
  });

  it('excludes a car already audited, so a resumed pass never repeats one', () => {
    expect(isAuditable(car({ keytagAuditedAt: '2026-08-28T18:00:00Z' }))).toBe(false);
  });

  it('excludes a car flagged unreadable — it is on the retake list, not the queue', () => {
    const flagged = car({ keytagAuditedAt: '2026-08-28T18:00:00Z', keytagAuditResult: 'unreadable' });
    expect(isAuditable(flagged)).toBe(false);
  });
});

describe('buildAuditQueue', () => {
  it('orders most-missing first', () => {
    const q = buildAuditQueue([
      car({ id: 'one-gap', licensePlate: 'AAA111', vinLast9: null }),
      car({ id: 'three-gaps', licensePlate: 'BBB222', vinLast9: null, owningArea: null, classCode: null }),
      car({ id: 'two-gaps', licensePlate: 'CCC333', vinLast9: null, owningArea: null }),
    ]);
    expect(q.map(c => c.vehicle.id)).toEqual(['three-gaps', 'two-gaps', 'one-gap']);
    expect(q[0].missing).toEqual(['owningArea', 'classCode', 'vinLast9']);
  });

  it('keeps a fully-known car in the queue, at the back — verifying is a write, not a no-op', () => {
    const q = buildAuditQueue([
      car({ id: 'complete', licensePlate: 'AAA111' }),
      car({ id: 'one-gap', licensePlate: 'ZZZ999', vinLast9: null }),
    ]);
    expect(q.map(c => c.vehicle.id)).toEqual(['one-gap', 'complete']);
    expect(q[1].missing).toEqual([]);
  });

  it('breaks ties on plate so the order is stable across reloads', () => {
    const q = buildAuditQueue([
      car({ id: 'z', licensePlate: 'ZZZ999', vinLast9: null }),
      car({ id: 'a', licensePlate: 'AAA111', vinLast9: null }),
      car({ id: 'm', licensePlate: 'MMM555', vinLast9: null }),
    ]);
    expect(q.map(c => c.vehicle.licensePlate)).toEqual(['AAA111', 'MMM555', 'ZZZ999']);
  });

  it('leaves out the photo-less backlog entirely', () => {
    const q = buildAuditQueue([
      car({ id: 'no-photo', keytagPhotoUrl: null, owningArea: null, vinLast9: null }),
      car({ id: 'has-photo', vinLast9: null }),
    ]);
    expect(q.map(c => c.vehicle.id)).toEqual(['has-photo']);
  });

  it('returns an empty queue rather than throwing on an empty fleet', () => {
    expect(buildAuditQueue([])).toEqual([]);
  });
});

describe('retakeWatchlist', () => {
  it('is exactly the cars flagged unreadable, plate-sorted', () => {
    const list = retakeWatchlist([
      car({ id: 'ok' }),
      car({ id: 'bad-2', licensePlate: 'ZZZ999', keytagAuditResult: 'unreadable' }),
      car({ id: 'verified', keytagAuditResult: 'verified' }),
      car({ id: 'bad-1', licensePlate: 'AAA111', keytagAuditResult: 'unreadable' }),
    ]);
    expect(list.map(v => v.id)).toEqual(['bad-1', 'bad-2']);
  });

  it('is empty when nothing has defeated him yet', () => {
    expect(retakeWatchlist([car(), car({ keytagAuditResult: 'verified' })])).toEqual([]);
  });
});

describe('auditQueueStats', () => {
  it('sorts a mixed fleet into the four states and counts the gaps left to recover', () => {
    const stats = auditQueueStats([
      car({ id: 'pending-2', vinLast9: null, owningArea: null }),
      car({ id: 'pending-1', classCode: null }),
      car({ id: 'verified', keytagAuditedAt: '2026-08-28T18:00:00Z', keytagAuditResult: 'verified' }),
      car({ id: 'unreadable', keytagAuditedAt: '2026-08-28T18:00:00Z', keytagAuditResult: 'unreadable' }),
      car({ id: 'no-photo', keytagPhotoUrl: null }),
    ]);
    expect(stats).toEqual({ pending: 2, verified: 1, unreadable: 1, noPhoto: 1, gaps: 3 });
  });

  it('counts an unreadable car as unreadable even though it is also stamped audited', () => {
    const stats = auditQueueStats([
      car({ keytagAuditedAt: '2026-08-28T18:00:00Z', keytagAuditResult: 'unreadable' }),
    ]);
    expect(stats.unreadable).toBe(1);
    expect(stats.verified).toBe(0);
  });

  it('never counts a photo-less car as pending work', () => {
    const stats = auditQueueStats([car({ keytagPhotoUrl: null, owningArea: null, vinLast9: null })]);
    expect(stats).toEqual({ pending: 0, verified: 0, unreadable: 0, noPhoto: 1, gaps: 0 });
  });
});
