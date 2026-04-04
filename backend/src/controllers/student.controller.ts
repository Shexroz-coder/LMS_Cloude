import prisma from '../lib/prisma';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { hashPassword } from '../utils/password.utils';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';


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
    select: { attendance: true, payments: true, coinTransactions: true }
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
// GET /students/me — Joriy foydalanuvchining profili (STUDENT uchun)
// ══════════════════════════════════════════════
export const getMyStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'STUDENT') {
      sendError(res, 'Siz faqat talaba sifatida o\'z profilingizni ko\'ra olasiz.', 403);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: {
        ...studentInclude,
        attendance: {
          take: 30,
          orderBy: { markedAt: 'desc' },
          include: { lesson: { select: { date: true, topic: true, group: { select: { name: true } } } } }
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
      totalLessons: await prisma.attendance.count({ where: { studentId: student.id } }),
      presentCount: await prisma.attendance.count({ where: { studentId: student.id, status: 'PRESENT' } }),
      lateCount: await prisma.attendance.count({ where: { studentId: student.id, status: 'LATE' } }),
      totalPayments: student.payments.reduce((sum, p) => sum + Number(p.amount), 0),
    };

    sendSuccess(res, { ...student, stats });
  } catch (err) {
    console.error('getMyStudent error:', err);
    sendError(res, 'O\'z profilingizni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /students/:id — Bitta o'quvchi
// ══════════════════════════════════════════════
export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    // PARENT faqat o'z bolalarini ko'ra oladi
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id } });
      if (!myChildren.some(c => c.id === id)) {
        sendError(res, 'Siz faqat o\'z farzandingiz profilini ko\'ra olasiz.', 403);
        return;
      }
    }

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
      fullName, phone, password = '12345678',
      parentName, parentPhone, birthDate, address, notes,
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
            fullName: parentName || fullName + ' (Ota-ona)',
            phone: parentPhone,
            passwordHash: parentHash,
            role: Role.PARENT,
            language: language as 'uz' | 'ru',
          }
        });
      } else if (parentName && parentUser.fullName !== parentName) {
        // Agar ota-ona ismi o'zgargan bo'lsa — yangilash
        await prisma.user.update({
          where: { id: parentUser.id },
          data: { fullName: parentName }
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
      fullName, phone, isActive,
      birthDate, address, notes,
      discountType, discountValue,
      parentName, parentPhone, language,
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
            fullName: parentName || (fullName || student.user.fullName) + ' (Ota-ona)',
            phone: parentPhone,
            passwordHash: parentHash,
            role: Role.PARENT,
            language: (language as 'uz' | 'ru') || 'uz',
          }
        });
      } else if (parentName && parentUser.fullName !== parentName) {
        // Ota-ona ismini yangilash
        await prisma.user.update({
          where: { id: parentUser.id },
          data: { fullName: parentName }
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

    // Ownership tekshirish: STUDENT faqat o'zini, PARENT faqat o'z bolasini ko'radi
    if (req.user?.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (!myStudent || myStudent.id !== studentId) {
        sendError(res, 'Siz faqat o\'z davomatingizni ko\'ra olasiz.', 403);
        return;
      }
    }
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id } });
      if (!myChildren.some(c => c.id === studentId)) {
        sendError(res, 'Siz faqat o\'z farzandingiz davomatini ko\'ra olasiz.', 403);
        return;
      }
    }

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
// PATCH /students/:id/deactivate — O'quvchini o'chirib qo'yish (disable)
// ══════════════════════════════════════════════
export const deactivateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { leftReason, leftAt } = req.body;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, isActive: true } } },
    });

    if (!student) { sendError(res, "O'quvchi topilmadi.", 404); return; }
    if (student.status === 'INACTIVE') { sendError(res, "O'quvchi allaqachon nofaol.", 400); return; }

    await prisma.$transaction([
      // Status INACTIVE ga o'tkazish
      prisma.student.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          leftAt:     leftAt ? new Date(leftAt) : new Date(),
          leftReason: leftReason || null,
        },
      }),
      // Barcha aktiv guruhlardan chiqarish
      prisma.groupStudent.updateMany({
        where: { studentId: id, status: 'ACTIVE' },
        data:  { status: 'LEFT' },
      }),
      // user.isActive = false (lekinda login qila olmaydi)
      prisma.user.update({
        where: { id: student.userId },
        data:  { isActive: false },
      }),
    ]);

    sendSuccess(res, null, `${student.user.fullName} nofaol holatga o'tkazildi.`);
  } catch (err) {
    console.error('deactivateStudent error:', err);
    sendError(res, "O'quvchini nofaol qilishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// PATCH /students/:id/reactivate — O'quvchini qayta faollashtirish
// ══════════════════════════════════════════════
export const reactivateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, isActive: true } } },
    });

    if (!student) { sendError(res, "O'quvchi topilmadi.", 404); return; }
    if (student.status === 'ACTIVE') { sendError(res, "O'quvchi allaqachon faol.", 400); return; }

    await prisma.$transaction([
      // Status ACTIVE ga qaytarish
      prisma.student.update({
        where: { id },
        data: {
          status:     'ACTIVE',
          leftAt:     null,
          leftReason: null,
        },
      }),
      // user.isActive = true (login qila oladi)
      prisma.user.update({
        where: { id: student.userId },
        data:  { isActive: true },
      }),
    ]);

    sendSuccess(res, null, `${student.user.fullName} qayta faollashtirildi.`);
  } catch (err) {
    console.error('reactivateStudent error:', err);
    sendError(res, "O'quvchini faollashtirishda xato.", 500);
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
