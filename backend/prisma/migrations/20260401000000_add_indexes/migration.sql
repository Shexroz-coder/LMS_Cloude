-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_parent_id_idx" ON "students"("parent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_students_status_idx" ON "group_students"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_student_id_idx" ON "payments"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_is_deleted_idx" ON "payments"("is_deleted");
