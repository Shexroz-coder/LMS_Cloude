-- ═══════════════════════════════════════════════════════════════
-- Xarajatlarda valyuta — so'm va dollar
-- amount HAR DOIM so'mda (normallashtirilgan). currency/originalAmount/
-- exchangeRate — kiritilgan asl valyutani ko'rsatish uchun.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "expenses" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS';
ALTER TABLE "expenses" ADD COLUMN "original_amount" DECIMAL(14,2);
ALTER TABLE "expenses" ADD COLUMN "exchange_rate" DECIMAL(12,2);

-- amount ustunini kengaytirish (katta dollar summalari uchun)
ALTER TABLE "expenses" ALTER COLUMN "amount" TYPE DECIMAL(14,2);

-- Mavjud yozuvlar: so'mda deb belgilaymiz
UPDATE "expenses" SET "original_amount" = "amount", "currency" = 'UZS' WHERE "original_amount" IS NULL;
