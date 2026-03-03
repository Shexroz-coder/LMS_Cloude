/*
  Warnings:

  - You are about to drop the `chat_participants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "chat_participants" DROP CONSTRAINT "chat_participants_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_participants" DROP CONSTRAINT "chat_participants_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chats" DROP CONSTRAINT "chats_group_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- DropTable
DROP TABLE "chat_participants";

-- DropTable
DROP TABLE "chats";

-- DropTable
DROP TABLE "messages";

-- DropEnum
DROP TYPE "ChatType";

-- DropEnum
DROP TYPE "MessageType";
