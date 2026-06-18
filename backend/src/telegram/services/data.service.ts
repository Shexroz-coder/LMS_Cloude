/**
 * Telegram bot uchun Prisma querylar
 * Student va Parent ma'lumotlarini olish
 */
import prisma from '../../lib/prisma';
import { phoneVariants } from '../../utils/phone.utils';

// ─── Foydalanuvchini telegramChatId bo'yicha topish ──────
export async function getUserByChatId(chatId: string) {
  return prisma.user.findUnique({
    where: { telegramChatId: chatId },
    include: {
      student: {
        include: {
          balance: true,
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: {
              group: {
                include: {
                  course: { select: { name: true, monthlyPrice: true } },
                  teacher: { include: { user: { select: { fullName: true } } } },
                  schedules: true,
                }
              }
            }
          }
        }
      }
    }
  });
}

// ─── Telefon raqam bo'yicha foydalanuvchi topish ──────────
// phoneVariants orqali barcha mumkin bo'lgan formatlarni tekshiradi
export async function getUserByPhone(phone: string) {
  const variants = phoneVariants(phone);
  return prisma.user.findFirst({
    where: { phone: { in: variants } },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      telegramChatId: true,
    },
  });
}

// ─── Telegram chat ID ni foydalanuvchiga bog'lash ─────────
export async function linkTelegramAccount(phone: string, chatId: string, username?: string) {
  // 1. Agar bu chatId allaqachon boshqa userga ulangan bo'lsa — avval tozalash
  const existingWithChatId = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
  });
  if (existingWithChatId && existingWithChatId.phone !== phone) {
    await prisma.user.update({
      where: { id: existingWithChatId.id },
      data: { telegramChatId: null, telegramUsername: null, telegramLinkedAt: null },
    });
  }

  // 2. Agar bu phone boshqa chatId ga ulangan bo'lsa — tozalash
  const targetUser = await prisma.user.findUnique({ where: { phone } });
  if (targetUser && targetUser.telegramChatId && targetUser.telegramChatId !== chatId) {
    // Eski qurilmadagi ulanishni bekor qilish
  }

  // 3. Yangi ulanishni saqlash
  return prisma.user.update({
    where: { phone },
    data: {
      telegramChatId: chatId,
      telegramUsername: username || null,
      telegramLinkedAt: new Date(),
    }
  });
}

// ─── OTP yaratish va saqlash ──────────────────────────────
export async function createOtpSession(chatId: string, phone: string, otp: string) {
  // Eski sessiyalarni tozalash
  await prisma.telegramSession.deleteMany({ where: { telegramChatId: chatId } });

  return prisma.telegramSession.create({
    data: {
      telegramChatId: chatId,
      phone,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 daqiqa
    }
  });
}

// ─── OTP tekshirish ───────────────────────────────────────
export async function verifyOtp(chatId: string, otp: string) {
  const session = await prisma.telegramSession.findFirst({
    where: {
      telegramChatId: chatId,
      otp,
      expiresAt: { gt: new Date() },
    }
  });

  if (session) {
    // Sessiyani tozalash
    await prisma.telegramSession.deleteMany({ where: { telegramChatId: chatId } });
  }

  return session;
}

// ─── Ota-onaning bolalari ─────────────────────────────────
export async function getParentChildren(userId: number) {
  return prisma.student.findMany({
    where: { parentId: userId },
    include: {
      user: { select: { fullName: true, phone: true } },
      balance: true,
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: {
          group: {
            include: {
              course: { select: { name: true } },
              teacher: { include: { user: { select: { fullName: true } } } },
            }
          }
        }
      }
    }
  });
}

