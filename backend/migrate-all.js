/**
 * Barcha yangi maydonlar uchun migration skripti
 * Mac terminalida ishga tushirish:
 *   cd backend && node migrate-all.js
 *
 * Bu skript quyidagi o'zgarishlarni qo'shadi:
 *  1. Chat tizimi (MessageType enum, chat_participants, messages)
 *  2. Student: payment_due_day, payment_remind_days_before
 *  3. Payment: transaction_id, provider, provider_order_id
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL .env da topilmadi');
  process.exit(1);
}

const sql = `
-- =============================================
-- 1. Chat tizimi — MessageType enum
-- =============================================
DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Chats jadvaliga yangi ustunlar
ALTER TABLE "chats"
  ADD COLUMN IF NOT EXISTS "last_message" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP(3);

-- ChatParticipants jadvaliga lastReadAt
ALTER TABLE "chat_participants"
  ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);

-- Messages jadvaliga yangi ustunlar
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "file_name" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "duration" INTEGER;

-- Cascade delete uchun foreign key yangilash
ALTER TABLE "chat_participants"
  DROP CONSTRAINT IF EXISTS "chat_participants_chat_id_fkey";
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants"
  DROP CONSTRAINT IF EXISTS "chat_participants_user_id_fkey";
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  DROP CONSTRAINT IF EXISTS "messages_chat_id_fkey";
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- 2. Student — to'lov muddati maydonlari
-- =============================================
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "payment_due_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "payment_remind_days_before" INTEGER DEFAULT 3;

-- =============================================
-- 3. Payment — online to'lov maydonlari
-- =============================================
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "transaction_id" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "provider_order_id" VARCHAR(200);
`;

// Temp SQL file
const tmpFile = path.join(__dirname, 'tmp_migration_all.sql');
fs.writeFileSync(tmpFile, sql);

try {
  console.log('🔄 Migration ishga tushirilmoqda...');
  console.log('   Chat tizimi + Student to\'lov muddati + Payment online maydonlari');
  // Parse connection URL
  const url = new URL(DB_URL);
  const env = {
    ...process.env,
    PGPASSWORD: url.password || '',
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: url.username,
    PGDATABASE: url.pathname.replace('/', ''),
  };
  execSync(`psql -f "${tmpFile}"`, { env, stdio: 'inherit' });
  console.log('');
  console.log('✅ Migration muvaffaqiyatli bajarildi!');
  console.log('');
  console.log('Keyingi qadamlar:');
  console.log('  1. npx prisma generate');
  console.log('  2. npm run dev  (backendni qayta ishga tushirish)');
  console.log('');
  console.log('.env ga quyidagilarni qo\'shing:');
  console.log('  PAYME_MERCHANT_ID=your_merchant_id');
  console.log('  PAYME_KEY=your_payme_key');
  console.log('  UZUM_MERCHANT_ID=your_merchant_id');
  console.log('  UZUM_KEY=your_uzum_key');
} catch (err) {
  console.error('❌ Migration xatosi:', err.message);
} finally {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}
