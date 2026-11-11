#!/usr/bin/env bash
# Push FG through its pre-push gate and say, in plain words, whether it LANDED (/reflect 91, 2026-11-10).
#
# WHY. The gate's verdict is one line ("── gate: all green") and a refused push looks a lot like a dropped SSH
# connection. On 11-10 I read "16 passed" in a truncated log, missed "1 failed" beside it, and called a real flow
# failure a network drop. The rule was already in memory (feedback_read_the_gate_verdict); I didn't apply it under
# pressure. This script does the reading: LANDED needs push exit 0, the verdict line, AND origin at HEAD.
#
#   bash scripts/push.sh            # push master, wait for Vercel (scripts/vercel-check.sh), then watch CI detached (scripts/ci-watch.sh)
# Exit: 0 landed + Vercel building/built · 1 not landed · 3 landed, NO Vercel build · 4 landed, Vercel build failed
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
log=$(mktemp -t fg-push.XXXXXX.log)
GIT_SSH_COMMAND="ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=40" git push origin "${1:-master}" >"$log" 2>&1
rc=$?
head=$(git rev-parse --short HEAD)
origin=$(git rev-parse --short "origin/${1:-master}" 2>/dev/null || echo '?')
verdict=$(grep -E "── gate: all green" "$log" | tail -1)

if [ $rc -eq 0 ] && [ "$head" = "$origin" ] && [ -n "$verdict" ]; then
  echo "✅ LANDED $head on origin · gate: all green"
  # ⭐ LANDED is not DEPLOYED (2026-11-11): bde45e55 landed green and Vercel never built it; he found it from the
  # footer at 05:50. Wait for Vercel's own status on the commit (VERCEL_WAIT=0 skips the wait, still checks once).
  bash scripts/vercel-check.sh HEAD
  vrc=$?
  # ⭐ And GitHub CI, which takes ~7 min (2026-11-11): CI #1144 failed at 10:44 and GitHub's alert reached his phone at
  # 11:28. A detached watcher pushes the result to his phone itself (scripts/ci-watch.sh). CI_WATCH=0 skips it.
  if [ "${CI_WATCH:-1}" != 0 ]; then
    wlog=$(mktemp -t fg-ci-watch.XXXXXX.log)
    setsid nohup bash scripts/ci-watch.sh "$(git rev-parse HEAD)" >"$wlog" 2>&1 </dev/null &
    echo "👀 Watching GitHub CI for $head in the background: his phone hears the result (log: $wlog)"
  fi
  exit $vrc
fi
echo "❌ NOT LANDED  (push exit $rc · HEAD $head · origin $origin)"
if [ -z "$verdict" ]; then
  # The gate runs `set -e`: a failing stage just stops, so the LAST banner is the stage that failed.
  stage=$(grep -E "^── " "$log" | tail -1)
  echo "   no 'gate: all green' line: the gate stopped in → ${stage:-(no stage banner at all: did the hook even run?)}"
fi
echo "   what it said (failures first):"
grep -nE "✗|✘|FAIL|[1-9][0-9]* failed|Error:|error TS|Unhandled|refused|rejected|Connection|timed out" "$log" | head -25 | sed 's/^/     /'
echo "   full log: $log"
exit 1