// ─── Bugungi darslar (Schedule asosida) ───────────────────
export async function getTodaySchedule(studentId: number) {
  const todayDay = new Date().getDay();

  const groupStudents = await prisma.groupStudent.findMany({
    where: { studentId, status: 'ACTIVE' },
    include: {
      group: {
        include: {
          course: { select: { name: true } },
          teacher: { include: { user: { select: { fullName: true } } } },
          schedules: {
            where: { daysOfWeek: { has: todayDay } },
          },
        }
      }
    }
  });

  return groupStudents
    .flatMap(gs =>
      gs.group.schedules.map(sc => ({
        groupName: gs.group.name,
        courseName: gs.group.course.name,
        teacherName: gs.group.teacher.user.fullName,
        startTime: sc.startTime,
        endTime: sc.endTime,
        room: sc.room,
      }))
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ─── Davomat tarixi (oxirgi 20 ta) ────────────────────────
export async function getAttendanceHistory(studentId: number, limit = 20) {
  return prisma.attendance.findMany({
    where: { studentId },
    take: limit,
    orderBy: { lesson: { date: 'desc' } },
    include: {
      lesson: {
        include: {
          group: {
            include: {
              course: { select: { name: true } },
            }
          }
        }
      }
    }
  });
}


// ─── To'lov holati ────────────────────────────────────────
export async function getPaymentInfo(studentId: number) {
  const [balance, recentPayments] = await Promise.all([
    prisma.studentBalance.findUnique({ where: { studentId } }),
    prisma.payment.findMany({
      where: { studentId, isDeleted: false },
      take: 10,
      orderBy: { paidAt: 'desc' },
    })
  ]);

  return { balance, recentPayments };
}

// ─── Tanga (Coin) balans va tarixi ────────────────────────
export async function getCoinInfo(studentId: number) {
  const [student, transactions] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { coinBalance: true },
    }),
    prisma.coinTransaction.findMany({
      where: { studentId },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
  ]);

  return {
    balance: student?.coinBalance || 0,
    transactions,
  };
}

// ─── O'quvchi profili ─────────────────────────────────────
export async function getStudentProfile(studentId: number) {
  return prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { fullName: true, phone: true, createdAt: true } },
      balance: true,
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: {
          group: {
            include: {
              course: { select: { name: true } },
              teacher: { include: { user: { select: { fullName: true } } } },
              schedules: true,
            }
          }
        }
      }
    }
  });
}

// ─── Haftalik jadval (barcha kunlar) ──────────────────────
export async function getWeeklySchedule(studentId: number) {
  const groupStudents = await prisma.groupStudent.findMany({
    where: { studentId, status: 'ACTIVE' },
    include: {
      group: {
        include: {
          course: { select: { name: true } },
          teacher: { include: { user: { select: { fullName: true } } } },
          schedules: true,
        }
      }
    }
  });

  // Hafta kunlari bo'yicha guruhlash
  const weekly: Record<number, Array<{
    groupName: string; courseName: string; teacherName: string;
    startTime: string; endTime: string; room: string | null;
  }>> = {};

  for (let d = 0; d <= 6; d++) weekly[d] = [];

  for (const gs of groupStudents) {
    for (const sc of gs.group.schedules) {
      for (const day of sc.daysOfWeek) {
        weekly[day].push({
          groupName: gs.group.name,
          courseName: gs.group.course.name,
          teacherName: gs.group.teacher.user.fullName,
          startTime: sc.startTime,
          endTime: sc.endTime,
          room: sc.room,
        });
      }
    }
  }

  // Har bir kunni vaqt bo'yicha tartiblash
  for (const d of Object.keys(weekly)) {
    weekly[Number(d)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return weekly;
}

// ─── Davomat statistikasi ─────────────────────────────────
export async function getAttendanceStats(studentId: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [allTime, thisMonth] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId },
      _count: true,
    }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: {
        studentId,
        lesson: { date: { gte: monthStart, lte: monthEnd } },
      },
      _count: true,
    }),
  ]);

  const calcStats = (data: Array<{ status: string; _count: number }>) => {
    const total = data.reduce((s, d) => s + d._count, 0);
    const present = data.filter(d => d.status === 'PRESENT').reduce((s, d) => s + d._count, 0);
    const late = data.filter(d => d.status === 'LATE').reduce((s, d) => s + d._count, 0);
    const absent = data.filter(d => d.status === 'ABSENT').reduce((s, d) => s + d._count, 0);
    const excused = data.filter(d => d.status === 'EXCUSED').reduce((s, d) => s + d._count, 0);
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, excused, rate };
  };

  return {
    allTime: calcStats(allTime),
    thisMonth: calcStats(thisMonth),
  };
}

