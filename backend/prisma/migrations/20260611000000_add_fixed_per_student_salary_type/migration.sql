-- AlterEnum: SalaryType ga "har bir o'quvchi uchun belgilangan summa" turini qo'shish
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'FIXED_PER_STUDENT';
