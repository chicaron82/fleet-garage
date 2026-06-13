import { hapticLight } from '../../lib/haptics';

interface PrimaryActionProps {
  /** Verb (or verb + noun) shown after the "+". e.g. "Log", "Register", "Audit". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Spoken label when the short visible text needs more context for screen readers. */
  'aria-label'?: string;
}

/**
 * The canonical FG primary create-action: a solid yellow labelled pill, always
 * rendered as "+ {label}". Every module's "add" reads the same and — paired with
 * ModuleHeader's action slot — lives in the same place. Haptic feedback is baked
 * in so every primary action feels identical.
 *
 * This is the ACTION lane: it's always the brand accent (fg-yellow). Status
 * colours (red urgency, green success) never belong here.
 */
export function PrimaryAction({ label, onClick, disabled, 'aria-label': ariaLabel }: PrimaryActionProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => { hapticLight(); onClick(); }}
      className="shrink-0 px-3 py-1.5 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black font-semibold text-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + {label}
    </button>
  );
}
