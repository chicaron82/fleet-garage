// What FG already knows that is close to a code it does not recognise.
//
// ⭐⭐ THE MODULE HANDS BACK CANDIDATES, NEVER A DECISION — Aaron's rule, 2026-08-29: *"do what it
// can from the info its given. then leave the rest to me. whatever FG can't confidentally figure out
// from the info. instead of assuming, just to leave it for me to handle."* He is always the
// fallback and a good one; a gap he can see costs a glance, and a confident wrong value costs trust
// in the whole column.
//
// Two routes in, one rule out:
//   • TRUNCATED read (2–3 chars) → prefix completion.
//   • FULL read (4 chars) that is not a known code → NEAR MISS, one character away.
// Either way: exactly one candidate is offered, several are listed, and none is ever applied.
//
// ⭐ AARON'S IDEA, 2026-08-28, after finding FG had taught itself `CN = Nissan Sentra` from a
// truncated read of `CNSS`:
//
//   *"clues from the tag to tell what things are even if truncated. if CN was the only thing that
//    was picked up. what class is it, C? what C class has CN** Sentra! if it were CS** could be a
//    sportage CSPT if Q4, CSEH if a hybrid"*
//
// ⚠️ AND THE FACT THAT MAKES IT WORTH BUILDING: FG has no knowledge gap. Measured 2026-08-28 — the
// curated map holds 73 codes, the taught table 29, and the fleet carries 80 distinct. The number of
// fleet codes FG does not know is ZERO. Every "this code isn't in the codex yet" Aaron has ever seen
// was a code already in the book, arriving damaged — and the old behaviour asked him to TEACH it,
// which stored the truncation as a brand-new code. That is the entire life story of `CN`.
//
// Pure: no DB, no fetch. The caller supplies whatever it already knows.
import { normalizeClassCode, curatedClassCodes } from './vehicleClassCodex.js';

/** What a partial read could have been, and whether the evidence picks one. */
export interface PrefixResolution {
  /** The normalised partial this was keyed on. '' when the input was unusable. */
  prefix: string;
  /** Every known code beginning with the prefix, alphabetical. */
  candidates: readonly string[];
  /** The single code the evidence supports, or null. NEVER a guess between equals. */
  resolved: string | null;
  /** How it was narrowed — for saying so out loud rather than presenting a deduction as a read. */
  narrowedBy: 'unique' | 'rentalClass' | null;
}

/** Below this a prefix is not evidence: `C` matches all 73 curated codes, so one character
 *  "resolves" to nothing and would only ever produce a candidate list the length of the chart.
 *  Aaron's own examples start at two. */
const MIN_PREFIX = 2;

/** A full-length code is not a prefix — it is a code, and it belongs to the normal lookup path.
 *  Resolving it here would let a WRONG four-character read quietly become a different code. */
const CODE_LENGTH = 4;

const EMPTY: PrefixResolution = { prefix: '', candidates: [], resolved: null, narrowedBy: null };

/**
 * Resolve a truncated class code against the codes FG already holds.
 *
 * ⚠️ THE RESULT IS A DEDUCTION, NOT A READING. A resolved code was never on the tag — it was
 * inferred from the fleet's vocabulary — so anything that writes it belongs on the `derived` tier,
 * below a real tag read, exactly like a class code deduced from make and model (migration 121).
 * Presenting it as `tag` would let a guess outrank the truth it was guessing at.
 *
 * ⚠️ AND IT NEVER PICKS BETWEEN EQUALS. When several candidates survive, `resolved` is null and the
 * candidates are handed back for a person to choose from. A short list he can tap is a far better
 * surface than an empty box — and far better than a confident wrong answer.
 */
export function resolveClassCodePrefix(
  partial: string | null | undefined,
  /** The rental class read off the SAME tag. It survives when the model code does not, which is
   *  what makes it independent evidence rather than a second guess. */
  rentalClass: string | null | undefined,
  /** Known code → its rental class, from `class_code_rental_class`. Empty map = no narrowing. */
  codeToClass: ReadonlyMap<string, string> = new Map(),
  /** Codes FG has taught itself, on top of the curated map. */
  taughtCodes: readonly string[] = [],
): PrefixResolution {
  const prefix = normalizeClassCode(partial);
  if (prefix.length < MIN_PREFIX || prefix.length >= CODE_LENGTH) return EMPTY;

  const all = new Set<string>([...curatedClassCodes(), ...taughtCodes.map(c => normalizeClassCode(c))]);
  const candidates = [...all]
    .filter(c => c.length === CODE_LENGTH && c.startsWith(prefix))
    .sort();

  if (candidates.length === 0) return { prefix, candidates, resolved: null, narrowedBy: null };
  if (candidates.length === 1) {
    return { prefix, candidates, resolved: candidates[0], narrowedBy: 'unique' };
  }

  // ⭐ THE SECOND SOURCE ON THE SAME TAG. `CS**` matches seven codes; the rental class splits them —
  // "CSPT if Q4, CSEH if a hybrid". Only a class FG has actually learned for a code can narrow,
  // so an unknown pairing simply fails to narrow rather than eliminating a candidate wrongly.
  const cls = (rentalClass ?? '').trim().toUpperCase();
  if (cls) {
    const byClass = candidates.filter(c => codeToClass.get(c) === cls);
    if (byClass.length === 1) {
      return { prefix, candidates, resolved: byClass[0], narrowedBy: 'rentalClass' };
    }
  }
  return { prefix, candidates, resolved: null, narrowedBy: null };
}

