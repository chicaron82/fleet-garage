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
# Worker cap: default-parallel vitest gets starved into 30s timeouts when the
# browser is heavy (46 Chrome procs did exactly this, 2026-07-01 — and tempted
# two --no-verify pushes). Capped, the gate runs ~40s instead of ~18s idle but
# NEVER flakes under load. Override with GATE_MAX_WORKERS if ever needed.
npx vitest run --maxWorkers="${GATE_MAX_WORKERS:-2}"

echo "── gate: all green ────────────────────────────"
