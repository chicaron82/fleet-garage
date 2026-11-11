#!/usr/bin/env bash
# Watch GitHub CI for one commit and tell Aaron's phone how it went (2026-11-11).
#
# WHY. CI #1144 (40f6e6b3) failed at 10:44 and GitHub's own alert reached his phone at 11:28: GitHub created it on
# time, the phone held it. The gate runs the same suite locally, but a slow runner can still fail a timing test
# there (that one did). His "Yes please" to: keep watching CI in the background and tell him. push.sh starts this,
# detached, after LANDED; the result goes out through ~/.dizee-voice/notify.py, the topic his reminders already use.
#
#   bash scripts/ci-watch.sh <sha>          watch and push the result
#   DRY_RUN=1 bash scripts/ci-watch.sh <sha>  print the push instead of sending it (for checking)
# Green pushes go out at low priority (quiet); a failure goes out high, with the first failing test's name.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
sha=$(git rev-parse "${1:?usage: ci-watch.sh <sha>}") || exit 2
short=${sha:0:8}
subject=$(git log -1 --format=%s "$sha" | cut -c1-70)
NOTIFY="$HOME/.dizee-voice/notify.py"

say() { # priority, text
  if [ "${DRY_RUN:-0}" = 1 ]; then echo "[$1] $2"; return; fi
  if [ -f "$NOTIFY" ]; then python3 "$NOTIFY" --title "FG CI" --priority "$1" --tags "${3:-gear}" "$2"
  else echo "no notify.py; would have said [$1] $2"; fi
}

# The run shows up a few seconds after the push; give it 3 minutes.
id=''
for _ in $(seq 1 18); do
  id=$(gh run list --commit "$sha" --workflow CI --json databaseId -q '.[0].databaseId' 2>/dev/null)
  [ -n "$id" ] && break
  sleep 10
done
if [ -z "$id" ]; then say default "FG CI never started for $short ($subject). Ask DiZee to look." warning; exit 3; fi

timeout 1800 gh run watch "$id" --interval 30 >/dev/null 2>&1
conclusion=$(gh run view "$id" --json conclusion -q .conclusion 2>/dev/null)

case "$conclusion" in
  success) say low "FG CI green on $short ($subject)." white_check_mark; exit 0 ;;
  failure)
    # First failing test, from vitest's "FAIL file > describe > test" line. gh prints the colours both as real escapes
    # and as literal "^[[...m" text, so strip both.
    first=$(gh run view "$id" --log-failed 2>/dev/null | sed -E 's/(\x1b|\^\[)\[[0-9;]*m//g' \
      | grep -m1 -oE 'FAIL +[^ ]+.*' | sed -E 's/^FAIL +//' | cut -c1-160)
    say high "FG CI FAILED on $short ($subject). ${first:+First failure: $first. }Tell DiZee." x
    exit 4 ;;
  '') say default "FG CI for $short was still running after 30 minutes, or couldn't be read. Ask DiZee to look." warning; exit 3 ;;
  *) say default "FG CI ended '$conclusion' on $short ($subject). Ask DiZee to look." warning; exit 3 ;;
esac
