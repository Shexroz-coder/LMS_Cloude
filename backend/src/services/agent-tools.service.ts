/**
 * AGENT TOOLS SERVICE — umumiy LMS operatsiyalari.
 *
 * Ham HTTP agent API (agent.controller), ham Telegram Voice AI Agent
 * shu funksiyalardan foydalanadi. Har yozish amali audit-log qoldiradi.
 */
import prisma from '../lib/prisma';
import { getFinanceTotals, getTotalIncome, getTotalExpenses } from './finance.service';
import { hashPassword } from '../utils/password.utils';
import { normalizePhone, phoneVariants } from '../utils/phone.utils';
import { isHolidayDate } from '../utils/schedule.utils';

const p = prisma as any;
const num = (v: unknown) => Math.round(Number(v || 0));

// ─── Audit log: har yozish amali admin bildirishnomasi sifatida ──
export async function auditLog(actorId: number, title: string, body: string): Promise<void> {
  try {
    const admins = await p.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) {
      await p.notification.createMany({
        data: admins.map((a: any) => ({ userId: a.id, title: `🤖 ${title}`, body, type: 'SYSTEM' })),
      });
    }
  } catch { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════
// O'QISH
// ══════════════════════════════════════════════════════════════════
export async function getOverview(branchId?: number) {
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
    p.attendance.groupBy({ by: ['status'], where: { lesson: { date: { gte: monthStart, lte: monthEnd }, ...(branchId ? { group: { branchId } } : {}) } }, _count: true }),
  ]);
  const totalAtt = attendance.reduce((s: number, a: any) => s + a._count, 0);
  const presentAtt = attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').reduce((s: number, a: any) => s + a._count, 0);

  return {
    scope: branchId ? `branch:${branchId}` : 'all',
    students, teachers, groups,
    monthIncome: income, monthExpenses: expenses, netProfit: income - expenses,
    totalDebt: finance.totalDebt, totalBalance: finance.totalBalance, debtorCount: finance.debtorCount,
    todayLessons,
    attendanceRate: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0,
  };
}

export async function getFinance(month?: string, branchId?: number) {
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
  return {
    period: month || 'all-time', scope: branchId ? `branch:${branchId}` : 'all',
    income, expenses, netProfit: income - expenses,
    totalDebt: finance.totalDebt, totalBalance: finance.totalBalance, debtorCount: finance.debtorCount,
  };
}

export async function listDebtors(branchId?: number, limit = 50) {
  const rows = await p.studentBalance.findMany({
    where: { debt: { gt: 0 }, student: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) } },
    orderBy: { debt: 'desc' }, take: Math.min(200, limit),
    include: { student: { include: { user: { select: { fullName: true, phone: true } } } } },
  });
  return rows.map((b: any) => ({
    studentId: b.studentId, fullName: b.student?.user?.fullName ?? '—',
    phone: b.student?.user?.phone ?? '—', debt: num(b.debt), balance: num(b.balance),
  }));
}

export async function searchStudents(search: string, branchId?: number, limit = 30) {
  const students = await p.student.findMany({
    where: {
      status: 'ACTIVE', ...(branchId ? { branchId } : {}),
      ...(search ? { user: { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } } : {}),
    },
    take: Math.min(100, limit),
    include: {
      user: { select: { fullName: true, phone: true } }, balance: true,
      groupStudents: { where: { status: 'ACTIVE' }, include: { group: { select: { id: true, name: true } } } },
    },
    orderBy: { id: 'desc' },
  });
  return students.map((s: any) => ({
    id: s.id, fullName: s.user?.fullName ?? '—', phone: s.user?.phone ?? '—',
    groups: s.groupStudents.map((gs: any) => ({ id: gs.group?.id, name: gs.group?.name })).filter((g: any) => g.id),
    debt: num(s.balance?.debt), balance: num(s.balance?.balance),
  }));
}

export async function listGroups(branchId?: number) {
  const groups = await p.group.findMany({
    where: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) },
    include: {
      course: { select: { name: true, monthlyPrice: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
      _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: { name: 'asc' },
  });
  return groups.map((g: any) => ({
    id: g.id, name: g.name, course: g.course?.name, monthlyPrice: num(g.course?.monthlyPrice),
    teacher: g.teacher?.user?.fullName, students: g._count?.groupStudents ?? 0,
  }));
}

// Bitta guruhning faol o'quvchilari (davomat uchun ismlarni topishga yordam)
export async function groupStudents(groupId: number) {
  const rows = await p.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    include: { student: { include: { user: { select: { fullName: true } } } } },
  });
  return rows.map((gs: any) => ({ studentId: gs.studentId, fullName: gs.student?.user?.fullName ?? '—' }));
}

