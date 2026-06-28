#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nightly Postgres backup: pg_dump from the running container → gzip → local
# file (last 7 kept) → optional S3 upload.
#
# Self-hosting Postgres means YOU own backups. Wire into cron on the EC2 box:
#   crontab -e
#   0 3 * * * /home/ubuntu/rbac-config-service/deploy/backup-postgres.sh >> /home/ubuntu/pg-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env.prod; set +a

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="$HOME/pg-backups"
OUT_FILE="$OUT_DIR/rbac_db-$STAMP.sql.gz"
mkdir -p "$OUT_DIR"

echo "==> Dumping ${DB_NAME:-rbac_db} → $OUT_FILE"
docker exec rbac_db pg_dump -U "$DB_USER" "${DB_NAME:-rbac_db}" | gzip > "$OUT_FILE"

# Retain only the 7 most recent local dumps.
ls -1t "$OUT_DIR"/rbac_db-*.sql.gz | tail -n +8 | xargs -r rm -f

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "==> Uploading to $BACKUP_S3_BUCKET"
  aws s3 cp "$OUT_FILE" "$BACKUP_S3_BUCKET/"
fi

echo "==> Backup complete"
