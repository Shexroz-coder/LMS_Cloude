import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────
// Barcha oyliklar ro'yxati (oylik filtri bilan)
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
// Maosh to'lash — Expense jadvaliga ham yoziladi
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

    // Ustozni topish
    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(teacherId) },
      include: { user: { select: { fullName: true } } },
    });
    if (!teacher) { sendError(res, 'Ustoz topilmadi.', 404); return; }

    // Salary record yangilash
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
// Barcha oyliklar tarixi (admin uchun) — expense bilan birlashgan
// ─────────────────────────────────────────────────────────
export const getSalaryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;

    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month) {
      const d = new Date(month + '-01T00:00:00.000Z');
      dateFilter = { gte: d, lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    }

    // Salary to'lovlari
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

    // Ustoz oyliqlari expense sifatida
    const salaryExpenses = await prisma.expense.findMany({
      where: {
        category: 'SALARY',
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { user: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
    });

    // Jami
    const totalPaid = salaries.reduce((s, r) => s + Number(r.paidSalary), 0);

    sendSuccess(res, { salaries, salaryExpenses, totalPaid });
  } catch (err) {
    sendError(res, 'Oylik tarixini olishda xato.', 500);
  }
};
