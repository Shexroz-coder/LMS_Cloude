-- CreateTable
CREATE TABLE "payme_transactions" (
    "id" SERIAL NOT NULL,
    "payme_id" VARCHAR(200) NOT NULL,
    "order_id" VARCHAR(200) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "reason" INTEGER,
    "create_time" BIGINT NOT NULL,
    "perform_time" BIGINT,
    "cancel_time" BIGINT,
    "payment_id" INTEGER,

    CONSTRAINT "payme_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payme_transactions_payme_id_key" ON "payme_transactions"("payme_id");

-- CreateIndex
CREATE UNIQUE INDEX "payme_transactions_order_id_key" ON "payme_transactions"("order_id");

-- AddForeignKey
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