// ══════════════════════════════════════════════════════════════════
// YOZISH
// ══════════════════════════════════════════════════════════════════
export async function createPayment(
  args: { studentId: number; amount: number; method?: string; month?: string; note?: string },
  actorId: number,
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (!args.studentId || isNaN(amount) || amount <= 0) throw new Error('studentId va musbat amount kerak');

  const student = await p.student.findUnique({
    where: { id: Number(args.studentId) },
    include: { balance: true, user: { select: { fullName: true } } },
  });
  if (!student) throw new Error('O\'quvchi topilmadi');

  const result = await prisma.$transaction(async (tx: any) => {
    const payment = await tx.payment.create({
      data: {
        studentId: student.id, amount, paymentMethod: (args.method || 'CASH'),
        month: args.month ? new Date(args.month + '-01') : new Date(),
        note: args.note || 'AI agent orqali', receivedBy: actorId,
        ...(student.branchId ? { branchId: student.branchId } : {}),
      },
    });
    const bal = student.balance;
    if (bal) {
      let newDebt = Number(bal.debt), newBalance = Number(bal.balance);
      const debtPaid = Math.min(amount, newDebt);
      newDebt = Math.max(0, newDebt - debtPaid);
      newBalance += (amount - debtPaid);
      await tx.studentBalance.update({ where: { studentId: student.id }, data: { balance: newBalance, debt: newDebt, lastUpdated: new Date() } });
    } else {
      await tx.studentBalance.create({ data: { studentId: student.id, balance: amount, debt: 0 } });
    }
    return payment;
  });

  await auditLog(actorId, 'To\'lov qabul qilindi', `${student.user.fullName}: ${num(amount).toLocaleString()} so'm (${args.method || 'CASH'}).`);
  return { paymentId: result.id, studentName: student.user.fullName, amount: num(amount) };
}

export async function markAttendance(
  args: { groupId: number; date: string; entries: Array<{ studentId: number; status: string }> },
  actorId: number,
) {
  const { groupId, date, entries } = args;
  if (!groupId || !date || !Array.isArray(entries) || !entries.length) throw new Error('groupId, date, entries kerak');

  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date(date).toISOString().slice(0, 10);
  const lessonDate = new Date(dateStr + 'T00:00:00.000Z');
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

  const group = await p.group.findUnique({ where: { id: Number(groupId) }, select: { id: true, name: true } });
  if (!group) throw new Error('Guruh topilmadi');

  const holiday = await isHolidayDate(lessonDate);
  const isForced = holiday.isHoliday;

  let lesson = await p.lesson.findFirst({ where: { groupId: group.id, date: { gte: dayStart, lt: dayEnd } } });
  if (!lesson) {
    lesson = await p.lesson.create({
      data: { groupId: group.id, date: lessonDate, startTime: '09:00', endTime: '10:00', topic: `${dateStr} darsi`, isForcedHoliday: isForced, status: 'COMPLETED' },
    });
  } else if (lesson.status !== 'COMPLETED') {
    lesson = await p.lesson.update({ where: { id: lesson.id }, data: { status: 'COMPLETED' } });
  }

  for (const e of entries) {
    const existing = await p.attendance.findFirst({ where: { lessonId: lesson.id, studentId: Number(e.studentId) } });
    const status = (['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(e.status) ? e.status : 'PRESENT');
    if (existing) {
      await p.attendance.update({ where: { id: existing.id }, data: { status } });
    } else {
      await p.attendance.create({ data: { lessonId: lesson.id, studentId: Number(e.studentId), status } });
    }
  }

  const present = entries.filter(e => e.status === 'PRESENT' || e.status === 'LATE').length;
  await auditLog(actorId, 'Davomat belgilandi', `${group.name} (${dateStr}): ${entries.length} o'quvchi, ${present} keldi.`);
  return { lessonId: lesson.id, group: group.name, date: dateStr, marked: entries.length, present };
}

export async function createStudent(
  args: { fullName: string; phone: string; branchId?: number; password?: string },
  actorId: number,
) {
  if (!args.fullName || !args.phone) throw new Error('fullName va phone kerak');
  const normPhone = normalizePhone(String(args.phone));
  const exists = await p.user.findFirst({ where: { phone: { in: phoneVariants(normPhone) } } });
  if (exists) throw new Error('Bu telefon allaqachon mavjud');

  // Xavfsizlik: standart parol yo'q. Berilmasa — tasodifiy kuchli parol.
  const plainPassword = args.password && String(args.password).length >= 6
    ? String(args.password)
    : Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  const passwordHash = await hashPassword(plainPassword);

  const result = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: { fullName: String(args.fullName).trim(), phone: normPhone, passwordHash, role: 'STUDENT', ...(args.branchId ? { branchId: Number(args.branchId) } : {}) },
    });
    const student = await tx.student.create({
      data: { userId: user.id, status: 'ACTIVE', coinBalance: 0, ...(args.branchId ? { branchId: Number(args.branchId) } : {}) },
    });
    await tx.studentBalance.create({ data: { studentId: student.id, balance: 0, debt: 0 } });
    return { studentId: student.id, userId: user.id };
  });

  await auditLog(actorId, 'Yangi o\'quvchi', `${args.fullName} (${normPhone}) qo'shildi.`);
  // Parol faqat shu javobda bir marta ko'rsatiladi
  return { ...result, fullName: args.fullName, phone: normPhone, password: plainPassword };
}
