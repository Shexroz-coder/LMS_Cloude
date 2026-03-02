import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════
// GET /expenses — Barcha xarajatlar (arxiv bilan)
// ══════════════════════════════════════════════
export const getExpenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '100', category, month } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    // month filter — agar berilmasa BARCHA xarajatlar
    if (month) {
      const start = new Date(month + '-01T00:00:00.000Z');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      where.date = { gte: start, lt: end };
    }

    const [expenses, total, agg] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
        include: { user: { select: { fullName: true } } }
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } })
    ]);

    sendSuccess(res,
      { expenses, totalAmount: Number(agg._sum.amount || 0) },
      undefined, 200,
      paginate(pageNum, limitNum, total)
    );
  } catch (err) {
    console.error('getExpenses error:', err);
    sendError(res, 'Xarajatlarni olishda xato', 500);
  }
};

// ══════════════════════════════════════════════
// POST /expenses — Xarajat qo'shish
// ══════════════════════════════════════════════
export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, amount, date, description } = req.body;
    if (!category || !amount || !date) {
      sendError(res, 'Kategoriya, summa va sana kiritilishi shart', 400);
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      sendError(res, 'Summa 0 dan katta bo\'lishi kerak', 400);
      return;
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        amount: parsedAmount,
        date: new Date(date),
        description: description || null,
        addedBy: req.user?.id
      },
      include: { user: { select: { fullName: true } } }
    });
    sendSuccess(res, expense, 'Xarajat kiritildi!', 201);
  } catch (err) {
    console.error('createExpense error:', err);
    sendError(res, 'Xarajat kiritishda xato', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /expenses/:id — Xarajatni yangilash
// ══════════════════════════════════════════════
export const updateExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { category, amount, date, description } = req.body;
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(category && { category }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(date && { date: new Date(date) }),
        ...(description !== undefined && { description })
      },
      include: { user: { select: { fullName: true } } }
    });
    sendSuccess(res, updated, 'Xarajat yangilandi');
  } catch (err) {
    console.error('updateExpense error:', err);
    sendError(res, 'Xarajatni yangilashda xato', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /expenses/:id — Xarajatni o'chirish
// ══════════════════════════════════════════════
export const deleteExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.expense.delete({ where: { id } });
    sendSuccess(res, null, "Xarajat o'chirildi");
  } catch (err) {
    console.error('deleteExpense error:', err);
    sendError(res, "Xarajatni o'chirishda xato", 500);
  }
};

// ══════════════════════════════════════════════
// GET /expenses/summary — Moliyaviy xulosa
// month=2026-02 → o'sha oy  |  bo'sh → BARCHA VAQT
// ══════════════════════════════════════════════
export const getFinanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;

    // Oy filtri — agar berilmasa barcha vaqt
    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month) {
      const start = new Date(month + '-01T00:00:00.000Z');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      dateFilter = { gte: start, lt: end };
    }

    const [incomeAgg, expenseAgg, salaryAgg, debtAgg] = await Promise.all([
      // Daromad (to'lovlar)
      prisma.payment.aggregate({
        where: dateFilter ? { paidAt: dateFilter } : {},
        _sum: { amount: true }
      }),
      // Xarajatlar
      prisma.expense.aggregate({
        where: dateFilter ? { date: dateFilter } : {},
        _sum: { amount: true }
      }),
      // To'langan maoshlar
      prisma.teacherSalary.aggregate({
        where: {
          status: 'PAID',
          ...(dateFilter ? { month: dateFilter } : {})
        },
        _sum: { paidSalary: true }
      }),
      // Umumiy qarz
      prisma.studentBalance.aggregate({ _sum: { debt: true } })
    ]);

    // Kategoriya bo'yicha breakdown
    const byCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: dateFilter ? { date: dateFilter } : {},
      _sum: { amount: true },
      _count: true,
    });

    const income = Number(incomeAgg._sum.amount || 0);
    const expenses = Number(expenseAgg._sum.amount || 0) + Number(salaryAgg._sum.paidSalary || 0);
    const profit = income - expenses;

    sendSuccess(res, {
      income,
      expenses,
      profit,
      totalDebt: Number(debtAgg._sum.debt || 0),
      byCategory: byCategory.map(c => ({
        category: c.category,
        amount: Number(c._sum.amount || 0),
        count: c._count
      })),
      month: month || null
    });
  } catch (err) {
    console.error('getFinanceSummary error:', err);
    sendError(res, 'Moliya hisobotini olishda xato', 500);
  }
};

// ══════════════════════════════════════════════
// GET /expenses/all-time — Barcha vaqt balansi
// ══════════════════════════════════════════════
export const getAllTimeBalance = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalIncome, totalExpenses, totalSalaries, totalDebt, expenseCount] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.teacherSalary.aggregate({ where: { status: 'PAID' }, _sum: { paidSalary: true } }),
      prisma.studentBalance.aggregate({ _sum: { debt: true } }),
      prisma.expense.count()
    ]);

    const income = Number(totalIncome._sum.amount || 0);
    const expenses = Number(totalExpenses._sum.amount || 0) + Number(totalSalaries._sum.paidSalary || 0);

    sendSuccess(res, {
      income,
      expenses,
      balance: income - expenses,
      totalDebt: Number(totalDebt._sum.debt || 0),
      expenseCount
    });
  } catch (err) {
    console.error('getAllTimeBalance error:', err);
    sendError(res, 'Umumiy balansni olishda xato', 500);
  }
};
