import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';


// ─────────────────────────────────────────────────────────
// Helper: Shu oydagi darslar sonini hisoblash (jadval asosida)
// ─────────────────────────────────────────────────────────
function countLessonsInMonth(year: number, month: number, days: number[]): number {
  if (!days || days.length === 0) return 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(year, month, d).getDay();
    if (days.includes(weekday)) count++;
  }
  return count;
}

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

  // ── Per-group breakdown ──
  const groups = teacher.groups.map(g => {
    const monthlyPrice = Number(g.course.monthlyPrice);
    const lessonsPerMonth = g.schedules.reduce((s, sc) => s + countLessonsInMonth(year, month, sc.daysOfWeek), 0);

    const students = g.groupStudents.map(gs => {
      const disc = gs.student.discountType as string | null;
      const discVal = gs.student.discountValue ? Number(gs.student.discountValue) : null;
      const expectedPayment = calcStudentMonthly(monthlyPrice, disc, discVal);
      return {
        id: gs.student.id,
        fullName: gs.student.user.fullName,
        monthlyPrice,
        discountType: disc,
        discountValue: discVal,
        expectedPayment: Math.round(expectedPayment),
      };
    });

    const groupRevenue = students.reduce((s, st) => s + st.expectedPayment, 0);

    return {
      id: g.id,
      name: g.name,
      courseName: g.course.name,
      lessonsPerMonth,
      studentCount: students.length,
      groupRevenue,
      students,
    };
  });

  const totalRevenue = groups.reduce((s, g) => s + g.groupRevenue, 0);
  const totalStudents = groups.reduce((s, g) => s + g.studentCount, 0);

  // ── Salary calculation ──
  let calculatedSalary = 0;
  let totalHours = 0;

  if (salaryType === 'PERCENTAGE_FROM_PAYMENT') {
    calculatedSalary = Math.round(totalRevenue * salaryValue / 100);
  } else {
    // PER_LESSON_HOUR — count actual taught lessons this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
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
