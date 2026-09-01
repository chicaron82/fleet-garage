import { describe, it, expect } from 'vitest';
import {
  pickUnsendTarget,
  buildUnsendProposal,
  describeUnsendProposal,
  describeCandidate,
  type SentCandidate,
} from '../../../api/_lib/unsendProposal';

// Aaron, 2026-09-01. His boss picked five cars for FastAir; he captured five tags and logged them
// through Effie. A driver ignored the note on the board and took different cars, so three of the
// five rows recorded a send that never occurred — and the only fix was *"to ask you or hunt for it
// myself in supabase."*
//
// His requirement is the whole design: *"I just need to know what was actually sent. not what
// planned on getting sent but then didn't."*

const c = (id: string, destination: string, time: string, day = '2026-08-31'): SentCandidate =>
  ({ id, plate: '840PIQ', unit: '2149979', destination, day, time });

describe('pickUnsendTarget — and its refusal', () => {
  it('takes the one match', () => {
    const t = pickUnsendTarget([c('t1', 'FastAir', '11:33')]);
    expect(t).toEqual({ ok: true, trip: c('t1', 'FastAir', '11:33') });
  });

  it('says NONE rather than inventing a target', () => {
    expect(pickUnsendTarget([])).toEqual({ ok: false, why: 'none' });
  });

  // ⭐⭐ THE CASE THE WHOLE FEATURE CAME FROM, and the reason "most recent" is not a tiebreak.
  // 840PIQ was logged to FastAir at 11:33 (it never went — FastAir filled up) and then genuinely
  // sent to AV Flight at 15:52. The row he wants removed is the EARLIER one. Any heuristic that
  // picks the newest gets this exactly backwards, and a wrong void is invisible afterwards.
  it('REFUSES when a car was sent twice — the wanted row is often the earlier one', () => {
    const t = pickUnsendTarget([c('t-av', 'AV Flight', '15:52'), c('t-fa', 'FastAir', '11:33')]);
    expect(t.ok).toBe(false);
    expect(t).toMatchObject({ why: 'ambiguous' });
    if (!t.ok && t.why === 'ambiguous') expect(t.candidates.map((x) => x.id)).toEqual(['t-av', 't-fa']);
  });

  it('hands back EVERY candidate, so the operator chooses from the real set', () => {
    const t = pickUnsendTarget([c('a', 'FastAir', '09:00'), c('b', 'FastAir', '11:33'), c('c', 'Airport', '14:00')]);
    if (!t.ok && t.why === 'ambiguous') expect(t.candidates).toHaveLength(3);
    else throw new Error('expected an ambiguous refusal');
  });

  it('does not mutate the caller\'s array', () => {
    const rows = [c('a', 'FastAir', '09:00'), c('b', 'FastAir', '11:33')];
    const t = pickUnsendTarget(rows);
    if (!t.ok && t.why === 'ambiguous') t.candidates.pop();
    expect(rows).toHaveLength(2);
  });
});

describe('buildUnsendProposal', () => {
  it('carries his reason when he gave one', () => {
    const p = buildUnsendProposal(c('t1', 'FastAir', '11:33'), 'driver took different cars');
    expect(p).toEqual({ kind: 'unsend', trip: c('t1', 'FastAir', '11:33'), reason: 'driver took different cars' });
  });

  // A reason is worth having and is not worth blocking on — he is on a lot, one-handed.
  it('omits the reason entirely rather than storing an empty one', () => {
    for (const r of [undefined, '', '   ']) {
      expect(buildUnsendProposal(c('t1', 'FastAir', '11:33'), r)).not.toHaveProperty('reason');
    }
  });
});

describe('what he reads before tapping', () => {
  // ⚠️ Day AND time both appear, always. The hazard is voiding the wrong row, and on the day this
  // feature was born one car had two sends — so a card naming only the plate and the spot would
  // have been ambiguous at exactly the moment it mattered.
  it('names plate, spot, day and time', () => {
    expect(describeCandidate(c('t1', 'FastAir', '11:33'))).toBe('840PIQ → FastAir · 2026-08-31 11:33');
  });

  it('describes the proposal in one line the assistant can echo', () => {
    expect(describeUnsendProposal(buildUnsendProposal(c('t1', 'FastAir', '11:33'))))
      .toBe("remove 840PIQ's send to FastAir on 2026-08-31 at 11:33");
  });
});
