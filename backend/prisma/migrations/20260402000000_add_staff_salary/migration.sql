-- CreateTable: staff_salaries — ustoz bo'lmagan xodimlar uchun ish haqi
CREATE TABLE IF NOT EXISTS "staff_salaries" (
    "id"         SERIAL NOT NULL,
    "user_id"    INTEGER NOT NULL,
    "month"      DATE NOT NULL,
    "amount"     DECIMAL(12,2) NOT NULL,
    "note"       VARCHAR(500),
    "position"   VARCHAR(100),
    "status"     "SalaryStatus" NOT NULL DEFAULT 'PAID',
    "paid_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_by_id" INTEGER,

    CONSTRAINT "staff_salaries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "staff_salaries"
    ADD CONSTRAINT "staff_salaries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_salaries"
    ADD CONSTRAINT "staff_salaries_paid_by_id_fkey"
    FOREIGN KEY ("paid_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
