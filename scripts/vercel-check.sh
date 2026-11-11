#!/usr/bin/env bash
# Did Vercel actually build this commit? (2026-11-11). A push that LANDED on GitHub is not a deploy: on 11-10 bde45e55
# landed with green CI and Vercel never started a build (no status on the commit at all, no incident posted). Aaron found
# it at 05:50 from FG's footer. This reads the commit's GitHub statuses for Vercel's own context and says, plainly:
#   0  ▲ built (Vercel reported success)
#   0  ▲ building (Vercel picked it up; still pending when the wait ran out)
#   3  ⚠️ no Vercel build at all after the wait: the push notification was likely dropped
#   4  ❌ Vercel's build failed
#   bash scripts/vercel-check.sh [sha] [seconds]     (defaults: HEAD, VERCEL_WAIT or 240)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
sha=$(git rev-parse "${1:-HEAD}")
wait_s="${2:-${VERCEL_WAIT:-240}}"
repo=$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')
short=${sha:0:8}

state=''
for ((t = 0; ; t += 15)); do
  state=$(gh api "repos/$repo/commits/$sha/statuses" --jq '[.[] | select(.context == "Vercel")][0].state // ""' 2>/dev/null)
  [ "$state" = success ] || [ "$state" = failure ] || [ "$state" = error ] && break
  [ "$t" -ge "$wait_s" ] && break
  sleep 15
done

case "$state" in
  success) echo "▲ Vercel built $short"; exit 0 ;;
  pending) echo "▲ Vercel is building $short (still pending after ${wait_s}s)"; exit 0 ;;
  failure|error) echo "❌ Vercel's build FAILED for $short. Read it: npx vercel inspect --logs <url> (vercel ls)"; exit 4 ;;
  *) echo "⚠️  NO VERCEL BUILD for $short after ${wait_s}s: GitHub's push notice likely never reached Vercel."
     echo "   Deploy it by hand from a clean tree at $short: npx vercel deploy --prod --yes"; exit 3 ;;
esac
