#!/bin/sh
set -eu

: "${APP_DATABASE_PASSWORD:?The application database password is required}"
seed_sql=$(mktemp)
trap 'rm -f "$seed_sql"' EXIT

pg_restore --data-only --schema=public --no-owner --no-privileges \
  --table=crash_snapshots --table=crashes --table=current_crash_snapshot \
  --file="$seed_sql" /seed/street-aware.dump

psql --no-psqlrc --set=ON_ERROR_STOP=1 --set=seed_sql="$seed_sql" <<'SQL'
\getenv app_password APP_DATABASE_PASSWORD
BEGIN;

-- Coordinate with the snapshot importer and other deployments.
SELECT pg_advisory_xact_lock(78261492);
SELECT EXISTS(SELECT 1 FROM public.current_crash_snapshot) AS has_snapshot \gset
\if :has_snapshot
  \echo An active snapshot already exists.
\else
  \i :seed_sql
  \echo Restored the bundled crash snapshot.
\endif

SELECT 'CREATE ROLE streetaware_reader'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'streetaware_reader') \gexec
ALTER ROLE streetaware_reader LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE streetaware TO streetaware_reader;
GRANT USAGE ON SCHEMA public TO streetaware_reader;
GRANT SELECT ON public.crash_snapshots, public.crashes, public.current_crash_snapshot TO streetaware_reader;
COMMIT;
SQL
