#!/usr/bin/env sh
# Applies supabase/migrations/20260415120000_reconcile_perch_schema.sql to your Supabase Postgres.
#
# Usage:
#   1. Supabase Dashboard -> Project Settings -> Database -> Connection string (URI, direct or pooler)
#   2. export DATABASE_URL='postgresql://postgres.[ref]:[YOUR-PASSWORD]@...'
#   3. From repo root: sh scripts/apply-perch-schema.sh
#
# Requires: psql (PostgreSQL client)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/supabase/migrations/20260415120000_reconcile_perch_schema.sql"

if [ ! -f "$SQL" ]; then
  echo "Missing migration file: $SQL"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Set DATABASE_URL to your Supabase Postgres connection URI, then run again."
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "Schema reconcile applied."
