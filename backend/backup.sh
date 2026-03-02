#!/bin/bash
# ═══════════════════════════════════════════════════════
# LMS Robotic — PostgreSQL Avtomatik Backup Skripti
# Ishlatish: ./backup.sh          (bir marta)
#            ./backup.sh restore  (qaytarish)
# ═══════════════════════════════════════════════════════

set -e

# .env dan DATABASE_URL o'qish
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep 'DATABASE_URL' | xargs)
fi

# Sozlamalar
BACKUP_DIR="$(dirname "$0")/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="lms_backup_${DATE}.sql"

mkdir -p "$BACKUP_DIR"

# ── BACKUP ──────────────────────────────────────────────
if [ "$1" != "restore" ]; then
  echo "📦 Backup boshlanmoqda..."

  # DATABASE_URL dan parametrlar ajratish
  # Format: postgresql://user@host:port/dbname
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:@]*\).*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

  # Default qiymatlar
  DB_HOST=${DB_HOST:-localhost}
  DB_PORT=${DB_PORT:-5432}

  echo "  🗄️  Baza: $DB_NAME"
  echo "  👤  User: $DB_USER"
  echo "  📁  Fayl: $BACKUP_DIR/$FILENAME"

  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    -F p \
    -f "$BACKUP_DIR/$FILENAME"

  # Eski backuplarni tozalash (faqat so'nggi 10 ta qolsin)
  ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | tail -n +11 | xargs -r rm

  FILESIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
  echo ""
  echo "✅ Backup muvaffaqiyatli saqlandi!"
  echo "   📁 $BACKUP_DIR/$FILENAME ($FILESIZE)"
  echo "   📋 Qaytarish uchun: ./backup.sh restore $FILENAME"

# ── RESTORE ──────────────────────────────────────────────
else
  RESTORE_FILE="$2"

  if [ -z "$RESTORE_FILE" ]; then
    echo "📋 Mavjud backuplar:"
    ls -lt "$BACKUP_DIR"/*.sql 2>/dev/null | head -10 || echo "  Backup topilmadi."
    echo ""
    echo "Ishlatish: ./backup.sh restore FAYL_NOMI"
    echo "Misol:     ./backup.sh restore lms_backup_20260302_120000.sql"
    exit 0
  fi

  # To'liq yo'l tekshirish
  if [ ! -f "$RESTORE_FILE" ]; then
    RESTORE_FILE="$BACKUP_DIR/$RESTORE_FILE"
  fi

  if [ ! -f "$RESTORE_FILE" ]; then
    echo "❌ Fayl topilmadi: $RESTORE_FILE"
    exit 1
  fi

  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:@]*\).*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  DB_HOST=${DB_HOST:-localhost}
  DB_PORT=${DB_PORT:-5432}

  echo "⚠️  DIQQAT: Bu barcha mavjud ma'lumotlarni almashtiradi!"
  read -p "Davom etasizmi? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    echo "Bekor qilindi."
    exit 0
  fi

  echo "🔄 Qaytarilmoqda: $RESTORE_FILE ..."

  psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    -f "$RESTORE_FILE"

  echo "✅ Ma'lumotlar muvaffaqiyatli qaytarildi!"
fi
