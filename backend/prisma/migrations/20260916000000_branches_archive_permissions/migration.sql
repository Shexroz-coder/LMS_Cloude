-- ═══════════════════════════════════════════════════════════════
-- Filiallar, Arxivlash, FOUNDER roli, Ruxsatlar tizimi
-- ═══════════════════════════════════════════════════════════════

-- 1. FOUNDER roli
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FOUNDER';

-- 2. Filiallar jadvali
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(300),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- Standart filial (mavjud ma'lumotlar uchun)
INSERT INTO "branches" ("name", "is_active") VALUES ('Asosiy filial', true);

-- 3. Arxivlar jadvali
CREATE TABLE "archives" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "summary" JSONB,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "archives_pkey" PRIMARY KEY ("id")
);

-- 4. Ruxsatlar jadvali
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL,
    "perm_key" VARCHAR(100) NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_permissions_role_perm_key_key" ON "role_permissions"("role", "perm_key");

-- 5. branch_id ustunlari
ALTER TABLE "users"    ADD COLUMN "branch_id" INTEGER;
ALTER TABLE "students" ADD COLUMN "branch_id" INTEGER;
ALTER TABLE "groups"   ADD COLUMN "branch_id" INTEGER;
ALTER TABLE "payments" ADD COLUMN "branch_id" INTEGER;
ALTER TABLE "expenses" ADD COLUMN "branch_id" INTEGER;

-- Mavjud yozuvlarni standart filialga bog'lash
UPDATE "users"    SET "branch_id" = 1;
UPDATE "students" SET "branch_id" = 1;
UPDATE "groups"   SET "branch_id" = 1;
UPDATE "payments" SET "branch_id" = 1;
UPDATE "expenses" SET "branch_id" = 1;

-- Foreign key'lar
ALTER TABLE "users"    ADD CONSTRAINT "users_branch_id_fkey"    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "groups"   ADD CONSTRAINT "groups_branch_id_fkey"   FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. archive_id ustunlari (moliyaviy yozuvlar)
ALTER TABLE "payments"         ADD COLUMN "archive_id" INTEGER;
ALTER TABLE "expenses"         ADD COLUMN "archive_id" INTEGER;
ALTER TABLE "monthly_fees"     ADD COLUMN "archive_id" INTEGER;
ALTER TABLE "teacher_salaries" ADD COLUMN "archive_id" INTEGER;
ALTER TABLE "staff_salaries"   ADD COLUMN "archive_id" INTEGER;

-- Indekslar
CREATE INDEX "payments_archive_id_idx"         ON "payments"("archive_id");
CREATE INDEX "expenses_archive_id_idx"         ON "expenses"("archive_id");
CREATE INDEX "monthly_fees_archive_id_idx"     ON "monthly_fees"("archive_id");
CREATE INDEX "teacher_salaries_archive_id_idx" ON "teacher_salaries"("archive_id");
CREATE INDEX "staff_salaries_archive_id_idx"   ON "staff_salaries"("archive_id");
