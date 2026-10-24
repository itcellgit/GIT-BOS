#!/bin/sh
# Least-privilege database role for the app (README §11). Runs once, when the db container first creates its
# data volume (docker-entrypoint-initdb.d). The owner role (POSTGRES_USER) creates the tables and runs the
# migrations; the app connects as "acp_app", which can read and write data but not change the schema, and
# cannot change or remove audit rows (migration 20261024055137_audit_append_only).
set -eu
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD in .env}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" -v owner="$POSTGRES_USER" -v dbname="$POSTGRES_DB" <<'SQL'
CREATE ROLE acp_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"dbname" TO acp_app;
GRANT USAGE ON SCHEMA public TO acp_app;
-- Tables and sequences the owner creates later (every migration) are usable by the app.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO acp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO acp_app;
SQL
