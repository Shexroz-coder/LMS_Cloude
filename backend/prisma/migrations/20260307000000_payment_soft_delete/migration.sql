-- AlterTable: Payment modeliga soft-delete maydonlari
ALTER TABLE "payments" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "deleted_by" INTEGER;
ALTER TABLE "payments" ADD COLUMN "delete_reason" VARCHAR(500);
