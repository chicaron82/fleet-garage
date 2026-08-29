import { AUDIT_FIELDS, AUDIT_FIELD_LABELS, AUDIT_FIELD_HINTS, type AuditField, type AuditWarning } from '../../lib/keytagAuditQueue';
import { describeOwningGuess, type OwningGuess } from '../../lib/owningFromUnit';
import type { OwningPreset } from '../../lib/owningPresets';
import type { KeytagAuditEdits } from '../../context/keytagAuditWrite';

/**
 * The five tag fields and the three things he can do with them — rendered identically under the
 * card and ON TOP of the zoomed photo.
 *
 * ⭐ WHY IT IS ITS OWN FILE. Aaron, first sitting with the auditor: *"having to flip back between
 * image entering things read from the tag is tedious."* The tag is small print; he zooms to read a
 * VIN, drops the zoom to type it, zooms again for the next one. Five fields is five round trips per
 * car, and the whole value of this feature is the cycle being frictionless.
 *
 * The fix is not a bigger thumbnail — it is the same inputs living in both places, which means ONE
 * definition. Two copies of a form is how one of them quietly grows a sixth field the other lacks.
 */
export function KeytagAuditFields({ edits, missing, warnings, owningGuess, owningPresets, tone, onChange }: {
  edits: KeytagAuditEdits;
  /** Fields blank on the record — marked so his eye lands on what needs reading, not on a wall of
   *  pre-filled text. The honest cost of showing FG's current value is anchoring; this is the
   *  mitigation. */
  missing: readonly AuditField[];
  /** Values that look like they landed in the wrong box. Shown under the field, never enforced —
   *  he typed E9 from KNOWING the car rather than reading it, and a rule that refuses a value he is
   *  certain of is worse than the bug it prevents. */
  warnings: readonly AuditWarning[];
  /** What the fleet's own unit numbers say about this car's branch — offered under the owning-area
   *  field, never written into it. */
  owningGuess: OwningGuess;
  /** Named Canadian branches this fleet carries, commonest first. A shortcut, never a constraint —
   *  the text field still takes anything, which is how a US car or an unknown branch gets in. */
  owningPresets: readonly OwningPreset[];
  /** 'dark' is over the photo, where the ground is black and the light palette disappears. */
  tone: 'light' | 'dark';
  onChange: (field: AuditField, value: string) => void;
}) {
  const dark = tone === 'dark';
  return (
    <div className="grid grid-cols-2 gap-2">
      {AUDIT_FIELDS.map(f => {
        const blank = missing.includes(f);
        const warning = warnings.find(w => w.field === f);
        return (
          <label key={f} className={f === 'vinLast9' ? 'col-span-2' : ''}>
            {/* ⚠️ THERE WAS A `•` HERE AND IT LIED BY POSITION. It meant "blank on the record" — me
                pointing at what needs reading — but it sat exactly where a required-field asterisk
                goes, so Aaron read it as "you must fill this" and asked whether he was allowed to
                leave a field he couldn't read. NOTHING here is required. Tinting the label itself
                carries the same signal and cannot be mistaken for a rule. */}
            <span className={`block text-[11px] font-semibold mb-0.5 ${
              blank
                ? (dark ? 'text-amber-300/80' : 'text-amber-700 dark:text-amber-500')
                : (dark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')
            }`}>
              {AUDIT_FIELD_LABELS[f]}
            </span>
            <input
              type="text"
              value={edits[f] ?? ''}
              onChange={e => onChange(f, e.target.value)}
              placeholder={blank ? 'read it off the tag' : ''}
              {...(f === 'vinLast9' ? { maxLength: 9 } : {})}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                dark
                  ? `bg-white/10 text-white placeholder-white/30 ${blank ? 'border-amber-400/60' : 'border-white/20'}`
                  : `bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 ${blank ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`
              }`}
            />
            {/* The hint says what the value IS, not where it sits — position does not survive the
                second tag format. It gives way to a warning, which is the more urgent thing to read. */}
            <span className={`mt-0.5 block text-[10px] leading-snug ${
              warning
                ? (dark ? 'text-amber-300' : 'text-amber-700 dark:text-amber-400')
                : (dark ? 'text-white/35' : 'text-gray-400 dark:text-gray-500')
            }`}>
              {warning ? `⚠️ ${warning.message}` : AUDIT_FIELD_HINTS[f]}
            </span>
            {/* ⭐ AARON'S OWN SHORTCUT, OFFERED BACK. He reads a unit prefix and knows the branch
                — "anything with unit number 542**** or 549**** enter owning 8199". This is that,
                computed live from the fleet so it moves when the numbering rotates.
                ⚠️ A BUTTON, NEVER A PREFILL. Three of the fleet's 29 prefixes map to two branches,
                and those minority rows came off scanned tags — so an autofill would eventually
                write the wrong branch and stamp it 'manual', locked, off a tap he made without
                looking. When the block is split it shows the split and offers nothing. */}
            {/* ⭐ ONE TAP INSTEAD OF FOUR DIGITS. Aaron: *"typing them out is tedious and
                repetitive lol so i can only do them in batches before i go do something else."*
                Ordered by how common each branch is on the live fleet, so the one he needs most is
                first and the order follows the fleet rather than a hardcoded list — the branch
                numbers have already rotated once in his tenure.
                ⚠️ A shortcut, never a constraint: the field above still accepts anything, which is
                how a US car or a branch FG cannot name gets entered. */}
            {f === 'owningArea' && owningPresets.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1">
                {owningPresets.map(p => {
                  const on = (edits.owningArea ?? '').trim() === p.code;
                  return (
                    <button key={p.code} type="button" title={p.label}
                      onClick={() => onChange('owningArea', p.code)}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold tabular-nums transition cursor-pointer ${
                        on
                          ? (dark ? 'bg-fg-yellow text-gray-900' : 'bg-fg-yellow text-gray-900')
                          : (dark ? 'bg-white/10 text-white/70 hover:bg-white/20'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700')
                      }`}>
                      {p.code}
                    </button>
                  );
                })}
              </span>
            )}
            {f === 'owningArea' && owningGuess.seen > 0 && (
              owningGuess.suggestion && owningGuess.suggestion !== (edits.owningArea ?? '').trim() ? (
                <button type="button" onClick={() => onChange('owningArea', owningGuess.suggestion!)}
                  className={`mt-1 block text-left text-[10px] leading-snug underline cursor-pointer ${
                    owningGuess.ambiguous
                      ? (dark ? 'text-amber-300' : 'text-amber-700 dark:text-amber-400')
                      : (dark ? 'text-sky-300' : 'text-sky-700 dark:text-sky-400')
                  }`}>
                  {owningGuess.ambiguous ? '⚠️ ' : '↩ '}use {owningGuess.suggestion} · {describeOwningGuess(owningGuess)}
                </button>
              ) : !owningGuess.suggestion ? (
                <span className={`mt-1 block text-[10px] leading-snug ${dark ? 'text-amber-300/80' : 'text-amber-700 dark:text-amber-500'}`}>
                  ⚠️ split block — {describeOwningGuess(owningGuess)}
                </span>
              ) : null
            )}
          </label>
        );
      })}
    </div>
  );
}

