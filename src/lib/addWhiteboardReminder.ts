import { supabase, writeWithRefresh } from './supabase';
import { reminderCreatedAtISO } from './whiteboardReminder';

/**
 * Leave a reminder on the shift whiteboard's `shift_board` section, targeted at the
 * user's NEXT shift (see reminderCreatedAtISO) so it surfaces then and auto-clears
 * the shift after. Mirrors WhiteboardView's insert; the only extra is the forward-
 * dated created_at that files it under tomorrow's board. Returns false on failure
 * (the caller converts that to a throw for the confirm card's error state).
 */
export async function addWhiteboardReminder(args: {
  body: string;
  branchId: string;
  user: { id: string; name: string; role: string };
  now?: Date;
}): Promise<boolean> {
  const { error } = await writeWithRefresh(() =>
    supabase.from('whiteboard_notes').insert({
      branch_id:    args.branchId,
      section:      'shift_board',
      body:         args.body,
      author_id:    args.user.id,
      author_name:  args.user.name,
      author_role:  args.user.role,
      trigger_type: 'manual',
      status:       'active',
      created_at:   reminderCreatedAtISO(args.now),
    })
  );
  return !error;
}
