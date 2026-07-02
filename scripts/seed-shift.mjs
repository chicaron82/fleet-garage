// DiZee's seed-shift helper — the seed→verify→delete-exact pattern, made permanent
// (it was re-written as a throwaway three times for My Day cockpit verification).
//
// Seeds ONE shift for the VSA-002 mock account so schedule-dependent surfaces
// (My Day, My Shift badges, WeekView) can be rendered in a "working today" state
// via verify-fg.mjs, then deletes that EXACT row. Never mutate-and-revert real
// data; never leave seeds behind ([[feedback_prod_demo_data]] — the write is
// self-scoped to a mock account, the cleanup is by returned id).
//
//   node scripts/seed-shift.mjs                      # seed today, opening 06:45–15:30
//   node scripts/seed-shift.mjs mid 10:00 18:30      # seed today with type + times
//   node scripts/seed-shift.mjs delete <id>          # delete-exact by the printed id
//
// Prints INSERTED <id> — pass that id back to `delete` after the screenshot.
// The shifts_user_date_unique constraint means a stray prior seed blocks a new
// one — the INSERT_ERR names it; delete the old row first.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (process.argv[2] === 'delete') {
  const id = process.argv[3];
  if (!id) { console.error('usage: seed-shift.mjs delete <id>'); process.exit(1); }
  const { error } = await db.from('shifts').delete().eq('id', id);
  console.log(error ? 'DELETE_ERR ' + error.message : 'DELETED ' + id);
  process.exit(error ? 1 : 0);
}

const shiftType = process.argv[2] || 'opening';
const start = process.argv[3] || '06:45';
const end = process.argv[4] || '15:30';

// Local today — matches toISO(new Date()) in ScheduleContext (plain local YYYY-MM-DD).
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const { data: prof, error: pErr } = await db.from('profiles')
  .select('id, name, branch_id').eq('employee_id', 'VSA-002').single();
if (pErr) { console.log('PROFILE_ERR ' + pErr.message); process.exit(1); }

const { data, error } = await db.from('shifts').insert({
  user_id: prof.id,
  date: today,
  shift_type: shiftType,
  start_time: start,
  end_time: end,
  branch_id: prof.branch_id || 'YWG',
}).select('id').single();
console.log(error ? 'INSERT_ERR ' + error.message : `INSERTED ${data.id} (${prof.name} · ${shiftType} ${start}–${end} · ${today})`);
process.exit(error ? 1 : 0);
