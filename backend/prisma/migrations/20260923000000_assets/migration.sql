-- ═══════════════════════════════════════════════════════════════
-- Inventar / Jihozlar (Assets) — har filial bo'yicha
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE "AssetCategory" AS ENUM ('ROBOTICS', 'ELECTRONICS', 'COMPUTER', 'FURNITURE', 'TOOL', 'OTHER');
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'USED', 'BROKEN');

CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "unit_value" DECIMAL(14,2),
    "note" TEXT,
    "branch_id" INTEGER NOT NULL,
    "room_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assets_branch_id_idx" ON "assets"("branch_id");

ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
