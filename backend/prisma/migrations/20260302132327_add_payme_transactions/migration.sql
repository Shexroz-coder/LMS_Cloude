/*
  Warnings:

  - You are about to drop the column `is_read` on the `messages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "messages" DROP COLUMN "is_read";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider" VARCHAR(50),
ADD COLUMN     "provider_order_id" VARCHAR(200),
ADD COLUMN     "transaction_id" VARCHAR(200);

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "payment_due_day" INTEGER,
ADD COLUMN     "payment_remind_days_before" INTEGER DEFAULT 3;
