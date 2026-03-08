#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Robotic Edu LMS — Avtomatik Backup Script
# ══════════════════════════════════════════════════════════

set -e

BACKUP_DIR="/opt/backups"
PROJECT_DIR="/opt/robotic-edu"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "🔄 Robotic Edu LMS backup boshlanmoqda..."
echo "📅 Vaqt: $(date)"

# 1. Database backup
echo "📦 Database backup qilinmoqda..."
docker compose -f $PROJECT_DIR/docker-compose.yml exec -T postgres \
  pg_dump -U lms_user lms_robotic | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

if [ $? -eq 0 ]; then
  DB_SIZE=$(ls -lh $BACKUP_DIR/db_$TIMESTAMP.sql.gz | awk '{print $5}')
  echo "✅ Database backup tayyor: $DB_SIZE"
else
  echo "❌ Database backup xatosi!"
  exit 1
fi

# 2. Uploads backup
echo "📁 Uploads backup qilinmoqda..."
docker cp lms_backend:/app/uploads - 2>/dev/null | gzip > $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz

if [ $? -eq 0 ]; then
  UPL_SIZE=$(ls -lh $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz | awk '{print $5}')
  echo "✅ Uploads backup tayyor: $UPL_SIZE"
else
  echo "⚠️  Uploads backup bo'sh yoki xato (davom etilmoqda)"
fi

# 3. Eski backuplarni tozalash
echo "🗑️  ${RETENTION_DAYS} kundan eski backuplar tozalanmoqda..."
DELETED=$(find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "   $DELETED ta eski fayl o'chirildi"

# 4. Natija
echo ""
echo "═══════════════════════════════════════"
echo "✅ BACKUP MUVAFFAQIYATLI YAKUNLANDI"
echo "═══════════════════════════════════════"
echo "📦 DB:      $BACKUP_DIR/db_$TIMESTAMP.sql.gz ($DB_SIZE)"
echo "📁 Uploads: $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"
echo "📊 Jami backuplar: $(ls $BACKUP_DIR/*.gz 2>/dev/null | wc -l) ta"
echo "💾 Backup hajmi:   $(du -sh $BACKUP_DIR | awk '{print $1}')"
echo ""
