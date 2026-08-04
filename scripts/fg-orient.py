#!/usr/bin/env python3
"""FG orient — the "am I grounded for a work convo?" pack.

DiZee runs this when Aaron messages in a WORK context, so she shows up already knowing
his live shift, today's roster, recent schedule churn, and recent Effie activity —
instead of guessing / asking where things are ([[feedback_fg_orient_on_work_messages]]).

Reuses the Supabase Management API + the Cloudflare-1010 User-Agent fix
([[reference_grade_effie_schedule_import]]). Read-only; fails soft per-section.

    python3 scripts/fg-orient.py      # run from the fleet-garage repo root
"""
import json, urllib.request, urllib.error, re, os
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(BASE, '..', '.env.local')
TOK = re.search(r'^SUPABASE_ACCESS_TOKEN=(.+)$', open(ENV).read(), re.M).group(1).strip().strip('"\'')
REF = 'gugxedtqvuhlwllyqpec'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'


def q(sql):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json', 'User-Agent': UA})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {'_error': f'{e.code} {e.read().decode()[:120]}'}
    except Exception as e:  # noqa: BLE001 — fail soft, never crash an orient
        return {'_error': str(e)[:120]}


def rows(sql):
    r = q(sql)
    return r if isinstance(r, list) else []


print(f"🧭 FG ORIENT · {datetime.now().strftime('%a %Y-%m-%d %H:%M')}")

print("\n— AARON'S SHIFT (today + next) —")
today_lbl = datetime.now().strftime('%a %b %d')
# Filter by Aaron's stable profile id (from reference_aaron_work_schedule), not a
# name match — '%aaron s%' would break on a rename or a second "Aaron S".
sh = rows("""select to_char(s.date,'Dy Mon DD') d, s.shift_type,
     to_char(s.start_time,'HH24:MI') st, to_char(s.end_time,'HH24:MI') et
   from shifts s
   where s.user_id = '9f560505-ea86-4dcf-81d6-a9d960c9eae8'
     and s.date >= (now() at time zone 'America/Winnipeg')::date
   order by s.date limit 5""")
for r in sh:
    when = f"{r['st']}-{r['et']}" if r.get('st') else '—'
    tag = '   ← TODAY' if r['d'] == today_lbl else ''
    print(f"  {r['d']}  {r['shift_type']:8} {when}{tag}")
if not sh:
    print("  (no upcoming shifts found)")

print("\n— ON TODAY (working, by role) —")
roster = rows("""select p.role, count(distinct p.name) n,
     string_agg(distinct p.name, ', ' order by p.name) who
   from shifts s join profiles p on p.id::text = s.user_id::text
   where s.date = (now() at time zone 'America/Winnipeg')::date
     and s.shift_type not in ('day-off','pto','sick')
   group by p.role order by p.role""")
roles = {r['role'] for r in roster}
for r in roster:
    print(f"  {r['role']}: {r['n']} → {r['who']}")
if roster and 'HIR' not in roles:
    print("  ⚠️  no HIR scheduled — a driver may get pulled to cover the booth")
if not roster:
    print("  (nobody scheduled today)")

print("\n— SCHEDULE CHURN (shift rows changed, last 36h) —")
ch = rows("select count(*) n, min(s.date) mind, max(s.date) maxd "
          "from shifts s where s.updated_at > now() - interval '36 hours'")
if ch and ch[0]['n']:
    print(f"  {ch[0]['n']} changed (covering {ch[0]['mind']} → {ch[0]['maxd']})")
else:
    print("  none")

print("\n— EFFIE (awaiting action) —")
# Genuinely pending = not yet resolved. (A recent 'approved' row with resolved_at set
# is DONE, not pending — the earlier version wrongly counted those.)
eff = q("select count(*) n from effie_pending_writes where resolved_at is null")
if isinstance(eff, list) and eff:
    n = eff[0]['n']
    print(f"  {n} proposal(s) awaiting your action" if n else "  none awaiting")
elif isinstance(eff, dict) and eff.get('_error'):
    print(f"  (skipped: {eff['_error']})")
else:
    print("  none awaiting")
