/**
 * One-time script: creates all 17 Fleet Garage users in Supabase Auth + profiles table.
 *
 * Run: npx tsx scripts/seed-auth-users.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS).
 * Safe to re-run — skips users that already exist.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env['VITE_SUPABASE_URL'];
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Decode JWT payload to verify this is actually the service_role key for this project
const keyPreview = `${SERVICE_ROLE_KEY.slice(0, 20)}...${SERVICE_ROLE_KEY.slice(-6)}`;
console.log(`URL:  ${SUPABASE_URL}`);
console.log(`Key:  ${keyPreview} (${SERVICE_ROLE_KEY.length} chars)`);

try {
  const payloadB64 = SERVICE_ROLE_KEY.split('.')[1] ?? '';
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as Record<string, unknown>;
  console.log(`JWT role:  ${payload['role']}   ← must be "service_role"`);
  console.log(`JWT ref:   ${payload['ref']}   ← must match project\n`);
  if (payload['role'] !== 'service_role') {
    console.error('This is not a service_role key. Go to Supabase dashboard → Project Settings → API → copy the "service_role" (secret) key, not the "anon" key.');
    process.exit(1);
  }
} catch {
  console.error('Could not decode JWT payload — key may be malformed.');
  process.exit(1);
}

// Supabase client for profile inserts (PostgREST, not GoTrue)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Auth user creation via direct fetch — bypasses supabase-js auth module header handling
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
};

async function createAuthUser(email: string, password: string, employeeId: string, name: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id: employeeId, name },
    }),
  });
  const body = await res.json() as { id?: string; msg?: string; message?: string; code?: string };
  if (!res.ok) {
    const msg = body.msg ?? body.message ?? JSON.stringify(body);
    throw Object.assign(new Error(msg), { code: body.code, status: res.status });
  }
  return body as { id: string };
}

const USERS = [
  { employeeId: '331965',    name: 'Aaron S.',      role: 'VSA',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'VSA-002',   name: 'DiZee',         role: 'Lead VSA',           branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'VSA-003',   name: 'Belle',         role: 'VSA',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'CSR-001',   name: 'CoZee',         role: 'CSR',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'HIR-001',   name: 'Tori',          role: 'HIR',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'MGR-001',   name: 'ZeeRah',        role: 'Branch Manager',     branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'OPS-001',   name: 'Zee',           role: 'Operations Manager', branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'DRV-001',   name: 'GenZee',        role: 'Driver',             branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'DRV-002',   name: 'ZeeDric',       role: 'Driver',             branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'VSA-004',   name: 'PerplexiZee',   role: 'VSA',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: '256163',    name: 'Geoff N.',      role: 'Lead VSA',           branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: '300210',    name: 'Ray T.',        role: 'VSA',                branchId: 'YWG', password: '!Bananarama1982' },
  { employeeId: 'BOSS',      name: 'Big Boss',      role: 'City Manager',       branchId: 'ALL', password: '!Bananarama1982' },
  { employeeId: 'YYC-VSA-01',name: 'Marcus L.',     role: 'VSA',                branchId: 'YYC', password: '!Bananarama1982' },
  { employeeId: 'YVR-VSA-01',name: 'Linh T.',       role: 'VSA',                branchId: 'YVR', password: '!Bananarama1982' },
  { employeeId: 'AGM-001',   name: 'Harpreet T.',   role: 'AGM',               branchId: 'ALL', password: '!HertzYWG_1577erin' },
  { employeeId: 'GM-001',    name: 'Howard W.',     role: 'GM',                 branchId: 'ALL', password: '!HertzYWG_1577erin' },
];

async function seed() {
  console.log(`Seeding ${USERS.length} users into Supabase Auth + profiles...\n`);
  let created = 0;
  let skipped = 0;

  for (const u of USERS) {
    const email = `${u.employeeId.toLowerCase()}@fleet-garage.internal`;

    let userId: string;
    try {
      const created = await createAuthUser(email, u.password, u.employeeId, u.name);
      userId = created.id;
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.message?.includes('already been registered') || e.message?.includes('already exists') || e.code === 'email_exists') {
        console.log(`  skip  ${u.employeeId.padEnd(12)} — ${u.name} (already exists)`);
        skipped++;
        continue;
      }
      console.error(`  ERROR ${u.employeeId.padEnd(12)} — ${e.message}`);
      continue;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      employee_id: u.employeeId,
      name: u.name,
      role: u.role,
      branch_id: u.branchId,
    });

    if (profileError) {
      console.error(`  ERROR ${u.employeeId.padEnd(12)} profile insert — ${profileError.message}`);
      continue;
    }

    console.log(`  ✓     ${u.employeeId.padEnd(12)} — ${u.name} (${u.role}, ${u.branchId})`);
    created++;
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`);
}

seed().catch(err => { console.error(err); process.exit(1); });
