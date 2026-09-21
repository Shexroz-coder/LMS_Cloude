-- ═══════════════════════════════════════════════════════════════
-- Filialga ko'chirish (rejalashtirilgan — yangi oydan kuchga kiradi)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "students" ADD COLUMN "pending_branch_id" INTEGER;
ALTER TABLE "students" ADD COLUMN "branch_transfer_at" TIMESTAMP(3);

ALTER TABLE "groups" ADD COLUMN "pending_branch_id" INTEGER;
ALTER TABLE "groups" ADD COLUMN "branch_transfer_at" TIMESTAMP(3);