/** Save / Skip / Can't-read-this. Same three actions wherever the fields are. */
export function KeytagAuditActions({ saving, tone, onSave, onSkip, onFlagUnreadable }: {
  saving: boolean;
  tone: 'light' | 'dark';
  onSave: () => void;
  onSkip: () => void;
  onFlagUnreadable: () => void;
}) {
  const dark = tone === 'dark';
  return (
    <div className="space-y-1.5">
    {/* ⭐ SAID OUT LOUD, because he had to ask: *"the asterisks are required, if i don't know it or
        can't read it, can i still leave it blank"*. He can. A blank is never written and never
        stamped — "I couldn't see it" is not a fact about the car. A tool whose permissions have to
        be inferred from a glyph is a tool that will be obeyed wrongly. */}
    <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}>
      Nothing here is required — leave anything you can't read blank.
    </p>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={saving} onClick={onSave}
        className="rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 text-sm font-bold text-gray-900 transition cursor-pointer">
        {saving ? 'Saving…' : '✓ Save & next'}
      </button>
      <button type="button" disabled={saving} onClick={onSkip}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 transition cursor-pointer ${
          dark
            ? 'border-white/20 text-white/80 hover:bg-white/10'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}>
        Skip
      </button>
      {/* The retake watchlist, written by the same tap that advances the queue. */}
      <button type="button" disabled={saving} onClick={onFlagUnreadable}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 transition cursor-pointer ${
          dark
            ? 'border-amber-400/50 text-amber-300 hover:bg-amber-400/10'
            : 'border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
        }`}>
        Can't read this
      </button>
    </div>
    </div>
  );
}
