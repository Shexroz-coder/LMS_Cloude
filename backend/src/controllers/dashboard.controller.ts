import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════
// GET /dashboard/stats — Admin dashboard
// ══════════════════════════════════════════════
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [
      studentsCount, teachersCount,
      monthlyIncome, totalDebt,
      totalExpenses, todayLessons,
      attendanceData, coinTotal, activeGroups
    ] = await Promise.all([
      prisma.student.count({ where: { user: { isActive: true } } }),
      prisma.teacher.count({ where: { user: { isActive: true } } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.studentBalance.aggregate({ _sum: { debt: true } }),
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.lesson.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: { gte: monthStart, lte: monthEnd } } },
        _count: true
      }),
      prisma.student.aggregate({ _sum: { coinBalance: true } }),
      prisma.group.count({ where: { status: 'ACTIVE' } })
    ]);

    const income = Number(monthlyIncome._sum.amount || 0);
    const expenses = Number(totalExpenses._sum.amount || 0);
    const debt = Number(totalDebt._sum.debt || 0);
    const netProfit = income - expenses;

    const totalAttendance = attendanceData.reduce((sum, a) => sum + a._count, 0);
    const presentAttendance = attendanceData
      .filter(a => a.status === 'PRESENT' || a.status === 'LATE')
      .reduce((sum, a) => sum + a._count, 0);
    const attendanceRate = totalAttendance > 0
      ? Math.round((presentAttendance / totalAttendance) * 100)
      : 0;

    sendSuccess(res, {
      studentsCount,
      teachersCount,
      monthlyIncome: income,
      totalDebt: debt,
      netProfit,
      attendanceRate,
      todayLessons,
      coinTotal: Number(coinTotal._sum.coinBalance || 0),
      activeGroups,
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    sendError(res, 'Dashboard ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/income-chart — So'nggi 6 oy
// ══════════════════════════════════════════════
export const getIncomeChart = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }

    const chartData = await Promise.all(
      months.map(async (start) => {
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        const [income, expenses] = await Promise.all([
          prisma.payment.aggregate({
            where: { paidAt: { gte: start, lte: end } },
            _sum: { amount: true }
          }),
          prisma.expense.aggregate({
            where: { date: { gte: start, lte: end } },
            _sum: { amount: true }
          })
        ]);
        const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        return {
          month: monthNames[start.getMonth()],
          income: Number(income._sum.amount || 0),
          expenses: Number(expenses._sum.amount || 0),
        };
      })
    );

    sendSuccess(res, chartData);
  } catch (err) {
    console.error('getIncomeChart error:', err);
    sendError(res, 'Grafik ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/recent-payments
// ══════════════════════════════════════════════
export const getRecentPayments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      take: 10,
      orderBy: { paidAt: 'desc' },
      include: {
        student: {
          include: { user: { select: { fullName: true, phone: true } } }
        }
      }
    });

    sendSuccess(res, payments);
  } catch (err) {
    console.error('getRecentPayments error:', err);
    sendError(res, 'So\'nggi to\'lovlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/weekly-attendance — Haftalik davomat
// ══════════════════════════════════════════════
export const getWeeklyAttendance = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayNames = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const grouped = await prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: { gte: start, lte: end } } },
        _count: true,
      });

      const present = grouped.filter(g => g.status === 'PRESENT' || g.status === 'LATE').reduce((s, g) => s + g._count, 0);
      const absent = grouped.filter(g => g.status === 'ABSENT').reduce((s, g) => s + g._count, 0);

      result.push({
        day: dayNames[date.getDay()],
        present,
        absent,
      });
    }

    sendSuccess(res, result);
  } catch (err) {
    console.error('getWeeklyAttendance error:', err);
    sendError(res, 'Haftalik davomat ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/today-lessons — Bugungi darslar
// ══════════════════════════════════════════════
export const getTodayLessons = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const lessons = await prisma.lesson.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: {
        group: {
          include: {
            teacher: { include: { user: { select: { fullName: true } } } },
            course: { select: { name: true } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } }
          }
        },
        _count: { select: { attendance: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    sendSuccess(res, lessons);
  } catch (err) {
    console.error('getTodayLessons error:', err);
    sendError(res, 'Bugungi darslarni olishda xato.', 500);
  }
};
