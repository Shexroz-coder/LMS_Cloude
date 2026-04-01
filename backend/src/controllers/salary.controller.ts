import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { countLessonsInMonth } from '../utils/schedule.utils';

// ─────────────────────────────────────────────────────────
// Helper: Bir o'quvchining oylik to'lov summasini hisoblash
// ─────────────────────────────────────────────────────────
function calcStudentMonthly(monthlyPrice: number, discountType?: string | null, discountValue?: number | null): number {
  if (!discountType || !discountValue) return monthlyPrice;
  if (discountType === 'PERCENTAGE') {
    return monthlyPrice * (1 - discountValue / 100);
  }
  if (discountType === 'FIXED_AMOUNT') {
    return Math.max(0, monthlyPrice - discountValue);
  }
  return monthlyPrice;
}

// ─────────────────────────────────────────────────────────
// Helper: Ustoz uchun oy bo'yicha LIVE hisob-kitob
// ─────────────────────────────────────────────────────────
async function calcTeacherSalaryForMonth(teacherId: number, year: number, month: number) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      user: { select: { fullName: true, phone: true } },
      groups: {
        where: { status: 'ACTIVE' },
        include: {
          course: { select: { name: true, monthlyPrice: true } },
          schedules: { select: { daysOfWeek: true } },
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: {
              student: {
                select: {
                  id: true,
                  discountType: true,
                  discountValue: true,
                  user: { select: { fullName: true } },
                }
              }
            }
          }
        }
      }
    }
  });

  if (!teacher) return null;

  const salaryType = teacher.salaryType || 'PERCENTAGE_FROM_PAYMENT';
  const salaryValue = Number(teacher.salaryValue || 0);

  // Oy boshlanish va tugash sanalari
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  // ── Per-group breakdown ──
  const groups = await Promise.all(teacher.groups.map(async (g) => {
    const monthlyPrice = Number(g.course.monthlyPrice);
    const scheduleLessons = await Promise.all(g.schedules.map(sc => countLessonsInMonth(year, month, sc.daysOfWeek)));
    const lessonsPerMonth = scheduleLessons.reduce((s, n) => s + n, 0);

    // Har bir guruh uchun HAQIQIY to'lovlarni olish
    const actualPayments = await prisma.payment.aggregate({
      where: {
        groupId: g.id,
        isDeleted: false,
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    });
    const actualRevenue = Number(actualPayments._sum?.amount || 0);

    const students = await Promise.all(g.groupStudents.map(async (gs) => {
      const disc = gs.student.discountType as string | null;
      const discVal = gs.student.discountValue ? Number(gs.student.discountValue) : null;
      const expectedPayment = calcStudentMonthly(monthlyPrice, disc, discVal);

      // O'quvchining shu guruh uchun HAQIQIY to'lovi
      const studentActual = await prisma.payment.aggregate({
        where: {
          studentId: gs.student.id,
          groupId: g.id,
          isDeleted: false,
          paidAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      });

      return {
        id: gs.student.id,
        fullName: gs.student.user.fullName,
        monthlyPrice,
        discountType: disc,
        discountValue: discVal,
        expectedPayment: Math.round(expectedPayment),
        actualPayment: Number(studentActual._sum?.amount || 0),
      };
    }));

    const groupExpectedRevenue = students.reduce((s, st) => s + st.expectedPayment, 0);

    // Per-group salary hisoblash — HAQIQIY TO'LOVLARDAN
    let groupSalary = 0;
    if (salaryType === 'PERCENTAGE_FROM_PAYMENT') {
      // Ustoz faqat haqiqiy kelgan to'lovlardan foiz oladi
      groupSalary = Math.round(actualRevenue * salaryValue / 100);
    } else {
      // PER_LESSON_HOUR — lessonsPerMonth * salaryValue
      groupSalary = Math.round(lessonsPerMonth * salaryValue);
    }

    return {
      id: g.id,
      groupId: g.id,
      name: g.name,
      groupName: g.name,
      courseName: g.course.name,
      lessonsPerMonth,
      studentCount: students.length,
      groupRevenue: groupExpectedRevenue,
      actualRevenue,
      revenue: actualRevenue, // endi haqiqiy to'lovlar
      salary: groupSalary,
      students,
    };
  }));

  const totalExpectedRevenue = groups.reduce((s, g) => s + g.groupRevenue, 0);
  const totalActualRevenue = groups.reduce((s, g) => s + g.actualRevenue, 0);
  const totalRevenue = totalActualRevenue; // endi haqiqiy to'lovlar asosida
  const totalStudents = groups.reduce((s, g) => s + g.studentCount, 0);

  // ── Salary calculation ──
  let calculatedSalary = 0;
  let totalHours = 0;

  if (salaryType === 'PERCENTAGE_FROM_PAYMENT') {
    // Har bir guruhning alohida salary ini qo'shamiz (guruh bo'yicha haqiqiy to'lov * %)
    calculatedSalary = groups.reduce((s, g) => s + g.salary, 0);
  } else {
    // PER_LESSON_HOUR — count actual taught lessons this month
    const teacherGroupIds = teacher.groups.map(g => g.id);

    const lessons = await prisma.lesson.findMany({
      where: {
        groupId: { in: teacherGroupIds },
        date: { gte: monthStart, lt: monthEnd },
        status: 'COMPLETED',
      },
      select: { durationHours: true }
    });

    totalHours = lessons.reduce((s, l) => s + Number(l.durationHours), 0);
    calculatedSalary = Math.round(totalHours * salaryValue);
  }

  // ── Check if already paid this month ──
  const monthDate = new Date(year, month, 1);
  const existingSalary = await prisma.teacherSalary.findUnique({
    where: { teacherId_month: { teacherId, month: monthDate } }
  });

  return {
    teacherId,
    teacherName: teacher.user.fullName,
    teacherPhone: teacher.user.phone,
    salaryType,
    salaryValue,
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    groups,
    totalStudents,
    totalRevenue,
    totalExpectedRevenue,
    totalActualRevenue,
    calculatedSalary,
    totalHours,
    // Already paid?
    paidSalary: existingSalary ? Number(existingSalary.paidSalary) : 0,
    isPaid: existingSalary?.status === 'PAID',
    paidAt: existingSalary?.paidAt || null,
    salaryRecordId: existingSalary?.id || null,
  };
}

// ─────────────────────────────────────────────────────────
// GET /salaries/calculate?month=2026-03
// Barcha ustozlar uchun LIVE hisob-kitob
// ─────────────────────────────────────────────────────────
export const calculateAllSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = targetMonth.split('-').map(Number);
    const year = yr;
    const monthIndex = mo - 1;

    const teachers = await prisma.teacher.findMany({
      where: { user: { isActive: true } },
      select: { id: true }
    });

    const results = await Promise.all(
      teachers.map(t => calcTeacherSalaryForMonth(t.id, year, monthIndex))
    );

    const valid = results.filter(Boolean);
    const totalCalculated = valid.reduce((s, r) => s + (r?.calculatedSalary || 0), 0);
    const totalRevenue = valid.reduce((s, r) => s + (r?.totalRevenue || 0), 0);
    const totalPaid = valid.reduce((s, r) => s + (r?.paidSalary || 0), 0);

    sendSuccess(res, {
      month: targetMonth,
      teachers: valid,
      summary: {
        totalTeachers: valid.length,
        totalCalculated,
        totalRevenue,
        totalPaid,
        totalPending: totalCalculated - totalPaid,
      }
    });
  } catch (err) {
    console.error('calculateAllSalaries error:', err);
    sendError(res, 'Oylik hisoblashda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries/teacher/me/calculate?month=2026-03
// Ustoz o'zining oyligini ko'radi
// ─────────────────────────────────────────────────────────
export const calculateMySalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.id } });
    if (!teacher) {
      sendError(res, 'Ustoz profili topilmadi.', 404);
      return;
    }

    const { month } = req.query as Record<string, string>;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = targetMonth.split('-').map(Number);

    const result = await calcTeacherSalaryForMonth(teacher.id, yr, mo - 1);
    if (!result) {
      sendError(res, 'Oylik hisoblashda xato.', 404);
      return;
    }

    sendSuccess(res, result);
  } catch (err) {
    console.error('calculateMySalary error:', err);
    sendError(res, 'Oylik hisoblashda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries/teacher/:teacherId/calculate?month=2026-03
// Bitta ustoz uchun LIVE hisob-kitob
// ─────────────────────────────────────────────────────────
export const calculateTeacherSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    const { month } = req.query as Record<string, string>;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = targetMonth.split('-').map(Number);

    const result = await calcTeacherSalaryForMonth(teacherId, yr, mo - 1);
    if (!result) {
      sendError(res, 'Ustoz topilmadi.', 404);
      return;
    }

    sendSuccess(res, result);
  } catch (err) {
    console.error('calculateTeacherSalary error:', err);
    sendError(res, 'Ustoz oyligini hisoblashda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries — Barcha oyliklar ro'yxati (oylik filtri bilan)
// ─────────────────────────────────────────────────────────
export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, teacherId } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (teacherId) where.teacherId = parseInt(teacherId);
    if (month) {
      const d = new Date(month + '-01T00:00:00.000Z');
      where.month = {
        gte: d,
        lt: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      };
    }
    const salaries = await prisma.teacherSalary.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
      orderBy: { month: 'desc' },
    });
    const teachers = await prisma.teacher.findMany({
      include: { user: { select: { id: true, fullName: true } } },
    });
    sendSuccess(res, { salaries, teachers });
  } catch (err) {
    console.error('getSalaries error:', err);
    sendError(res, 'Maoshlarni olishda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /salaries/pay — Maosh to'lash (Expense jadvaliga ham yoziladi)
// ─────────────────────────────────────────────────────────
export const paySalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, month, amount, note } = req.body;
    if (!teacherId || !month || !amount) {
      sendError(res, 'teacherId, month va amount kiritilishi shart.', 400);
      return;
    }
    const monthDate = new Date(month + '-01T00:00:00.000Z');
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const paidAmount = parseFloat(amount);

    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(teacherId) },
      include: { user: { select: { fullName: true } } },
    });
    if (!teacher) { sendError(res, 'Ustoz topilmadi.', 404); return; }

    // Salary record yangilash yoki yaratish
    const salary = await prisma.teacherSalary.upsert({
      where: { teacherId_month: { teacherId: parseInt(teacherId), month: monthStart } },
      update: {
        paidSalary: { increment: paidAmount },
        status: 'PAID',
        paidAt: new Date(),
      },
      create: {
        teacherId: parseInt(teacherId),
        month: monthStart,
        calculatedSalary: paidAmount,
        paidSalary: paidAmount,
        status: 'PAID',
        paidAt: new Date(),
      },
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
    });

    // ── Expense jadvaliga SALARY kategoriyasida yozish ──
    const monthLabel = monthDate.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
    await prisma.expense.create({
      data: {
        category: 'SALARY',
        amount: paidAmount,
        date: new Date(),
        description: `${teacher.user.fullName} — ${monthLabel} maoshi${note ? '. ' + note : ''}`,
        addedBy: req.user?.id ?? null,
      },
    });

    sendSuccess(res, salary, 'Maosh to\'landi va xarajat sifatida saqlandi!', 201);
  } catch (err) {
    console.error('paySalary error:', err);
    sendError(res, 'Maosh to\'lashda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries/history — Barcha oyliklar tarixi (admin uchun)
// ─────────────────────────────────────────────────────────
export const getSalaryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;

    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month) {
      const d = new Date(month + '-01T00:00:00.000Z');
      dateFilter = { gte: d, lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    }

    const salaries = await prisma.teacherSalary.findMany({
      where: {
        status: 'PAID',
        ...(dateFilter ? { paidAt: dateFilter } : {}),
      },
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true } } } },
      },
      orderBy: { paidAt: 'desc' },
    });

    const salaryExpenses = await prisma.expense.findMany({
      where: {
        category: 'SALARY',
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { user: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
    });

    const totalPaid = salaries.reduce((s, r) => s + Number(r.paidSalary), 0);

    sendSuccess(res, { salaries, salaryExpenses, totalPaid });
  } catch (err) {
    sendError(res, 'Oylik tarixini olishda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries/staff/users — Ish haqi berish mumkin bo'lgan xodimlar
// (TEACHER bo'lmagan faol foydalanuvchilar: ADMIN, va boshqalar)
// ─────────────────────────────────────────────────────────
export const getStaffUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['ADMIN'] }, // Ustoz bo'lmagan xodimlar
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        staffSalaries: {
          orderBy: { paidAt: 'desc' },
          take: 3,
          select: {
            id: true,
            month: true,
            amount: true,
            position: true,
            status: true,
            paidAt: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    sendSuccess(res, users);
  } catch (err) {
    console.error('getStaffUsers error:', err);
    sendError(res, 'Xodimlarni olishda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /salaries/staff/pay — Xodimga ish haqi / bonus berish
// ─────────────────────────────────────────────────────────
export const payStaffSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, amount, month, note, position } = req.body;

    if (!userId || !amount || !month) {
      sendError(res, 'userId, amount va month kiritilishi shart.', 400);
      return;
    }

    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      sendError(res, 'Summa 0 dan katta bo\'lishi kerak.', 400);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, fullName: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      sendError(res, 'Foydalanuvchi topilmadi.', 404);
      return;
    }

    const monthDate = new Date(month + '-01T00:00:00.000Z');

    // StaffSalary yozuvi yaratish
    const salary = await (prisma.staffSalary as any).create({
      data: {
        userId: user.id,
        month: monthDate,
        amount: paidAmount,
        note: note || null,
        position: position || null,
        status: 'PAID',
        paidAt: new Date(),
        paidById: req.user!.id,
      },
      include: {
        user: { select: { fullName: true, phone: true, role: true } },
        paidBy: { select: { fullName: true } },
      },
    });

    // Expense jadvaliga ham yozish
    const monthLabel = monthDate.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
    await prisma.expense.create({
      data: {
        category: 'SALARY',
        amount: paidAmount,
        date: new Date(),
        description: `${user.fullName}${position ? ' (' + position + ')' : ''} — ${monthLabel} ish haqi${note ? '. ' + note : ''}`,
        addedBy: req.user?.id ?? null,
      },
    });

    sendSuccess(res, salary, 'Ish haqi muvaffaqiyatli to\'landi!', 201);
  } catch (err) {
    console.error('payStaffSalary error:', err);
    sendError(res, 'Ish haqi to\'lashda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// GET /salaries/staff/history — Xodimlar ish haqi tarixi
// ─────────────────────────────────────────────────────────
export const getStaffSalaryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, userId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = parseInt(userId);
    if (month) {
      const d = new Date(month + '-01T00:00:00.000Z');
      where.month = { gte: d, lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    }

    const salaries = await (prisma.staffSalary as any).findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true, role: true } },
        paidBy: { select: { fullName: true } },
      },
      orderBy: { paidAt: 'desc' },
    });

    const totalPaid = salaries.reduce((s: number, r: any) => s + Number(r.amount), 0);

    sendSuccess(res, { salaries, totalPaid });
  } catch (err) {
    console.error('getStaffSalaryHistory error:', err);
    sendError(res, 'Xodim ish haqi tarixini olishda xato.', 500);
  }
};
