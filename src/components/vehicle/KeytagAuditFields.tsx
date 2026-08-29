import { AUDIT_FIELDS, AUDIT_FIELD_LABELS, AUDIT_FIELD_HINTS, type AuditField, type AuditWarning } from '../../lib/keytagAuditQueue';
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
export function KeytagAuditFields({ edits, missing, warnings, tone, onChange }: {
  edits: KeytagAuditEdits;
  /** Fields blank on the record — marked so his eye lands on what needs reading, not on a wall of
   *  pre-filled text. The honest cost of showing FG's current value is anchoring; this is the
   *  mitigation. */
  missing: readonly AuditField[];
  /** Values that look like they landed in the wrong box. Shown under the field, never enforced —
   *  he typed E9 from KNOWING the car rather than reading it, and a rule that refuses a value he is
   *  certain of is worse than the bug it prevents. */
  warnings: readonly AuditWarning[];
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
