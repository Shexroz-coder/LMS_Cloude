-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('LEAD', 'DEMO', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PDF', 'VIDEO', 'IMAGE', 'FILE', 'LINK');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'RENT', 'UTILITIES', 'SUPPLIES', 'FURNITURE', 'MARKETING', 'EQUIPMENT', 'OTHER');

-- AlterTable
ALTER TABLE "students" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'LEAD',
ADD COLUMN "demo_date" DATE,
ADD COLUMN "left_at" DATE,
ADD COLUMN "left_reason" VARCHAR(500);

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "category",
ADD COLUMN "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "lesson_materials" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "type" "MaterialType" NOT NULL DEFAULT 'LINK',
    "title" VARCHAR(200) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "added_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_materials_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
