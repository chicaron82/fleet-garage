#!/usr/bin/env bash
# Run all gates from the repo root, regardless of the caller's cwd.
# DiZee: always invoke this by absolute path so there's no ambient-cwd ambiguity.
#   bash /home/ronnie/Kitchen/fleet-garage/scripts/gate.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── test placement ─────────────────────────────"
# Tests live ONLY under tests/ (mirroring src/ + api/). vitest's default glob runs
# *.test.ts from ANYWHERE, so a co-located test still passes green — invisible to the
# tests station below, and it misreads the tests/ tree as a coverage gap. A cold
# line-check (2026-07-04) found 12 api/_lib tests drifted beside their source exactly
# this way. This turns the convention into a mechanism instead of a memory.
stray=$(find src api \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) 2>/dev/null || true)
if [ -n "$stray" ]; then
  echo "✗ test file(s) outside tests/ — move them under tests/ mirroring their path:"
  echo "$stray" | sed 's/^/    /'
  exit 1
fi

echo "── lint ───────────────────────────────────────"
npx eslint .

echo "── typecheck ──────────────────────────────────"
npx tsc -b

echo "── tests ──────────────────────────────────────"
# Worker cap: default-parallel vitest gets starved into 30s timeouts when the
# browser is heavy (46 Chrome procs did exactly this, 2026-07-01 — and tempted
# two --no-verify pushes). Capped, the gate runs ~40s instead of ~18s idle but
# NEVER flakes under load. Override with GATE_MAX_WORKERS if ever needed.
npx vitest run --maxWorkers="${GATE_MAX_WORKERS:-2}"

echo "── flow tests (e2e journeys) ──────────────────"
# Browser-driven scan-router journeys — the seam vitest can't see (scan → route → screen).
# They need the app running (Playwright auto-starts dev on :5199) + the live backend + a
# browser, so they're the slow part of the gate. SKIP_FLOWS=1 opts out for offline work or a
# docs-only push. They log in as the VSA verify bot; missing .env.local creds skips cleanly.
if [ "${SKIP_FLOWS:-}" = "1" ]; then
  echo "  skipped (SKIP_FLOWS=1)"
elif [ ! -f .env.local ]; then
  echo "  skipped (no .env.local — flow tests need the verify-bot creds)"
else
  npx playwright test
fi

echo "── gate: all green ────────────────────────────"
