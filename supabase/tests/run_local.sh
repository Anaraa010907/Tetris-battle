#!/usr/bin/env bash
# Runs the Neon Duel migrations and their checks on a throwaway local Postgres (no Supabase needed).
# Usage: supabase/tests/run_local.sh   (needs initdb/pg_ctl/psql; run as a non-root user)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
data="$(mktemp -d)"
port=55432
trap '"$bin/pg_ctl" -D "$data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$data"' EXIT
"$bin/initdb" -D "$data" -E UTF8 --locale=C.UTF-8 -A trust >/dev/null
"$bin/pg_ctl" -D "$data" -o "-p $port -k $data" -l "$data/log" start >/dev/null
psql=(psql -h "$data" -p "$port" -d postgres -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$here/local_stub.sql"
for f in "$here"/../migrations/*.sql; do "${psql[@]}" -f "$f" 2>&1 | grep -v 'skipping' || true; done
"${psql[@]}" -t -f "$here/local_test.sql" 2>&1 | grep -E 'ok:|FAILED|ERROR|PASSED'
