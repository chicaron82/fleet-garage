import type { MessageTone } from '../../lib/messageTone';
import { Sparkles } from './Sparkles';

interface ToastProps {
  message: string;
  /**
   * What KIND of message this is — see lib/messageTone. Declared by the caller, because only the
   * caller knows whether the thing that just happened was good news.
   *
   * ⚠️ THIS USED TO BE CALLED 'default', AND THE NAME IS WHY THE BUG EXISTED. A variant named
   * `default` invites a call site to omit it, and omitting it silently meant "this is an alert" —
   * which is how `✨ Registered LUR330 · 2026 Nissan Kicks` came to render on alert red for months.
   * Calling the fallback `alert` makes leaving it out visible as a claim rather than as a shrug.
   */
  variant?: MessageTone;
  /** ✨ Render the flourish. The CALLER's only job is the one thing only it knows — was this
   *  moment rare? `<Sparkles>` checks the preference itself and CSS handles reduced motion. */
  sparkle?: boolean;
}

const TOAST_BG: Record<MessageTone, string> = {
  alert:   'rgba(153, 27, 27, 0.85)', // red-900 — something went wrong
  notice:  'rgba(180, 83, 9, 0.88)',  // amber-700 — happened, but worth knowing
  success: 'rgba(21, 128, 61, 0.9)',  // green-700 — logged / done
};

export function Toast({ message, variant = 'alert', sparkle = false }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: '1.5rem', left: '50%',
        // ⚠️ `fixed` is already a positioned ancestor, so the sparkle layer's `inset: 0` resolves to
        // this box — no extra wrapper needed.
        transform: 'translateX(-50%)', zIndex: 50,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        background: TOAST_BG[variant], color: 'white',
        padding: '0.75rem 1.25rem', borderRadius: '0.75rem',
        fontSize: '0.875rem', fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' as const,
      }}
    >
      {message}
      {/* ⚠️ PURELY DECORATIVE — aria-hidden, and outside the message text, so a screen reader hears
          the news and not the confetti. The CSS carries the reduced-motion guard. */}
      {sparkle && <Sparkles />}
    </div>
  );
}
