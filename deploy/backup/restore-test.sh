#!/usr/bin/env bash
# Monthly restore test (README §10: "test a restore every month"). Restores the newest off-VPS backup into a
# throwaway PostgreSQL container — never the live database — and checks that the data is there.
#
#   deploy/backup/restore-test.sh            # newest daily backup
#   deploy/backup/restore-test.sh acp-2026-10-01.dump monthly
#
# Install (as root):  crontab -e  →  0 4 2 * * /opt/acp/deploy/backup/restore-test.sh >> /var/log/acp-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/../.."
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
BACKUP_REMOTE="${BACKUP_REMOTE:-$(env_value BACKUP_REMOTE)}"
: "${BACKUP_REMOTE:?set BACKUP_REMOTE in .env}"
folder="${2:-daily}"
name="${1:-$(rclone lsf "$BACKUP_REMOTE/$folder/" --include 'acp-*.dump' | sort | tail -1)}"
[ -n "$name" ] || { echo "no backup found in $BACKUP_REMOTE/$folder/" >&2; exit 1; }

work="$(mktemp -d)"
container="acp-restore-test-$$"
cleanup() { docker rm -f "$container" > /dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

echo "[$(date -u +%FT%TZ)] restore test of $folder/$name"
rclone copy "$BACKUP_REMOTE/$folder/$name" "$work/"
docker run -d --name "$container" -e POSTGRES_PASSWORD=restore-test -e POSTGRES_DB=acp postgres:17 > /dev/null
for _ in $(seq 1 30); do
  docker exec "$container" pg_isready -U postgres -d acp > /dev/null 2>&1 && break
  sleep 2
done
# The app role is referenced by the dump's grants; create it so they restore cleanly.
docker exec "$container" psql -q -U postgres -d acp -c "CREATE ROLE acp_app LOGIN" > /dev/null
docker exec -i "$container" pg_restore -U postgres -d acp --no-owner --exit-on-error < "$work/$name"

count() { docker exec "$container" psql -tA -U postgres -d acp -c "SELECT count(*) FROM $1"; }
users=$(count '"user"')
syllabi=$(count syllabus)
documents=$(count generated_document)
audit=$(count audit_log)
echo "restored: $users users, $syllabi syllabi, $documents frozen PDFs, $audit audit entries"
if [ "$users" -lt 1 ]; then
  echo "restore test FAILED: no users in the restored database" >&2
  exit 1
fi
# Frozen PDFs must come back byte for byte: their stored checksums must still match.
bad=$(docker exec "$container" psql -tA -U postgres -d acp \
  -c "SELECT count(*) FROM generated_document WHERE encode(sha256(pdf), 'hex') <> sha256")
if [ "$bad" != "0" ]; then
  echo "restore test FAILED: $bad frozen PDFs do not match their checksum" >&2
  exit 1
fi
echo "[$(date -u +%FT%TZ)] restore test passed"
