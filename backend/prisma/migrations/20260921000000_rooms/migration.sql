-- ═══════════════════════════════════════════════════════════════
-- Xonalar (Rooms) — filial ichidagi o'quv xonalari
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rooms_branch_id_idx" ON "rooms"("branch_id");

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guruhga xona bog'lash
ALTER TABLE "groups" ADD COLUMN "room_id" INTEGER;
CREATE INDEX "groups_room_id_idx" ON "groups"("room_id");
ALTER TABLE "groups" ADD CONSTRAINT "groups_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
