/**
 * The one line that says a photo didn't take.
 *
 * Renders nothing when there is nothing to say, so every caller can drop it in unconditionally
 * beside its picker — which is the point: a failure surface you have to remember to add is a
 * failure surface that gets forgotten on the seventeenth call site.
 *
 * `role="status"` rather than `alert`: this is information about what just happened, not an
 * interruption. He can simply take the photo again.
 */
export function PhotoError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="status" className="text-xs text-amber-700 dark:text-amber-400 mt-1">
      ⚠️ {message}
    </p>
  );
}