// ─── Leaderboard ──────────────────────────────────────────
export async function getLeaderboard(limit = 10) {
  const students = await prisma.student.findMany({
    where: { user: { isActive: true } },
    include: {
      user: { select: { fullName: true } },
    },
    orderBy: { coinBalance: 'desc' },
    take: limit,
  });

  return students.map((s, i) => ({
    rank: i + 1,
    id: s.id,
    fullName: s.user.fullName,
    coinBalance: s.coinBalance,
  }));
}

// ─── O'quvchining coin rank'i ─────────────────────────────
export async function getStudentRank(studentId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { coinBalance: true },
  });
  if (!student) return null;

  const rank = await prisma.student.count({
    where: {
      coinBalance: { gt: student.coinBalance },
      user: { isActive: true },
    },
  });

  return { rank: rank + 1, balance: student.coinBalance };
}

// ─── To'lov kalkulyatsiyasi ───────────────────────────────
export async function getPaymentCalculation(studentId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      balance: true,
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: {
          group: {
            include: {
              course: { select: { name: true, monthlyPrice: true } },
              schedules: true,
            }
          }
        }
      }
    }
  });

  if (!student) return null;

  const groups = student.groupStudents.map(gs => ({
    groupName: gs.group.name,
    courseName: gs.group.course.name,
    monthlyPrice: Number(gs.group.course.monthlyPrice),
    daysPerWeek: gs.group.schedules.reduce((s: number, sc: any) => s + sc.daysOfWeek.length, 0),
  }));

  const totalMonthly = groups.reduce((s, g) => s + g.monthlyPrice, 0);
  const balance = Number(student.balance?.balance || 0);
  const debt = Number(student.balance?.debt || 0);

  // Chegirma
  let discountText = '';
  if (student.discountType && student.discountValue) {
    const val = Number(student.discountValue);
    discountText = student.discountType === 'PERCENTAGE' ? `${val}%` : `${val} so'm`;
  }

  return {
    groups,
    totalMonthly,
    balance,
    debt,
    discountText,
    discountType: student.discountType,
    discountValue: student.discountValue ? Number(student.discountValue) : 0,
  };
}

// ─── Bildirishnomalar ─────────────────────────────────────
export async function getNotifications(userId: number, limit = 10) {
  return prisma.notification.findMany({
    where: { userId },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUnreadNotificationCount(userId: number) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

// ─── Bot statistikasi (admin uchun) ────────────────────────
export async function getBotStats() {
  const [totalLinked, students, parents, totalStudents, totalParents] = await Promise.all([
    prisma.user.count({ where: { telegramChatId: { not: null } } }),
    prisma.user.count({ where: { telegramChatId: { not: null }, role: 'STUDENT' } }),
    prisma.user.count({ where: { telegramChatId: { not: null }, role: 'PARENT' } }),
    prisma.student.count({ where: { user: { isActive: true } } }),
    prisma.user.count({ where: { role: 'PARENT', isActive: true } }),
  ]);

  return { totalLinked, students, parents, totalStudents, totalParents };
}

// ─── Parolni Telegram orqali o'zgartirish ────────────────
export async function changePasswordViaTelegram(chatId: string, newPasswordHash: string) {
  return prisma.user.update({
    where: { telegramChatId: chatId },
    data: { passwordHash: newPasswordHash },
    select: { id: true, fullName: true, role: true },
  });
}

// ─── Akkauntdan chiqish (logout) ──────────────────────────
export async function unlinkTelegramAccount(chatId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true, phone: true, fullName: true, role: true },
  });

  if (!user) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
    },
  });

  return user;
}

