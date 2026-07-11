// Notification severity levels. The live notifications table stores this; the sidebar/bell
// render off the live feed (Supabase realtime). The old demo MOCK_NOTIFICATIONS + its
// visibility/read helpers were removed with the demo-side (docs/ticket-remove-demo-side.md).
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'urgent';
