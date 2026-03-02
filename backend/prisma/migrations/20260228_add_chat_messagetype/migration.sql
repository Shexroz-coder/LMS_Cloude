-- Chat jadvaliga yangi ustunlar qo'shish
ALTER TABLE "chats" 
  ADD COLUMN IF NOT EXISTS "last_message" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP(3);

-- ChatParticipant jadvaliga lastReadAt qo'shish
ALTER TABLE "chat_participants"
  ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);

-- MessageType enum yaratish
DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Message jadvaliga yangi ustunlar qo'shish
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "file_name" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "duration" INTEGER;

-- onDelete: Cascade uchun foreign key qayta yaratish (agar kerak bo'lsa)
-- Chat participants uchun
ALTER TABLE "chat_participants" DROP CONSTRAINT IF EXISTS "chat_participants_chat_id_fkey";
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chat_id_fkey" 
  FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants" DROP CONSTRAINT IF EXISTS "chat_participants_user_id_fkey";
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messages uchun
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_chat_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" 
  FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
