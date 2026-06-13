#!/usr/bin/env bash
# Run all gates from the repo root, regardless of the caller's cwd.
# DiZee: always invoke this by absolute path so there's no ambient-cwd ambiguity.
#   bash /home/ronnie/Kitchen/fleet-garage/scripts/gate.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── lint ───────────────────────────────────────"
npx eslint .

echo "── typecheck ──────────────────────────────────"
npx tsc -b

echo "── tests ──────────────────────────────────────"
npx vitest run

echo "── gate: all green ────────────────────────────"
