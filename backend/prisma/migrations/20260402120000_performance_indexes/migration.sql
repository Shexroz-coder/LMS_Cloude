-- Performance indexlari — sekin so'rovlarni tezlashtirish uchun

-- Lesson: date va groupId bo'yicha qidirish (eng ko'p ishlatiladigan)
CREATE INDEX IF NOT EXISTS "lessons_group_id_date_idx" ON "lessons"("group_id", "date");
CREATE INDEX IF NOT EXISTS "lessons_date_idx" ON "lessons"("date");
CREATE INDEX IF NOT EXISTS "lessons_status_idx" ON "lessons"("status");

-- Attendance: o'quvchi davomati tarixi
CREATE INDEX IF NOT EXISTS "attendance_student_id_idx" ON "attendance"("student_id");

-- Payment: oylik daromad va o'quvchi to'lov tarixi
CREATE INDEX IF NOT EXISTS "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX IF NOT EXISTS "payments_student_paid_at_idx" ON "payments"("student_id", "paid_at");

-- Expense: oylik xarajat so'rovlari
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses"("date");

-- CoinTransaction: o'quvchi coin tarixi
CREATE INDEX IF NOT EXISTS "coin_transactions_student_id_idx" ON "coin_transactions"("student_id");
CREATE INDEX IF NOT EXISTS "coin_transactions_created_at_idx" ON "coin_transactions"("created_at");

-- Notification: foydalanuvchi bildirish noma lari
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- Group: status va ustoz bo'yicha qidirish
CREATE INDEX IF NOT EXISTS "groups_status_idx" ON "groups"("status");
CREATE INDEX IF NOT EXISTS "groups_teacher_id_idx" ON "groups"("teacher_id");

-- GroupStudent: o'quvchining barcha guruhlari
CREATE INDEX IF NOT EXISTS "group_students_student_id_idx" ON "group_students"("student_id");
