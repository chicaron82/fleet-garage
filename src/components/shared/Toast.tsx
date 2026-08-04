interface ToastProps {
  message: string;
  /** Colour tone. 'default' = the original red (alerts); 'success' = green — a
   *  confirmation reads as "✓ it worked", not as something being wrong. */
  variant?: 'default' | 'success';
}

const TOAST_BG: Record<NonNullable<ToastProps['variant']>, string> = {
  default: 'rgba(153, 27, 27, 0.85)', // red-900 — the original tone
  success: 'rgba(21, 128, 61, 0.9)',  // green-700 — logged / done
};

export function Toast({ message, variant = 'default' }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: '1.5rem', left: '50%',
        transform: 'translateX(-50%)', zIndex: 50,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        background: TOAST_BG[variant], color: 'white',
        padding: '0.75rem 1.25rem', borderRadius: '0.75rem',
        fontSize: '0.875rem', fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' as const,
      }}
    >
      {message}
    </div>
  );
}
