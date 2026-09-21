-- ═══════════════════════════════════════════════════════════════
-- Filial mas'uli (ustoz-menejer) + per-user ruxsatlar
-- ═══════════════════════════════════════════════════════════════

-- Foydalanuvchi qaysi filialni boshqaradi (mas'ul)
ALTER TABLE "users" ADD COLUMN "managed_branch_id" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_managed_branch_id_fkey"
    FOREIGN KEY ("managed_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-user ruxsatlar
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "perm_key" VARCHAR(100) NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_permissions_user_id_perm_key_key" ON "user_permissions"("user_id", "perm_key");
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
