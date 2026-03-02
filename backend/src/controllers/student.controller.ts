import { Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { hashPassword } from '../utils/password.utils';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';

const prisma = new PrismaClient();

// ── Studentni include bilan olish ──────────────────
const studentInclude = {
  user: {
    select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true, language: true, isActive: true, createdAt: true }
  },
  parent: {
    select: { id: true, fullName: true, phone: true, email: true }
  },
  balance: true,
  groupStudents: {
    where: { status: 'ACTIVE' as const },
    include: {
      group: {
        include: {
          course: { select: { id: true, name: true, monthlyPrice: true } },
          teacher: { include: { user: { select: { id: true, fullName: true } } } }
        }
      }
    }
  },
  _count: {
    select: { attendance: true, grades: true, payments: true, coinTransactions: true }
  }
};

// ══════════════════════════════════════════════
// GET /students — Barcha o'quvchilar
// ══════════════════════════════════════════════
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '20', search = '',
      groupId, status, hasDebt, sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Qidiruv filtr
    const where: Record<string, unknown> = {
      user: {
        isActive: true,
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ]
        })
      },
    };

    // Guruh bo'yicha filtr
    if (groupId) {
      where.groupStudents = { some: { groupId: parseInt(groupId), status: 'ACTIVE' } };
    }

    // Status bo'yicha filtr
    if (status) {
      where.status = status;
    }

    // Qarzdorlik bo'yicha filtr
    if (hasDebt === 'true') {
      where.balance = { debt: { gt: 0 } };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: studentInclude,
        skip,
        take: limitNum,
        orderBy: sortBy === 'fullName'
          ? { user: { fullName: sortOrder as 'asc' | 'desc' } }
          : { id: sortOrder as 'asc' | 'desc' },
      }),
      prisma.student.count({ where })
    ]);

    sendSuccess(res, students, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getStudents error:', err);
    sendError(res, 'O\'quvchilarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /students/:id — Bitta o'quvchi
// ══════════════════════════════════════════════
export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    // Ustoz faqat o'z o'quvchilarini ko'ra oladi
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (teacher) {
        const isMyStudent = await prisma.groupStudent.findFirst({
          where: { studentId: id, group: { teacherId: teacher.id }, status: 'ACTIVE' }
        });
        if (!isMyStudent) {
          sendError(res, 'Bu o\'quvchi sizning guruhingizda emas.', 403);
          return;
        }
      }
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        ...studentInclude,
        attendance: {
          take: 30,
          orderBy: { markedAt: 'desc' },
          include: { lesson: { select: { date: true, topic: true, group: { select: { name: true } } } } }
        },
        grades: {
          take: 20,
          orderBy: { givenAt: 'desc' },
          include: { lesson: { select: { date: true, topic: true } } }
        },
        payments: {
          take: 12,
          orderBy: { paidAt: 'desc' }
        },
        coinTransactions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { giver: { select: { fullName: true } } }
        },
        monthlyFees: {
          take: 6,
          orderBy: { month: 'desc' }
        }
      }
    });

    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    // Statistika hisoblash
    const stats = {
      totalLessons: await prisma.attendance.count({ where: { studentId: id } }),
      presentCount: await prisma.attendance.count({ where: { studentId: id, status: 'PRESENT' } }),
      lateCount: await prisma.attendance.count({ where: { studentId: id, status: 'LATE' } }),
      totalPayments: student.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      avgScore: student.grades.length > 0
        ? student.grades.reduce((sum, g) => sum + Number(g.score), 0) / student.grades.length
        : 0,
    };

    sendSuccess(res, { ...student, stats });
  } catch (err) {
    console.error('getStudentById error:', err);
    sendError(res, 'O\'quvchini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /students — Yangi o'quvchi yaratish
// ══════════════════════════════════════════════
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      fullName, phone, email, password = '12345678',
      parentPhone, birthDate, address, notes,
      discountType, discountValue,
      groupId, joinedAt, language = 'uz',
      status = 'LEAD', demoDate, leftAt, leftReason
    } = req.body;

    // Majburiy maydonlar
    if (!fullName || !phone) {
      sendError(res, 'To\'liq ism va telefon raqam kiritilishi shart.', 400);
      return;
    }

    // Telefon unikal tekshirish
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      sendError(res, 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.', 409);
      return;
    }

    // Ota-ona topish yoki yaratish
    let parentId: number | undefined;
    if (parentPhone) {
      let parentUser = await prisma.user.findUnique({ where: { phone: parentPhone } });
      if (!parentUser) {
        const parentHash = await hashPassword('12345678');
        parentUser = await prisma.user.create({
          data: {
            fullName: fullName + ' (Ota-ona)',
            phone: parentPhone,
            passwordHash: parentHash,
            role: Role.PARENT,
            language: language as 'uz' | 'ru',
          }
        });
      }
      parentId = parentUser.id;
    }

    // Foydalanuvchi + O'quvchi yaratish (transaction)
    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          phone,
          email,
          passwordHash,
          role: Role.STUDENT,
          language: language as 'uz' | 'ru',
        }
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          parentId,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          address,
          notes,
          discountType: discountType || undefined,
          discountValue: discountValue ? parseFloat(discountValue) : undefined,
          coinBalance: 0,
          status,
          ...(demoDate && { demoDate: new Date(demoDate) }),
          ...(leftAt && { leftAt: new Date(leftAt) }),
          ...(leftReason && { leftReason }),
        },
        include: studentInclude
      });

      // Balans yaratish
      await tx.studentBalance.create({
        data: { studentId: student.id, balance: 0, debt: 0 }
      });

      // Guruhga qo'shish
      if (groupId) {
        await tx.groupStudent.create({
          data: {
            groupId: parseInt(groupId),
            studentId: student.id,
            ...(joinedAt && { joinedAt: new Date(joinedAt) }),
          }
        });
      }

      return student;
    });

    sendSuccess(res, result, 'O\'quvchi muvaffaqiyatli qo\'shildi!', 201);
  } catch (err) {
    console.error('createStudent error:', err);
    sendError(res, 'O\'quvchi qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /students/:id — O'quvchini tahrirlash
// ══════════════════════════════════════════════
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const {
      fullName, phone, email, isActive,
      birthDate, address, notes,
      discountType, discountValue,
      parentPhone, language,
      status, demoDate, leftAt, leftReason
    } = req.body;

    const student = await prisma.student.findUnique({ where: { id }, include: { user: true } });
    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    // Telefon o'zgarsa unikal tekshirish
    if (phone && phone !== student.user.phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        sendError(res, 'Bu telefon raqam boshqa foydalanuvchida bor.', 409);
        return;
      }
    }

    // Ota-ona yangilash
    let parentId = student.parentId;
    if (parentPhone) {
      let parentUser = await prisma.user.findUnique({ where: { phone: parentPhone } });
      if (!parentUser) {
        const parentHash = await hashPassword('12345678');
        parentUser = await prisma.user.create({
          data: {
            fullName: (fullName || student.user.fullName) + ' (Ota-ona)',
            phone: parentPhone,
            passwordHash: parentHash,
            role: Role.PARENT,
            language: (language as 'uz' | 'ru') || 'uz',
          }
        });
      }
      parentId = parentUser.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.userId },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
          ...(email !== undefined && { email }),
          ...(isActive !== undefined && { isActive }),
          ...(language && { language: language as 'uz' | 'ru' }),
        }
      });

      return tx.student.update({
        where: { id },
        data: {
          parentId,
          ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
          ...(address !== undefined && { address }),
          ...(notes !== undefined && { notes }),
          ...(discountType !== undefined && { discountType: discountType || null }),
          ...(discountValue !== undefined && { discountValue: discountValue ? parseFloat(discountValue) : null }),
          ...(status !== undefined && { status }),
          ...(demoDate !== undefined && { demoDate: demoDate ? new Date(demoDate) : null }),
          ...(leftAt !== undefined && { leftAt: leftAt ? new Date(leftAt) : null }),
          ...(leftReason !== undefined && { leftReason: leftReason || null }),
        },
        include: studentInclude
      });
    });

    sendSuccess(res, result, 'O\'quvchi yangilandi.');
  } catch (err) {
    console.error('updateStudent error:', err);
    sendError(res, 'O\'quvchini yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /students/:id — O'chirish (soft delete)
// ══════════════════════════════════════════════
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    // Soft delete — faqat isActive = false qilamiz
    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false }
    });

    // Barcha guruhlardan chiqarish
    await prisma.groupStudent.updateMany({
      where: { studentId: id, status: 'ACTIVE' },
      data: { status: 'LEFT' }
    });

    sendSuccess(res, null, 'O\'quvchi o\'chirildi.');
  } catch (err) {
    console.error('deleteStudent error:', err);
    sendError(res, 'O\'quvchini o\'chirishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /students/:id/groups/:groupId — Guruhga qo'shish
// ══════════════════════════════════════════════
export const addToGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id);
    const groupId = parseInt(req.params.groupId);
    const { joinedAt } = req.body; // ixtiyoriy: qo'shilgan sana

    // Guruh to'la emasmini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } }
    });

    if (!group) {
      sendError(res, 'Guruh topilmadi.', 404);
      return;
    }

    if (group._count.groupStudents >= group.maxStudents) {
      sendError(res, `Guruh to'la! Maksimal: ${group.maxStudents} ta o'quvchi.`, 400);
      return;
    }

    const joinedDate = joinedAt ? new Date(joinedAt) : new Date();

    // Allaqachon borligini tekshirish
    const existing = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId } }
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        sendError(res, 'O\'quvchi bu guruhda allaqachon bor.', 409);
        return;
      }
      // Eski yozuvni faollashtirish
      const result = await prisma.groupStudent.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', joinedAt: joinedDate }
      });
      sendSuccess(res, result, 'O\'quvchi guruhga qayta qo\'shildi.');
      return;
    }

    const result = await prisma.groupStudent.create({
      data: { groupId, studentId, joinedAt: joinedDate }
    });

    sendSuccess(res, result, 'O\'quvchi guruhga qo\'shildi!', 201);
  } catch (err) {
    console.error('addToGroup error:', err);
    sendError(res, 'Guruhga qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PATCH /students/:id/groups/:groupId/joined-at — Guruhga qo'shilgan sanani yangilash
// ══════════════════════════════════════════════
export const updateGroupJoinedAt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id);
    const groupId = parseInt(req.params.groupId);
    const { joinedAt } = req.body;

    if (!joinedAt) {
      sendError(res, 'joinedAt sanasi kiritilishi shart.', 400);
      return;
    }

    const gs = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId } }
    });

    if (!gs) {
      sendError(res, 'O\'quvchi bu guruhda topilmadi.', 404);
      return;
    }

    const result = await prisma.groupStudent.update({
      where: { id: gs.id },
      data: { joinedAt: new Date(joinedAt) }
    });

    sendSuccess(res, result, 'O\'qishni boshlagan sana yangilandi!');
  } catch (err) {
    console.error('updateGroupJoinedAt error:', err);
    sendError(res, 'Sanani yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /students/:id/groups/:groupId — Guruhdan chiqarish
// ══════════════════════════════════════════════
export const removeFromGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id);
    const groupId = parseInt(req.params.groupId);

    await prisma.groupStudent.updateMany({
      where: { studentId, groupId, status: 'ACTIVE' },
      data: { status: 'LEFT' }
    });

    sendSuccess(res, null, 'O\'quvchi guruhdan chiqarildi.');
  } catch (err) {
    console.error('removeFromGroup error:', err);
    sendError(res, 'Guruhdan chiqarishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /students/:id/attendance-stats
// ══════════════════════════════════════════════
export const getAttendanceStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id);
    const { month } = req.query as { month?: string };

    const startDate = month ? new Date(month + '-01') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const [total, present, late, absent, excused] = await Promise.all([
      prisma.attendance.count({ where: { studentId, lesson: { date: { gte: startDate, lte: endDate } } } }),
      prisma.attendance.count({ where: { studentId, status: 'PRESENT', lesson: { date: { gte: startDate, lte: endDate } } } }),
      prisma.attendance.count({ where: { studentId, status: 'LATE', lesson: { date: { gte: startDate, lte: endDate } } } }),
      prisma.attendance.count({ where: { studentId, status: 'ABSENT', lesson: { date: { gte: startDate, lte: endDate } } } }),
      prisma.attendance.count({ where: { studentId, status: 'EXCUSED', lesson: { date: { gte: startDate, lte: endDate } } } }),
    ]);

    sendSuccess(res, {
      total, present, late, absent, excused,
      rate: total > 0 ? Math.round(((present + late) / total) * 100) : 0
    });
  } catch (err) {
    console.error('getAttendanceStats error:', err);
    sendError(res, 'Davomat statistikasini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /students/debtors — Qarzdorlar ro'yxati
// ══════════════════════════════════════════════
export const getDebtors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const debtors = await prisma.student.findMany({
      where: { balance: { debt: { gt: 0 } }, user: { isActive: true } },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { group: { select: { name: true } } }
        }
      },
      orderBy: { balance: { debt: 'desc' } }
    });

    const totalDebt = debtors.reduce((sum, d) => sum + Number(d.balance?.debt || 0), 0);

    sendSuccess(res, { debtors, totalDebt, count: debtors.length });
  } catch (err) {
    console.error('getDebtors error:', err);
    sendError(res, 'Qarzdorlarni olishda xato.', 500);
  }
};
