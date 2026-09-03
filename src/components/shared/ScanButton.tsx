import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';

/**
 * THE KEY-TAG SCAN GESTURE — one button, so there is only one way to make one.
 *
 * ⭐⭐ WHY THIS EXISTS. Aaron, 2026-09-02, looking at a new section: *"is there a way to keep the
 * design language consistent, especially when adding new things?"* He asked because I had just
 * shipped a scan button in `bg-blue-600` — a colour that appears nowhere else in My Shift — having
 * hand-rolled it without checking. `PrimaryAction` already proved the answer for create-actions;
 * the scan gesture had no equivalent, so **five call sites had each re-typed it**, and by then they
 * had drifted into four labels and three text weights:
 *
 *   • KeytagSearchScan      solid, px-4 py-2.5, text-black,     font-semibold, "Scan Key Tag"  ← also wrong: CLAUDE.md says yellow takes text-gray-900
 *   • BatchKeytagScan       solid, px-3.5 py-2, text-gray-900,  font-bold,     no camera at all
 *   • ClosingInventory      solid, full-width py-3,             font-semibold, "Scan a key tag"
 *   • OverflowSendForm      dashed outline, gray text,                         "Scan key tag"
 *   • LostFoundDetailsStep  inline text link, yellow text,                     "Scan tag"
 *
 * ⚠️ AND THE VARIANTS ARE REAL, NOT DRIFT. Three of those weights exist for a reason — a solid pill
 * is a section's main action, the dashed outline is a drop-zone affordance, the inline link is a
 * small assist inside a form. **Flattening them would impose consistency where there was a
 * decision.** So this component owns the GESTURE and leaves the WEIGHT to the caller.
 *
 * ⭐ What it owns, and what was being re-typed every time: the hidden file input and its ref, the
 * `value = ''` reset that lets the SAME tag be scanned twice, `accept`/`capture`, the 📷, the
 * "Reading…" swap, haptics, and the disabled styling.
 *
 * ⚠️⚠️ TWO CALL SITES DELIBERATELY DO NOT USE THIS, and both are decisions rather than debt:
 *
 *   • **BatchKeytagScan** takes `multiple` files and omits `capture` ON PURPOSE — you photograph a
 *     stack of tags and then select them from the gallery. It is an ATTACH gesture, not a scan; its
 *     button even says "Attach key tags". Forcing it through here would break the stack-select.
 *   • **LostFoundDetailsStep** routes its capture through `useLostFoundItemForm.handlePhotoCapture`,
 *     which also sets the photo on the form. Moving it would mean changing a hook other steps share
 *     — a bigger edit than the win justifies. Left for a session with room to do it properly.
 *
 * ⚠️ The reset is the one with teeth: without it, re-selecting the same photo fires no `change`
 * event and the button looks dead. All five call sites had it (one via a form hook) — audited, not
 * assumed — but it is exactly the detail a sixth author would omit.
 */
export type ScanButtonVariant = 'solid' | 'outline' | 'inline';

const VARIANTS: Record<ScanButtonVariant, string> = {
  /** A section's main action. The brand accent — this is the ACTION lane. */
  solid:
    'gap-2 px-4 py-2.5 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 font-semibold text-sm',
  /** A drop-zone affordance: quiet until you approach it. */
  outline:
    'gap-2 py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 ' +
    'text-gray-600 dark:text-gray-300 font-semibold text-sm hover:border-fg-yellow hover:text-yellow-500',
  /** A small assist beside a field, not a button in its own right. */
  inline:
    'gap-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline',
};

export function ScanButton({
  onFile,
  reading = false,
  disabled = false,
  variant = 'solid',
  label = 'Scan key tag',
  fullWidth = false,
  className = '',
}: {
  /** Handed the chosen photo. The input is reset before this runs, so re-scanning the same tag works. */
  onFile: (file: File) => void | Promise<void>;
  /** Swaps the label to "Reading…" and blocks a second tap. */
  reading?: boolean;
  disabled?: boolean;
  variant?: ScanButtonVariant;
  /** Override only when the surface genuinely needs different words. */
  label?: string;
  fullWidth?: boolean;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = reading || disabled;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          // ⚠️ Reset BEFORE handing the file on, so the same tag can be scanned twice in a row.
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => { hapticLight(); fileRef.current?.click(); }}
        className={`flex items-center justify-center transition cursor-pointer ` +
          `disabled:opacity-50 disabled:cursor-not-allowed ` +
          `${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      >
        <span className={variant === 'inline' ? 'text-sm leading-none' : 'text-base leading-none'}>📷</span>
        {reading ? 'Reading…' : label}
      </button>
    </>
  );
}
