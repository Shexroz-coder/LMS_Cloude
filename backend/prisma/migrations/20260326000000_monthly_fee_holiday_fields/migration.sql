-- MonthlyFee jadvaliga dam olish kunlari bilan bog'liq yangi ustunlar
ALTER TABLE "monthly_fees" ADD COLUMN "standard_lessons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "monthly_fees" ADD COLUMN "holiday_lessons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "monthly_fees" ADD COLUMN "adjusted_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "monthly_fees" ADD COLUMN "holiday_credit" DECIMAL(12, 2) NOT NULL DEFAULT 0;
