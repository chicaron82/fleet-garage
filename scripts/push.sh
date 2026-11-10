#!/usr/bin/env bash
# Push FG through its pre-push gate and say, in plain words, whether it LANDED (/reflect 91, 2026-11-10).
#
# WHY. The gate's verdict is one line ("── gate: all green") and a refused push looks a lot like a dropped SSH
# connection. On 11-10 I read "16 passed" in a truncated log, missed "1 failed" beside it, and called a real flow
# failure a network drop. The rule was already in memory (feedback_read_the_gate_verdict); I didn't apply it under
# pressure. This script does the reading: LANDED needs push exit 0, the verdict line, AND origin at HEAD.
#
#   bash scripts/push.sh            # push master
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
  exit 0
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
