# Backups and restore

For whoever runs the VPS (README §10 "VPS set-up"). Everything the portal stores lives in PostgreSQL: users, schemes, syllabi, every version, the frozen approved PDFs, the institution logo and the audit log. The nightly database dump is therefore a complete backup. The one thing outside it is `.env`, with the passwords and sign-in secrets. Keep a copy of `.env` in the institute's password manager, never next to the backups.

| What                          | Where                                      | Kept                 |
| ----------------------------- | ------------------------------------------ | -------------------- |
| Nightly `pg_dump -Fc`         | `$BACKUP_REMOTE/daily/acp-YYYY-MM-DD.dump` | 30 days              |
| Dump of the 1st of each month | `$BACKUP_REMOTE/monthly/`                  | 12 months            |
| Last nightly dumps on the VPS | `/var/backups/acp`                         | 7 days               |
| Hostinger snapshots           | Hostinger panel                            | weekly, second layer |

At worst, one day's work is lost (the time since the last nightly dump).

## One-time set-up

1. Install rclone on the VPS: `apt install rclone`.
2. Create the off-site storage. Use a Backblaze B2 bucket, or a folder in the institute's Google Drive owned by an institutional account, not a personal one.
3. Run `rclone config` to create two remotes:
   - `acp-store` for that storage (B2 or Google Drive);
   - `acp-crypt`, of type **crypt**, over `acp-store:acp-backups`.

   The dumps contain names, email addresses and password hashes, so they must be encrypted before they leave the VPS. Put the crypt passwords in the password manager as well: without them the backups cannot be read.

4. Add the settings to `.env`:
   ```
   BACKUP_REMOTE="acp-crypt:"
   # optional: BACKUP_PING_URL="https://hc-ping.com/<id>"  (alerts when a night is missed)
   ```
5. Schedule the nightly backup and the monthly restore test in root's crontab (`crontab -e`). Adjust `/opt/acp` to where the repository is checked out:
   ```
   30 2 * * * /opt/acp/deploy/backup/backup.sh >> /var/log/acp-backup.log 2>&1
   0 4 2 * *  /opt/acp/deploy/backup/restore-test.sh >> /var/log/acp-backup.log 2>&1
   ```
6. Run `deploy/backup/backup.sh` once by hand and check that the file appears with `rclone ls acp-crypt:daily/`.

## Monthly restore test

`deploy/backup/restore-test.sh` runs on the 2nd of each month. It:

- downloads the newest dump;
- restores it into a throwaway PostgreSQL container (never the live database);
- counts users, syllabi, frozen PDFs and audit entries;
- checks every frozen PDF against its stored SHA-256.

Read its lines in `/var/log/acp-backup.log`. It ends with `restore test passed`. Note the date and result in the IQAC register.

To test a particular dump: `deploy/backup/restore-test.sh acp-2026-10-01.dump monthly`.

## Restoring the portal

Use this when the database is lost or damaged, or when moving to a new VPS. Plan for about 30 minutes; the portal is offline meanwhile.

1. **Stop the app** so nothing writes during the restore. On the VPS, in the repository:
   ```
   docker compose stop app
   ```
   On a new VPS instead:
   - install Docker;
   - clone the repository at the tag that was running;
   - restore `.env` from the password manager;
   - run `docker compose up -d db`. On the first start, `deploy/db-init` creates the app's database role.
2. **Fetch the dump**: the newest one, or the last good one before the damage:
   ```
   rclone lsf acp-crypt:daily/ | sort | tail -5
   rclone copy acp-crypt:daily/acp-2026-10-23.dump /root/restore/
   ```
3. **Restore it**, replacing what is in the database:
   ```
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error' \
     < /root/restore/acp-2026-10-23.dump
   ```
   The audit-log and frozen-PDF protections are database triggers. They are restored after the data, so they do not block the restore.
4. **Apply newer migrations**, in case the code is newer than the dump:
   ```
   docker compose run --rm app npm run db:deploy -w backend
   ```
5. **Start the app and check it:**
   ```
   docker compose up -d
   ```
   - Sign in as a Super Admin. Open a recently approved syllabus and download its PDF.
   - Scan the QR code on the PDF: the verification page should say **Genuine** for the downloaded file.
6. **Tell users** which day's state was restored. Changes made after that night's backup must be entered again.

If the database password changed (a new `.env`), set `APP_DB_PASSWORD` and `POSTGRES_PASSWORD` to the values the restored database expects. Alternatively, reset the app role's password from inside the db container: `ALTER ROLE acp_app PASSWORD '…'`.

## Restoring one record

To recover one deleted or damaged record without rolling back the whole portal:

1. Restore a dump into the throwaway container, as the restore test does: `restore-test.sh` with the container left running, or the same `docker run` command by hand.
2. Read the record there with `psql`.
3. Re-enter it through the portal, so the audit log records the correction.

Do not copy rows directly into the live database.
