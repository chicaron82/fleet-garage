interface Props {
  toast: { message: string; type: 'success' | 'error' } | null;
}

export function BarcodeToast({ toast }: Props) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: toast.type === 'success' ? 'rgba(22, 101, 52, 0.85)' : 'rgba(153, 27, 27, 0.85)',
        color: 'white',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      {toast.message}
    </div>
  );
}
