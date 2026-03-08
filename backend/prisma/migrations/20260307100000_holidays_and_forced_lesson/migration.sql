-- Holiday modeliga yangi ustunlar
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "end_date" DATE;
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'HOLIDAY';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Lesson modeliga isForcedHoliday flag
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "is_forced_holiday" BOOLEAN NOT NULL DEFAULT false;
