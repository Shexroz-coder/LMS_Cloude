-- AlterTable: Add group_id to payments table
ALTER TABLE "payments" ADD COLUMN "group_id" INTEGER;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add promise fields to student_balances
ALTER TABLE "student_balances" ADD COLUMN "promise_date" DATE;
ALTER TABLE "student_balances" ADD COLUMN "promise_amount" DECIMAL(12, 2);
ALTER TABLE "student_balances" ADD COLUMN "promise_note" VARCHAR(500);
