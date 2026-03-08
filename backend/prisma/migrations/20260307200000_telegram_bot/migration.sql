-- Telegram bot integration: User modeliga telegram maydonlari qo'shish
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" VARCHAR(100) UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_username" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_linked_at" TIMESTAMP(3);

-- Telegram OTP sessiyalari jadvali
CREATE TABLE IF NOT EXISTS "telegram_sessions" (
  "id" SERIAL PRIMARY KEY,
  "telegram_chat_id" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "otp" VARCHAR(6) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telegram_sessions_phone_fkey" FOREIGN KEY ("phone") REFERENCES "users"("phone") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "telegram_sessions_telegram_chat_id_idx" ON "telegram_sessions"("telegram_chat_id");
CREATE INDEX IF NOT EXISTS "telegram_sessions_phone_idx" ON "telegram_sessions"("phone");