/** One line for the operator: what FG thinks it was, and on what evidence. */
export function describePrefixResolution(r: PrefixResolution): string {
  if (!r.prefix) return '';
  if (r.resolved) {
    return r.narrowedBy === 'unique'
      ? `${r.prefix}… is only ever ${r.resolved}`
      : `${r.prefix}… with that rental class is ${r.resolved}`;
  }
  if (r.candidates.length === 0) return `${r.prefix}… matches no code FG knows`;
  return `${r.prefix}… could be ${r.candidates.join(', ')}`;
}


/** How far apart two same-length codes are. Positions only — a truncation is the other route's job. */
function charDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** A full-length read that is not a known code, and what it is one character from. */
export interface NearMiss {
  /** The code as read. */
  read: string;
  /** Known codes exactly one character away, alphabetical. */
  candidates: readonly string[];
  /** The single candidate, when there is exactly one. Null when none or several. */
  suggestion: string | null;
}

/**
 * A four-character read that FG does not know, measured against the codes it does.
 *
 * ⭐⭐⭐ THIS IS THE FAILURE THAT ACTUALLY HAPPENS. A 25-photo probe on 2026-08-29 found every class
 * code read at exactly four characters — no truncations at all, which is why the prefix route above
 * turned out to solve a problem that does not occur. But TWO of those 25 disagreed with the stored
 * value, and **neither misread is a real code**: `CJCL` read as `CJCI` (one character, L→I) and
 * `CKSE` read as `CRSR` (two). Both would be logged as unknown, and the teach path would then invite
 * Aaron to enshrine them — which is exactly how `CC59`, `CK45` and `CN` were born.
 *
 * ⚠️⚠️ ITS JOB IS TO RAISE DOUBT, NOT TO CORRECT — and the difference is load-bearing, because the
 * nearest code is often the WRONG one. Measured on the two real misreads: `CJCI` is one character
 * from `CJCL`, which is right; but `CRSR` (a misread of `CKSE`, a Kia Seltos) is one character from
 * `CRSV`, which is a different car entirely. **A two-character misread can sit one character from a
 * code that has nothing to do with the vehicle.**
 *
 * ⭐ So the message must never be "did you mean CRSV?". It is "this is not a code FG knows, and it
 * is one character from one it does — read the tag again before teaching this as new." That is TRUE
 * in both cases, and it is the thing that actually matters: the teach path is how `CC59`, `CK45` and
 * `CN` were born, and every one of them was a misread enshrined at the moment of doubt.
 *
 * ⚠️ AND IT NEVER PICKS. Two codes a single character away means the evidence does not settle it;
 * both are handed back and neither is preferred.
 */
export function nearMissClassCode(
  read: string | null | undefined,
  taughtCodes: readonly string[] = [],
): NearMiss {
  const code = normalizeClassCode(read);
  const empty: NearMiss = { read: code, candidates: [], suggestion: null };
  if (code.length !== CODE_LENGTH) return empty;

  const all = new Set<string>([...curatedClassCodes(), ...taughtCodes.map(c => normalizeClassCode(c))]);
  if (all.has(code)) return empty;              // FG knows it — nothing to rescue

  const candidates = [...all]
    .filter(c => c.length === CODE_LENGTH && charDistance(c, code) === 1)
    .sort();
  return { read: code, candidates, suggestion: candidates.length === 1 ? candidates[0] : null };
}

/**
 * One line for the operator, phrased as DOUBT rather than as a correction.
 *
 * ⚠️ Deliberately never "did you mean X". The nearest code is wrong often enough to make a
 * recommendation dangerous — and the useful content is not the candidate, it is the warning that
 * this looks like a misread of something FG already has, at the exact moment the teach path would
 * otherwise invite him to enshrine it.
 */
export function describeNearMiss(m: NearMiss): string {
  if (!m.read || m.candidates.length === 0) return '';
  const near = m.candidates.join(' and ');
  return `${m.read} isn't a code FG knows, and it's one character from ${near} — read the tag again before teaching it as new`;
}
