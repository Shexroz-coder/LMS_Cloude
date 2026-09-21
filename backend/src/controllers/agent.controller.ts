/**
 * AI AGENT CONTROLLER
 *
 * AI agent (MCP server orqali) tizimni to'liq boshqarish uchun ixcham,
 * JSON-optimallashtirilgan endpointlar. Barchasi API-kalit bilan himoyalangan.
 *
 * O'qish: overview, finance, debtors, branches, students, groups, attendance
 * Yozish: payment, adjust-debt, waive-debt, announcement, student
 */
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getFinanceTotals, getTotalIncome, getTotalExpenses } from '../services/finance.service';
import { hashPassword } from '../utils/password.utils';
import { normalizePhone, phoneVariants } from '../utils/phone.utils';

const p = prisma as any;
const num = (v: unknown) => Math.round(Number(v || 0));

function branchOf(req: AuthRequest): number | undefined {
  const raw = (req.query?.branchId ?? (req.body as any)?.branchId) as string | undefined;
  if (!raw || raw === 'all') return undefined;
  const n = parseInt(String(raw));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ══════════════════════════════════════════════════════════════════
// GET /agent/overview — Tizim umumiy holati
// ══════════════════════════════════════════════════════════════════
export const agentOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = branchOf(req);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const sBranch = branchId ? { branchId } : {};

    const [students, teachers, groups, finance, income, expenses, todayLessons, attendance] = await Promise.all([
      p.student.count({ where: { status: 'ACTIVE', ...sBranch } }),
      p.teacher.count({ where: { user: { isActive: true } } }),
      p.group.count({ where: { status: 'ACTIVE', ...sBranch } }),
      getFinanceTotals(branchId),
      getTotalIncome(monthStart, monthEnd, branchId),
      getTotalExpenses(monthStart, monthEnd, branchId),
      p.lesson.count({ where: { date: { gte: todayStart, lte: todayEnd }, ...(branchId ? { group: { branchId } } : {}) } }),
      p.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: { gte: monthStart, lte: monthEnd }, ...(branchId ? { group: { branchId } } : {}) } },
        _count: true,
      }),
    ]);

    const totalAtt = attendance.reduce((s: number, a: any) => s + a._count, 0);
    const presentAtt = attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').reduce((s: number, a: any) => s + a._count, 0);
    const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

    sendSuccess(res, {
      scope: branchId ? `branch:${branchId}` : 'all',
      students, teachers, groups,
      monthIncome: income,
      monthExpenses: expenses,
      netProfit: income - expenses,
      totalDebt: finance.totalDebt,
      totalBalance: finance.totalBalance,
      debtorCount: finance.debtorCount,
      todayLessons,
      attendanceRate,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('agentOverview error:', err);
    sendError(res, 'Overview olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /agent/finance — Moliya (davr + filial bo'yicha)
// ══════════════════════════════════════════════════════════════════
export const agentFinance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = branchOf(req);
    const { month } = req.query as { month?: string };
    let from: Date | undefined, to: Date | undefined;
    if (month) {
      from = new Date(month + '-01T00:00:00.000Z');
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const [finance, income, expenses] = await Promise.all([
      getFinanceTotals(branchId),
      getTotalIncome(from, to, branchId),
      getTotalExpenses(from, to, branchId),
    ]);
    sendSuccess(res, {
      period: month || 'all-time',
      scope: branchId ? `branch:${branchId}` : 'all',
      income, expenses, netProfit: income - expenses,
      totalDebt: finance.totalDebt,
      totalBalance: finance.totalBalance,
      debtorCount: finance.debtorCount,
    });
  } catch (err) {
    console.error('agentFinance error:', err);
    sendError(res, 'Moliya olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /agent/debtors — Qarzdorlar ro'yxati
// ══════════════════════════════════════════════════════════════════
export const agentDebtors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = branchOf(req);
    const limit = Math.min(200, parseInt(String(req.query.limit || '50')));
    const balances = await p.studentBalance.findMany({
      where: { debt: { gt: 0 }, student: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) } },
      orderBy: { debt: 'desc' },
      take: limit,
      include: { student: { include: { user: { select: { fullName: true, phone: true } } } } },
    });
    sendSuccess(res, balances.map((b: any) => ({
      studentId: b.studentId,
      fullName: b.student?.user?.fullName ?? '—',
      phone: b.student?.user?.phone ?? '—',
      debt: num(b.debt),
      balance: num(b.balance),
      promiseDate: b.promiseDate,
    })));
  } catch (err) {
    console.error('agentDebtors error:', err);
    sendError(res, 'Qarzdorlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /agent/branches — Filiallar (statistika bilan)
// ══════════════════════════════════════════════════════════════════
export const agentBranches = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branches = await p.branch.findMany({ orderBy: { id: 'asc' } });
    const result = await Promise.all(branches.map(async (b: any) => {
      const [students, groups, rooms, finance] = await Promise.all([
        p.student.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
        p.group.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
        p.room.count({ where: { branchId: b.id } }),
        getFinanceTotals(b.id),
      ]);
      return { id: b.id, name: b.name, isActive: b.isActive, students, groups, rooms, totalDebt: finance.totalDebt };
    }));
    sendSuccess(res, result);
  } catch (err) {
    console.error('agentBranches error:', err);
    sendError(res, 'Filiallarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /agent/students — O'quvchilarni qidirish
// ══════════════════════════════════════════════════════════════════
export const agentStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = branchOf(req);
    const search = String(req.query.search || '').trim();
    const limit = Math.min(100, parseInt(String(req.query.limit || '30')));
    const students = await p.student.findMany({
      where: {
        status: 'ACTIVE',
        ...(branchId ? { branchId } : {}),
        ...(search ? { user: { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } } : {}),
      },
      take: limit,
      include: {
        user: { select: { fullName: true, phone: true } },
        balance: true,
        groupStudents: { where: { status: 'ACTIVE' }, include: { group: { select: { name: true } } } },
      },
      orderBy: { id: 'desc' },
    });
    sendSuccess(res, students.map((s: any) => ({
      id: s.id,
      fullName: s.user?.fullName ?? '—',
      phone: s.user?.phone ?? '—',
      groups: s.groupStudents.map((gs: any) => gs.group?.name).filter(Boolean),
      debt: num(s.balance?.debt),
      balance: num(s.balance?.balance),
    })));
  } catch (err) {
    console.error('agentStudents error:', err);
    sendError(res, 'O\'quvchilarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /agent/groups — Guruhlar
// ══════════════════════════════════════════════════════════════════
export const agentGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = branchOf(req);
    const groups = await p.group.findMany({
      where: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) },
      include: {
        course: { select: { name: true, monthlyPrice: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      course: g.course?.name,
      monthlyPrice: num(g.course?.monthlyPrice),
      teacher: g.teacher?.user?.fullName,
      students: g._count?.groupStudents ?? 0,
    })));
  } catch (err) {
    console.error('agentGroups error:', err);
    sendError(res, 'Guruhlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /agent/payment — To'lov qabul qilish
// body: { studentId, amount, method?, month?, note? }
// ══════════════════════════════════════════════════════════════════
export const agentCreatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, amount, method = 'CASH', month, note } = req.body;
    if (!studentId || !amount) { sendError(res, 'studentId va amount kerak.', 400); return; }
    const roundedAmount = Math.round(parseFloat(String(amount)) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount <= 0) { sendError(res, 'amount noto\'g\'ri.', 400); return; }

    const student = await p.student.findUnique({ where: { id: parseInt(String(studentId)) }, include: { balance: true } });
    if (!student) { sendError(res, 'O\'quvchi topilmadi.', 404); return; }

    const result = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          studentId: student.id,
          amount: roundedAmount,
          paymentMethod: method,
          month: month ? new Date(month + '-01') : new Date(),
          note: note || 'AI agent orqali',
          receivedBy: req.user!.id,
          ...(student.branchId ? { branchId: student.branchId } : {}),
        },
      });
      const bal = student.balance;
      if (bal) {
        let newDebt = Number(bal.debt), newBalance = Number(bal.balance);
        const debtPaid = Math.min(roundedAmount, newDebt);
        newDebt = Math.max(0, newDebt - debtPaid);
        newBalance += (roundedAmount - debtPaid);
        await tx.studentBalance.update({ where: { studentId: student.id }, data: { balance: newBalance, debt: newDebt, lastUpdated: new Date() } });
      } else {
        await tx.studentBalance.create({ data: { studentId: student.id, balance: roundedAmount, debt: 0 } });
      }
      return payment;
    });

    sendSuccess(res, { paymentId: result.id, amount: roundedAmount }, 'To\'lov qabul qilindi.');
  } catch (err) {
    console.error('agentCreatePayment error:', err);
    sendError(res, 'To\'lov qabul qilishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /agent/adjust-debt — Qarz/balansni to'g'rilash
// body: { studentId, debt?, balance?, note? }
// ══════════════════════════════════════════════════════════════════
export const agentAdjustDebt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, debt, balance } = req.body;
    if (!studentId || (debt === undefined && balance === undefined)) {
      sendError(res, 'studentId va debt yoki balance kerak.', 400); return;
    }
    const sid = parseInt(String(studentId));
    const cur = await p.studentBalance.findUnique({ where: { studentId: sid } });
    const newDebt = debt !== undefined ? Math.max(0, num(debt)) : num(cur?.debt);
    const newBalance = balance !== undefined ? Math.max(0, num(balance)) : num(cur?.balance);
    await p.studentBalance.upsert({
      where: { studentId: sid },
      update: { debt: newDebt, balance: newBalance, lastUpdated: new Date() },
      create: { studentId: sid, debt: newDebt, balance: newBalance },
    });
    sendSuccess(res, { studentId: sid, debt: newDebt, balance: newBalance }, 'Qarz/balans yangilandi.');
  } catch (err) {
    console.error('agentAdjustDebt error:', err);
    sendError(res, 'Qarzni to\'g\'rilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /agent/announcement — E'lon yuborish
// body: { title, body, roles? }  roles: ['STUDENT','PARENT','TEACHER']
// ══════════════════════════════════════════════════════════════════
export const agentAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body, roles } = req.body;
    if (!title || !body) { sendError(res, 'title va body kerak.', 400); return; }
    const targetRoles = Array.isArray(roles) && roles.length ? roles : ['STUDENT', 'PARENT'];

    const announcement = await p.announcement.create({
      data: { title: String(title), body: String(body), targetRoles, createdBy: req.user!.id },
    });

    // Tegishli foydalanuvchilarga notification
    const users = await p.user.findMany({ where: { role: { in: targetRoles }, isActive: true }, select: { id: true } });
    if (users.length) {
      await p.notification.createMany({
        data: users.map((u: any) => ({ userId: u.id, title: String(title), body: String(body), type: 'ANNOUNCEMENT' })),
      });
    }
    sendSuccess(res, { announcementId: announcement.id, sentTo: users.length }, `E'lon ${users.length} kishiga yuborildi.`);
  } catch (err) {
    console.error('agentAnnouncement error:', err);
    sendError(res, 'E\'lon yuborishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /agent/student — Yangi o'quvchi qo'shish (soddalashtirilgan)
// body: { fullName, phone, branchId?, password? }
// ══════════════════════════════════════════════════════════════════
export const agentCreateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, phone, branchId, password } = req.body;
    if (!fullName || !phone) { sendError(res, 'fullName va phone kerak.', 400); return; }
    const normPhone = normalizePhone(String(phone));
    const exists = await p.user.findFirst({ where: { phone: { in: phoneVariants(normPhone) } } });
    if (exists) { sendError(res, 'Bu telefon allaqachon mavjud.', 409); return; }

    const passwordHash = await hashPassword(String(password || 'student123'));
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: { fullName: String(fullName).trim(), phone: normPhone, passwordHash, role: 'STUDENT', ...(branchId ? { branchId: parseInt(String(branchId)) } : {}) },
      });
      const student = await tx.student.create({
        data: { userId: user.id, status: 'ACTIVE', coinBalance: 0, ...(branchId ? { branchId: parseInt(String(branchId)) } : {}) },
      });
      await tx.studentBalance.create({ data: { studentId: student.id, balance: 0, debt: 0 } });
      return { studentId: student.id, userId: user.id };
    });
    sendSuccess(res, { ...result, phone: normPhone, defaultPassword: password ? undefined : 'student123' }, 'O\'quvchi qo\'shildi.');
  } catch (err) {
    console.error('agentCreateStudent error:', err);
    sendError(res, 'O\'quvchi qo\'shishda xato.', 500);
  }
};
