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
  auditWarnings,
  AUDIT_FIELD_HINTS,
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
    expect(stats).toEqual({ pending: 2, verified: 1, unreadable: 1, stale: 0, noPhoto: 1, gaps: 3 });
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
    expect(stats).toEqual({ pending: 0, verified: 0, unreadable: 0, stale: 0, noPhoto: 1, gaps: 0 });
  });
});

describe('auditWarnings — the wrong-box guard', () => {
  // Aaron, after putting E9 in the model-code box: *"having the word 'class' in two places is the
  // mistake! i read class and put E9 into the class code."* FG's columns were right; the SCREEN
  // made him disambiguate two things that share a word, in the one app whose whole thesis is
  // removing ambiguity.
  const CLASSES = new Set(['Q4', 'E9', 'P4', 'C', 'B', 'T', 'L2', 'E1', 'E6']);
  const CODES   = new Set(['CRVB', 'CTMY', 'C3UL', 'CK45', 'CX30']);
  const warn = (e: Parameters<typeof auditWarnings>[0]) => auditWarnings(e, CLASSES, CODES);

  it('⭐ names a rental class sitting in the model-code field — the mistake that happened', () => {
    const [w] = warn({ classCode: 'E9' });
    expect(w.field).toBe('classCode');
    expect(w.message).toMatch(/is a rental class/);
  });

  it('⭐ flags the mirror — a model code in the rental-class field', () => {
    const [w] = warn({ rentalClass: 'CRVB' });
    expect(w.field).toBe('rentalClass');
    expect(w.message).toMatch(/is a model code/);
  });

  it('⚠️⚠️ says NOTHING about a model spelled out in full — many tags have no code at all', () => {
    // The first draft enforced "4 characters starting with C" and would have warned on every one
    // of these. DEWN854 is handwritten and says SELTOS; the US Compass says COMPASS; FVB4297 says
    // Model Y. Warning him about a tag he read perfectly is worse than the bug being guarded.
    for (const name of ['SELTOS', 'COMPASS', 'MODEL Y', 'SIENNA']) {
      expect(warn({ classCode: name }), `${name} must not warn`).toEqual([]);
    }
  });

  it('⚠️ says nothing about a model code FG has never seen — a new car is not a mistake', () => {
    expect(warn({ classCode: 'CZZZ' })).toEqual([]);
    expect(warn({ classCode: 'XY12' })).toEqual([]);
  });

  it('⚠️ never flags a bare "C" — C is itself a rental class on this fleet', () => {
    expect(warn({ rentalClass: 'C' })).toEqual([]);
  });

  it('⭐ stays silent when a value belongs to BOTH vocabularies — it cannot accuse either box', () => {
    const both = new Set(['E9']);
    expect(auditWarnings({ classCode: 'E9' }, CLASSES, both)).toEqual([]);
    expect(auditWarnings({ rentalClass: 'E9' }, CLASSES, both)).toEqual([]);
  });

  it('accepts every correct pairing without comment', () => {
    expect(warn({ classCode: 'CRVB', rentalClass: 'Q4' })).toEqual([]);
    expect(warn({ classCode: 'CTMY', rentalClass: 'E9' })).toEqual([]);
  });

  it('is case- and whitespace-insensitive, matching what the save does', () => {
    expect(warn({ classCode: '  e9  ' })[0].message).toMatch(/rental class/);
    expect(warn({ classCode: ' crvb ' })).toEqual([]);
  });

  it('says nothing about an empty field — a blank is not a mistake', () => {
    expect(warn({ classCode: '', rentalClass: '   ' })).toEqual([]);
    expect(warn({})).toEqual([]);
  });

  it('can flag both fields at once', () => {
    expect(warn({ classCode: 'Q4', rentalClass: 'CRVB' })).toHaveLength(2);
  });
});

describe('AUDIT_FIELD_HINTS', () => {
  it('has a hint for every auditable field', () => {
    for (const f of AUDIT_FIELDS) expect(AUDIT_FIELD_HINTS[f], `no hint for ${f}`).toBeTruthy();
  });

  it("⚠️ describes the VALUE, never its position — the tag formats differ", () => {
    // The first hint drafted was "top line, beside the branch number" — true of the printed Hertz
    // tag and wrong on the very tag that caused the mix-up.
    for (const f of AUDIT_FIELDS) {
      expect(AUDIT_FIELD_HINTS[f], `${f} hint describes a location`)
        .not.toMatch(/top |bottom|corner|line above|line below|under the/i);
    }
  });

  it('⭐ tells him a blank model code is a legitimate answer, not a gap', () => {
    expect(AUDIT_FIELD_HINTS.classCode).toMatch(/blank/i);
  });
});

// ⚠️⚠️ 'unreadable' WAS DOING TWO JOBS. Aaron, 2026-08-31, on a Suburban whose tag photo was shot on
// its Alberta plate before it was re-plated in Manitoba: *"i'd say just flag it for a retake the next
// time it comes in."* The only flag that existed meant *a human could not read this photo* — and that
// tag is perfectly legible. Migration 134 split them:
//     unreadable → a better photo of the SAME tag
//     stale      → a photo of a DIFFERENT tag
describe('stale — the other reason to retake', () => {
  const car = (over: Partial<AuditableVehicle> = {}): AuditableVehicle =>
    ({ id: 'v', licensePlate: 'MCM560', keytagPhotoUrl: 'https://cdn/kt.jpg', ...over });

  it('⭐ a stale tag is on the retake watchlist, same as an unreadable one', () => {
    const list = retakeWatchlist([
      car({ id: 'a', licensePlate: 'AAA111', keytagAuditResult: 'stale' }),
      car({ id: 'b', licensePlate: 'BBB222', keytagAuditResult: 'unreadable' }),
      car({ id: 'c', licensePlate: 'CCC333', keytagAuditResult: 'verified' }),
    ]);
    expect(list.map(v => v.licensePlate)).toEqual(['AAA111', 'BBB222']);
  });

  // ⚠️ ONE LIST, TWO WORDS. They share an errand — go to the car, take a photo — so they share a
  // queue. They are counted apart because what he should EXPECT to find when he gets there differs,
  // and a count that lumps them cannot say which.
  it('⚠️ but it is counted apart from unreadable', () => {
    const s = auditQueueStats([
      car({ id: 'a', keytagAuditResult: 'stale' }),
      car({ id: 'b', keytagAuditResult: 'stale' }),
      car({ id: 'c', keytagAuditResult: 'unreadable' }),
      car({ id: 'd', keytagAuditResult: 'verified', keytagAuditedAt: '2026-08-29T00:00:00Z' }),
      car({ id: 'e' }),
    ]);
    expect(s.stale).toBe(2);
    expect(s.unreadable).toBe(1);
    expect(s.verified).toBe(1);
    expect(s.pending).toBe(1);
  });

  // ⚠️ A stale car is NOT pending. It has been looked at; the verdict is "this photo is the wrong
  // tag". Counting it as unread would put it back in the audit queue in front of a photo nobody
  // can act on until it is replaced.
  it('⚠️ a stale car is not counted as pending', () => {
    expect(auditQueueStats([car({ keytagAuditResult: 'stale' })]).pending).toBe(0);
  });

  // A car with no photo at all can never be stale — there is nothing on file to be out of date.
  it('no photo still beats every result', () => {
    const s = auditQueueStats([car({ keytagPhotoUrl: null, keytagAuditResult: 'stale' })]);
    expect(s.noPhoto).toBe(1);
    expect(s.stale).toBe(0);
  });
});
