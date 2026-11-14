#!/usr/bin/env bash
# Everything that must pass before a change is merged:
#   tests/run.sh            all of it
#   tests/run.sh quick      build check + game tests only (no database)
#
# Needs python3 with Playwright, a Chromium/Chrome (CHROME=/path, optional) and, for the database parts,
# PostgreSQL binaries (initdb, pg_ctl, psql). A throwaway database server is started and removed again;
# when run as root it runs as the "postgres" system user.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
step() { local name=$1; shift; echo; echo "== $name"; if "$@"; then echo "-- $name: passed"; else echo "-- $name: FAILED"; fail=1; fi; }

step "index.html is built from src/" python3 tools/build.py --check
step "game (browser)" python3 tests/game_test.py

if [ "${1:-}" != "quick" ]; then
  bin="$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1)")"
  if [ ! -x "$bin/initdb" ]; then
    echo; echo "== database: SKIPPED (no PostgreSQL binaries found)"; fail=1
  else
    data="$(mktemp -d)"; port=$((54000 + RANDOM % 1000))
    as=(); if [ "$(id -u)" = 0 ]; then chown postgres "$data"; as=(runuser -u postgres --); fi
    "${as[@]}" "$bin/initdb" -D "$data/db" -E UTF8 --locale=C.UTF-8 -A trust -U postgres >/dev/null
    "${as[@]}" "$bin/pg_ctl" -D "$data/db" -o "-p $port -k $data" -l "$data/log" -w start >/dev/null
    trap '"${as[@]}" "$bin/pg_ctl" -D "$data/db" -m immediate stop >/dev/null 2>&1; rm -rf "$data"' EXIT
    export PGHOST="$data" PGPORT="$port" PGUSER=postgres
    sql_tests() {
      psql -q -d postgres -c 'create database neon_sql' &&
      psql -q -d neon_sql -v ON_ERROR_STOP=1 -f supabase/tests/local_stub.sql &&
      for f in supabase/migrations/*.sql; do psql -q -d neon_sql -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -v skipping; done
      out="$(psql -q -t -d neon_sql -f supabase/tests/local_test.sql 2>&1)"
      echo "$out" | grep -E 'FAILED|ERROR' ; echo "$out" | grep -c 'ok:' | sed 's/^/checks passed: /'
      echo "$out" | grep -q 'ALL TESTS PASSED'
    }
    step "database functions (SQL)" sql_tests
    step "online play (two browser players)" python3 supabase/tests/e2e_online.py
  fi
fi
echo
[ $fail = 0 ] && echo "ALL PASSED" || echo "SOMETHING FAILED"
exit $fail
