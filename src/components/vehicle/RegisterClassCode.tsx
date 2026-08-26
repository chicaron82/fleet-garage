import { lookupVehicleClass, normalizeClassCode } from '../../../api/_lib/vehicleClassCodex';

// The four characters off the tag's corner, shown so he can check them BEFORE they are stored.
//
// Aaron, 2026-08-26: *"when something gets scanned and needs to be registered to FG. the model code
// isn't here to confirm it was read correctly. only after when pulling up the vehicle can I
// read/edit it."*
//
// ⭐⭐ THE INVERSION THIS FIXES. The field used to render only when the codex FAILED to resolve the
// code — so an unresolvable read got a yellow box and an explicit warning, while a MISREAD code
// that happens to resolve got nothing at all. Make and model simply filled in, looked right, and
// there was no way to notice the four characters underneath them were wrong. **The case that most
// needs confirming was the one that was hidden.**
//
// It has happened: *"On 2026-08-19 a Seltos tag read CKSE as CKSP; Aaron corrected the make and
// model, and FG dutifully taught the MISREAD code the right car."* That fix made the field visible
// while TEACHING and left the resolved-but-wrong case covered.
//
// ⚠️ And the stakes rose on 2026-08-26: `class_code` is now the key for the pinned code→rental-class
// mapping (migration 127). A wrong code no longer mislabels one car — it points at the wrong pin.
export function RegisterClassCode({ code, onChange, teaching }: {
  code: string;
  onChange: (next: string) => void;
  /** True when the codex could not resolve this code, so registering will TEACH it. */
  teaching: boolean;
}) {
  const known = lookupVehicleClass(normalizeClassCode(code));

  const tone = teaching
    ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20'
    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40';
  const labelTone = teaching ? 'text-amber-800 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400';
  const noteTone = teaching ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400';

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${tone}`} data-testid="register-class-code">
      <label htmlFor="class-code" className={`text-xs shrink-0 ${labelTone}`}>🏷️ Model code</label>
      <input
        id="class-code"
        value={code}
        onChange={e => onChange(e.target.value.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="CKSE"
        className={`w-24 rounded border bg-white dark:bg-gray-900 px-2 py-1 text-sm font-mono font-semibold tracking-wider text-gray-900 dark:text-gray-100 ${
          teaching ? 'border-amber-300 dark:border-amber-700' : 'border-gray-300 dark:border-gray-700'
        }`}
      />
      <span className={`text-[11px] ${noteTone}`}>
        {/* ⭐ SAY WHAT IT RESOLVES TO, and never silently re-fill make/model from it. If he corrects
            the code and the codex disagrees with the fields above, that disagreement is exactly what
            he needs to SEE — surface it, never lean. Overwriting his fields would be a second guess
            stacked on the first, and he may have corrected them deliberately. */}
        {!code.trim()
          ? 'Left blank, FG learns nothing from this tag — safer than learning it wrong.'
          : teaching
            ? `New to FG — registering teaches ${normalizeClassCode(code)} = this make and model. Check it against the tag.`
            : known
              ? `${normalizeClassCode(code)} → ${known.make} ${known.model}. Check it against the tag.`
              : `${normalizeClassCode(code)} isn't in the codex — registering will teach it this make and model.`}
      </span>
    </div>
  );
}