// ─── Farzand ismi va telefon raqami bo'yicha ota-onani topish ──
// Endi tasdiqlash kodi kerak emas — faqat ism + telefon to'g'ri bo'lsa kirish mumkin
export async function findParentByChildInfo(childName: string, childPhone: string) {
  // Farzandni telefon raqami bo'yicha izlash
  const childUser = await getUserByPhone(childPhone);
  if (!childUser) return null;

  // Bu user STUDENT bo'lishi kerak
  if (childUser.role !== 'STUDENT') return null;

  // Ism tekshirish (kichik harfda solishtirish, bo'sh joylarni tozalash)
  const normalizedInput = childName.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedDb = childUser.fullName.trim().toLowerCase().replace(/\s+/g, ' ');

  if (normalizedInput !== normalizedDb) return null;

  // Studentni topish va parentId olish
  const student = await prisma.student.findUnique({
    where: { userId: childUser.id },
    include: {
      parent: {
        select: { id: true, phone: true, fullName: true, role: true, isActive: true, telegramChatId: true },
      },
    },
  });

  if (!student) return null;

  // Agar student ga parent biriktirilgan bo'lsa — shu parentni qaytarish
  if (student.parent) {
    return {
      parent: student.parent,
      childName: childUser.fullName,
      studentId: student.id,
    };
  }

  // Agar parent yo'q bo'lsa — chatId dagi userni PARENT sifatida izlash
  // yoki null qaytarish (admin qo'lda parent biriktirishi kerak)
  return null;
}

// ─── Ota-onani telefon + ism bo'yicha topish (tasdiqlash kodsiz) ──
// Bir nechta bolaga bitta parent ulangan bo'lishi mumkin
export async function findParentByPhone(parentPhone: string) {
  const parentUser = await getUserByPhone(parentPhone);
  if (!parentUser) return null;
  if (parentUser.role !== 'PARENT') return null;

  // Bu parentning barcha bolalarini topish
  const children = await prisma.student.findMany({
    where: { parentId: parentUser.id },
    include: {
      user: { select: { fullName: true, phone: true } },
    },
  });

  return {
    parent: parentUser,
    children: children.map(c => ({
      studentId: c.id,
      fullName: c.user.fullName,
      phone: c.user.phone,
    })),
  };
}

// ─── O'qituvchi guruhlari va o'quvchilar (Coin berish uchun) ─
export async function getTeacherGroupsWithStudents(teacherId: number) {
  return prisma.group.findMany({
    where: { teacherId, status: 'ACTIVE' },
    include: {
      course: { select: { name: true } },
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: {
          student: {
            include: {
              user: { select: { fullName: true } },
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' },
  });
}

// ─── Coin berish (o'qituvchi tomonidan) ───────────────────
export async function giveCoinToStudent(
  givenByUserId: number,
  studentId: number,
  amount: number,
  reason: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.coinTransaction.create({
      data: {
        studentId,
        givenBy: givenByUserId,
        amount,
        reason,
        type: 'REWARD',
      },
    });
    await tx.student.update({
      where: { id: studentId },
      data: { coinBalance: { increment: amount } },
    });
    return tx.student.findUnique({
      where: { id: studentId },
      select: { coinBalance: true, user: { select: { fullName: true } } },
    });
  });
}

// ─── Boshqa raqam bilan tezkor login (re-link) ───────────
export async function relinkTelegramAccount(phone: string, chatId: string, username?: string) {
  // Avval eski chat ID ni tozalash (agar boshqa user ulangan bo'lsa)
  const existingLink = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
  });
  if (existingLink) {
    await prisma.user.update({
      where: { id: existingLink.id },
      data: { telegramChatId: null, telegramUsername: null, telegramLinkedAt: null },
    });
  }

  // Yangi raqam bilan ulash
  return linkTelegramAccount(phone, chatId, username);
}
