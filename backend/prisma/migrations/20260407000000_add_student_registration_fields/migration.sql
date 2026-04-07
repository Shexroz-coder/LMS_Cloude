-- AlterTable: Student uchun ro'yxatdan o'tish maydonlari
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "preferred_days" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "preferred_time" VARCHAR(20);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "interested_course_id" INTEGER;
