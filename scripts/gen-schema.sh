#!/bin/sh
# Dumps the live DB schema to migrations/schema.sql.
# Reads SUPABASE_DB_PASSWORD from .env.local — handles any password,
# including Supabase-generated ones with special characters.
# Requires pg_dump (brew install postgresql on Mac).

set -e

ENV_FILE="$(dirname "$0")/../.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "error: .env.local not found at $ENV_FILE" >&2
  exit 1
fi

PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$PASSWORD" ]; then
  echo "error: SUPABASE_DB_PASSWORD not set in .env.local" >&2
  exit 1
fi

ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PASSWORD")
OUT="$(dirname "$0")/../migrations/schema.sql"

pg_dump \
  --schema-only \
  --no-owner \
  --no-acl \
  -f "$OUT" \
  "postgresql://postgres.gugxedtqvuhlwllyqpec:${ENCODED}@aws-1-us-west-2.pooler.supabase.com:5432/postgres"

echo "schema written to migrations/schema.sql"
