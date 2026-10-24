#!/usr/bin/env bash
# Nightly backup (README §10 "VPS set-up"): a pg_dump of the whole database, copied off the VPS with rclone.
# Everything the portal stores is in PostgreSQL (syllabi, versions, frozen PDFs, the logo), so the dump is the
# complete backup; only .env lives outside it — keep that in the institute's password manager.
#
# Kept: 30 daily copies (daily/) and 12 monthly copies (monthly/, the dump of the 1st of each month).
#
#   BACKUP_REMOTE   rclone destination, e.g. "acp-crypt:" (an rclone crypt remote over Backblaze B2 or the
#                   institute's Google Drive, so the copies are encrypted; see deploy/RESTORE.md)
#   BACKUP_DIR      local copies, default /var/backups/acp (the last 7 are kept)
#   BACKUP_PING_URL optional: requested after a successful backup (e.g. a healthchecks.io check)
#
# Install (as root, from the repository on the VPS):
#   crontab -e  →  30 2 * * * /opt/acp/deploy/backup/backup.sh >> /var/log/acp-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/../.."
# Settings may come from the environment or from .env.
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
BACKUP_REMOTE="${BACKUP_REMOTE:-$(env_value BACKUP_REMOTE)}"
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/acp}"
BACKUP_PING_URL="${BACKUP_PING_URL:-$(env_value BACKUP_PING_URL)}"
: "${BACKUP_REMOTE:?set BACKUP_REMOTE in .env (an rclone remote, e.g. acp-crypt:)}"

stamp="$(date -u +%Y-%m-%d)"
file="$BACKUP_DIR/acp-$stamp.dump"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[$(date -u +%FT%TZ)] dumping the database to $file"
# Custom format (-Fc): compressed, and pg_restore can restore single tables from it.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.part"
mv "$file.part" "$file"
chmod 600 "$file"

# A dump that pg_restore cannot read is not a backup: check it before relying on it.
tables=$(docker compose exec -T db pg_restore --list < "$file" | grep -c " TABLE DATA " || true)
if [ "$tables" -lt 10 ]; then
  echo "backup FAILED: the dump lists only $tables tables" >&2
  exit 1
fi
echo "dump ok: $(du -h "$file" | cut -f1), $tables tables"

rclone copy "$file" "$BACKUP_REMOTE/daily/"
if [ "$(date -u +%d)" = "01" ]; then
  rclone copy "$file" "$BACKUP_REMOTE/monthly/"
fi

# Retention: 30 daily, 12 monthly off the VPS; 7 on it.
rclone delete "$BACKUP_REMOTE/daily/" --min-age 30d
rclone delete "$BACKUP_REMOTE/monthly/" --min-age 365d
find "$BACKUP_DIR" -name 'acp-*.dump' -mtime +7 -delete

if [ -n "$BACKUP_PING_URL" ]; then curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL" > /dev/null || true; fi
echo "[$(date -u +%FT%TZ)] backup copied to $BACKUP_REMOTE"
