/**
 * Where tapping a notification takes you — read from its `metadata`.
 *
 * Pulled out of the old header `NotificationBell` when the two inboxes became one
 * (2026-09-10). The phone bell had grown tap-through across four fixes (May 7–25)
 * while the desktop sidebar's rows stayed plain text, because each fix went into
 * whichever copy was on screen. One pure function, one inbox, so the next kind of
 * tappable notification lands everywhere at once.
 *
 * Approval requests win over the vehicle jump: a vehicle-edit request carries a
 * `vehicleId` too, and the approval sheet is the thing that needs doing.
 */
export type NotificationRoute =
  | { kind: 'oth-edit-approval'; entryId: string }
  | { kind: 'backdate-approval'; entryId: string }
  | { kind: 'vehicle-edit-approval'; vehicleId: string }
  | { kind: 'vehicle'; vehicleId: string };

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function notificationRoute(metadata?: Record<string, unknown> | null): NotificationRoute | null {
  if (!metadata) return null;
  const entryId = str(metadata.entryId);
  const vehicleId = str(metadata.vehicleId);
  switch (metadata.type) {
    case 'oth_edit_request':
      if (entryId) return { kind: 'oth-edit-approval', entryId };
      break;
    case 'oth_backdate_request':
      if (entryId) return { kind: 'backdate-approval', entryId };
      break;
    case 'vehicle_edit_request':
      if (vehicleId) return { kind: 'vehicle-edit-approval', vehicleId };
      break;
  }
  return vehicleId ? { kind: 'vehicle', vehicleId } : null;
}
