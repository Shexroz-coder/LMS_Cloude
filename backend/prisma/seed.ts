import { PrismaClient, Role, Language } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed ma\'lumotlar kiritilmoqda...\n');

  const adminHash    = await bcrypt.hash('admin123',   12);
  const teacherHash  = await bcrypt.hash('teacher123', 12);
  const studentHash  = await bcrypt.hash('student123', 12);
  const parentHash   = await bcrypt.hash('parent123',  12);

  // ── 1. ADMIN ──────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { phone: '+998901234567' },
    update: {},
    create: {
      fullName: 'Super Admin',
      phone: '+998901234567',
      passwordHash: adminHash,
      role: Role.ADMIN,
      language: Language.uz,
      isActive: true,
    }
  });
  console.log('✅ Admin:', admin.phone);

  // ── 2. USTOZLAR ───────────────────────────────────────
  const teacher1User = await prisma.user.upsert({
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
  const teacher1 = await prisma.teacher.upsert({
    where: { userId: teacher1User.id },
    update: {},
    create: {
      userId: teacher1User.id,
      specialization: 'Robotika va Arduino',
      salaryType: 'PERCENTAGE_FROM_PAYMENT',
      salaryValue: 30,
      bio: 'Robotika va Arduino bo\'yicha 5 yillik tajribaga ega.',
    }
  });
  console.log('✅ Ustoz 1:', teacher1User.fullName);

  const teacher2User = await prisma.user.upsert({
    where: { phone: '+998901234575' },
    update: {},
    create: {
      fullName: 'Nodira Yusupova',
      phone: '+998901234575',
      passwordHash: teacherHash,
      role: Role.TEACHER,
      language: Language.uz,
      isActive: true,
    }
  });
  const teacher2 = await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: {},
    create: {
      userId: teacher2User.id,
      specialization: 'Python va Sun\'iy Intellekt',
      salaryType: 'PERCENTAGE_FROM_PAYMENT',
      salaryValue: 35,
      bio: 'Python va ML bo\'yicha mutaxassis.',
    }
  });
  console.log('✅ Ustoz 2:', teacher2User.fullName);

  // ── 3. KURSLAR ────────────────────────────────────────
  const course1 = await prisma.course.upsert({
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

  const course2 = await prisma.course.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Python dasturlash',
      description: 'Python tilida dasturlash asoslari va amaliyot',
      monthlyPrice: 450000,
      perLessonPrice: 45000,
      durationMonths: 4,
      isActive: true,
    }
  });

  const course3 = await prisma.course.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Web Dizayn',
      description: 'HTML, CSS, JavaScript — zamonaviy veb saytlar yaratish',
      monthlyPrice: 400000,
      perLessonPrice: 40000,
      durationMonths: 5,
      isActive: true,
    }
  });
  console.log('✅ Kurslar yaratildi: 3 ta');

  // ── 4. GURUHLAR ───────────────────────────────────────
  const group1 = await prisma.group.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Robotika A-guruh',
      courseId: course1.id,
      teacherId: teacher1.id,
      maxStudents: 12,
      startDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      room: '101-xona',
    }
  });

  const group2 = await prisma.group.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Python B-guruh',
      courseId: course2.id,
      teacherId: teacher2.id,
      maxStudents: 15,
      startDate: new Date('2026-02-01'),
      status: 'ACTIVE',
      room: '102-xona',
    }
  });

  const group3 = await prisma.group.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Web Dizayn C-guruh',
      courseId: course3.id,
      teacherId: teacher1.id,
      maxStudents: 10,
      startDate: new Date('2026-02-15'),
      status: 'ACTIVE',
      room: '103-xona',
    }
  });
  console.log('✅ Guruhlar yaratildi: 3 ta');

  // ── 5. JADVALLAR ─────────────────────────────────────
  // Dush/Chor/Jum (1,3,5)
  await prisma.schedule.upsert({
    where: { id: 1 },
    update: {},
    create: { groupId: group1.id, daysOfWeek: [1, 3, 5], startTime: '10:00', endTime: '11:30', room: '101-xona' }
  });
  // Sesh/Pay (2,4)
  await prisma.schedule.upsert({
    where: { id: 2 },
    update: {},
    create: { groupId: group2.id, daysOfWeek: [2, 4], startTime: '14:00', endTime: '16:00', room: '102-xona' }
  });
  await prisma.schedule.upsert({
    where: { id: 3 },
    update: {},
    create: { groupId: group3.id, daysOfWeek: [1, 3], startTime: '16:00', endTime: '17:30', room: '103-xona' }
  });
  console.log('✅ Jadvallar yaratildi');

  // ── 6. OTA-ONALAR ────────────────────────────────────
  const parent1 = await prisma.user.upsert({
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

  const parent2 = await prisma.user.upsert({
    where: { phone: '+998901234574' },
    update: {},
    create: {
      fullName: 'Maftuna Rahimova',
      phone: '+998901234574',
      passwordHash: parentHash,
      role: Role.PARENT,
      language: Language.uz,
      isActive: true,
    }
  });
  console.log('✅ Ota-onalar yaratildi: 2 ta');

  // ── 7. O'QUVCHILAR ────────────────────────────────────
  const studentsData = [
    { fullName: 'Bobur Toshmatov',   phone: '+998901234570', parentId: parent1.id, discount: 10 },
    { fullName: 'Dilnoza Raximova',  phone: '+998901234571', parentId: parent2.id, discount: 0  },
    { fullName: 'Sardor Mirzayev',   phone: '+998901234572', parentId: null,       discount: 15 },
    { fullName: 'Malika Yusupova',   phone: '+998901234573', parentId: parent1.id, discount: 0  },
    { fullName: 'Jahongir Qodirov',  phone: '+998901234576', parentId: null,       discount: 5  },
    { fullName: 'Zulfiya Nazarova',  phone: '+998901234577', parentId: parent2.id, discount: 0  },
  ];

  const createdStudents: { id: number; userId: number }[] = [];

  for (const sd of studentsData) {
    const existingUser = await prisma.user.findUnique({ where: { phone: sd.phone } });

    let user = existingUser;
    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: sd.fullName,
          phone: sd.phone,
          passwordHash: studentHash,
          role: Role.STUDENT,
          language: Language.uz,
          isActive: true,
        }
      });
    }

    const existingStudent = await prisma.student.findUnique({ where: { userId: user.id } });
    let student = existingStudent;
    if (!student) {
      student = await prisma.student.create({
        data: {
          userId: user.id,
          parentId: sd.parentId,
          coinBalance: Math.floor(Math.random() * 100),
          discountType: sd.discount > 0 ? 'PERCENTAGE' : undefined,
          discountValue: sd.discount > 0 ? sd.discount : undefined,
          status: 'ACTIVE',
        }
      });

      await prisma.studentBalance.create({
        data: { studentId: student.id, balance: 0, debt: 0 }
      });
    }

    createdStudents.push({ id: student.id, userId: user.id });
  }
  console.log(`✅ O'quvchilar yaratildi: ${createdStudents.length} ta`);

  // ── 8. GURUHGA QO'SHISH ──────────────────────────────
  const groupAssignments = [
    { studentIdx: 0, groupId: group1.id },
    { studentIdx: 1, groupId: group1.id },
    { studentIdx: 2, groupId: group1.id },
    { studentIdx: 3, groupId: group2.id },
    { studentIdx: 4, groupId: group2.id },
    { studentIdx: 5, groupId: group3.id },
    { studentIdx: 2, groupId: group3.id }, // Sardor 2 ta guruhda
  ];

  for (const ga of groupAssignments) {
    const studentId = createdStudents[ga.studentIdx]?.id;
    if (!studentId) continue;

    const existing = await prisma.groupStudent.findFirst({
      where: { groupId: ga.groupId, studentId }
    });
    if (!existing) {
      await prisma.groupStudent.create({
        data: {
          groupId: ga.groupId,
          studentId,
          status: 'ACTIVE',
          joinedAt: new Date('2026-01-15'),
        }
      });
    }
  }
  console.log('✅ O\'quvchilar guruhlarga qo\'shildi');

  // ── 9. TO'LOVLAR (namuna) ──────────────────────────────
  const months = [
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    new Date('2026-03-01'),
  ];

  for (let i = 0; i < Math.min(createdStudents.length, 4); i++) {
    const student = createdStudents[i];
    for (const month of months.slice(0, 2)) {
      const existing = await prisma.payment.findFirst({
        where: { studentId: student.id, month, paymentMethod: 'CASH' }
      });
      if (!existing) {
        await prisma.payment.create({
          data: {
            studentId: student.id,
            amount: 500000,
            month,
            paymentMethod: 'CASH',
            status: 'PAID',
            paidAt: new Date(month.getTime() + 5 * 24 * 3600 * 1000), // 5 kun keyin
            note: 'Seed ma\'lumoti',
          }
        });
        // Balansni yangilash
        await prisma.studentBalance.upsert({
          where: { studentId: student.id },
          update: { balance: { increment: 500000 }, lastUpdated: new Date() },
          create: { studentId: student.id, balance: 500000, debt: 0 },
        });
      }
    }
  }
  console.log('✅ Namuna to\'lovlar kiritildi');

  // ── 10. E\'LONLAR ─────────────────────────────────────
  const announcements = [
    {
      title: 'Tizimga xush kelibsiz!',
      body: 'Robotic Edu LMS tizimi muvaffaqiyatli ishga tushirildi. Barcha o\'quvchilar va ustozlar tizimga kira oladi.',
    },
    {
      title: 'Mart oyi to\'lovlari',
      body: 'Mart oyi uchun to\'lovlar 1-10 mart kunlari amalga oshirilishi kerak. O\'z vaqtida to\'lang!',
    },
  ];

  for (let i = 0; i < announcements.length; i++) {
    const ann = announcements[i];
    await prisma.announcement.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        title: ann.title,
        body: ann.body,
        createdBy: admin.id,
        targetRoles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'],
      }
    });
  }
  console.log('✅ E\'lonlar yaratildi');

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Seed muvaffaqiyatli yakunlandi!');
  console.log('═'.repeat(50));
  console.log('\n📋 Kirish ma\'lumotlari:');
  console.log('  👑 Admin:   +998901234567  / admin123');
  console.log('  👨‍🏫 Ustoz 1: +998901234568  / teacher123');
  console.log('  👨‍🏫 Ustoz 2: +998901234575  / teacher123');
  console.log('  🎓 O\'quvchi: +998901234570  / student123');
  console.log('  👨‍👩‍👧 Ota-ona: +998901234569  / parent123');
  console.log('\n⚠️  ESLATMA: Keyingi safar backup oling:');
  console.log('  ./backup.sh');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
