import { PrismaClient, Role, Language } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed ma\'lumotlar kiritilmoqda...');

  const hash = await bcrypt.hash('admin123', 12);

  // Admin yaratish
  const admin = await prisma.user.upsert({
    where: { phone: '+998901234567' },
    update: {},
    create: {
      fullName: 'Super Admin',
      phone: '+998901234567',
      passwordHash: hash,
      role: Role.ADMIN,
      language: Language.uz,
      isActive: true,
    }
  });
  console.log('✅ Admin yaratildi:', admin.phone);

  // Namunali ustoz
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const teacherUser = await prisma.user.upsert({
    where: { phone: '+998901234568' },
    update: {},
    create: {
      fullName: 'Alisher Karimov',
      phone: '+998901234568',
      passwordHash: teacherHash,
      role: Role.TEACHER,
      language: Language.uz,
      isActive: true,
    }
  });

  await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      specialization: 'Robotika va Arduino',
      salaryType: 'PERCENTAGE_FROM_PAYMENT',
      salaryValue: 30,
    }
  });
  console.log('✅ Ustoz yaratildi:', teacherUser.phone);

  // Namunali ota-ona
  const parentHash = await bcrypt.hash('parent123', 12);
  const parentUser = await prisma.user.upsert({
    where: { phone: '+998901234569' },
    update: {},
    create: {
      fullName: 'Jasur Toshmatov',
      phone: '+998901234569',
      passwordHash: parentHash,
      role: Role.PARENT,
      language: Language.uz,
      isActive: true,
    }
  });
  console.log('✅ Ota-ona yaratildi:', parentUser.phone);

  // Namunali o'quvchi
  const studentHash = await bcrypt.hash('student123', 12);
  const studentUser = await prisma.user.upsert({
    where: { phone: '+998901234570' },
    update: {},
    create: {
      fullName: 'Bobur Toshmatov',
      phone: '+998901234570',
      passwordHash: studentHash,
      role: Role.STUDENT,
      language: Language.uz,
      isActive: true,
    }
  });

  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      parentId: parentUser.id,
      coinBalance: 50,
      discountType: 'PERCENTAGE',
      discountValue: 10,
    }
  });
  console.log('✅ O\'quvchi yaratildi:', studentUser.phone);

  // Namunali kurs
  const course = await prisma.course.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Robotika va Arduino',
      description: 'Robotika asoslari, Arduino dasturlash, loyiha yaratish',
      monthlyPrice: 500000,
      perLessonPrice: 50000,
      durationMonths: 6,
      isActive: true,
    }
  });
  console.log('✅ Kurs yaratildi:', course.name);

  console.log('\n🎉 Seed muvaffaqiyatli yakunlandi!');
  console.log('📋 Kirish ma\'lumotlari:');
  console.log('  Admin:   +998901234567 / admin123');
  console.log('  Ustoz:   +998901234568 / teacher123');
  console.log('  Ota-ona: +998901234569 / parent123');
  console.log('  O\'quvchi: +998901234570 / student123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
