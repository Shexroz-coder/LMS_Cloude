/**
 * Admin uchun Telegram bot handlerlari
 * Dashboard, o'quvchilar, guruhlar, to'lovlar, hisobotlar
 */
import { BotContext } from '../bot';
import { getUserByChatId } from '../services/data.service';
import { adminMenu, backToMenu } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader, brandFooter } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';

// Oy nomlari (o'zbekcha)
const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

function getMonthName(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}

// ── Admin tekshirish ──────────────────────────────
async function checkAdmin(ctx: BotContext) {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);
  if (!user || user.role !== 'ADMIN') {
    await ctx.editMessageText('❌ Faqat admin uchun.', { reply_markup: backToMenu() });
    return null;
  }
  return user;
}

// ── Dashboard ──────────────────────────────────────
export async function handleAdminDashboard(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalStudents, activeStudents, totalTeachers, totalGroups, activeGroups,
    monthPayments, totalDebt, monthExpenses
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.teacher.count(),
    prisma.group.count(),
    prisma.group.count({ where: { status: 'ACTIVE' } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.studentBalance.aggregate({ _sum: { debt: true } }),
    prisma.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(monthPayments._sum.amount || 0);
  const expenses = Number(monthExpenses._sum.amount || 0);
  const debt = Number(totalDebt._sum.debt || 0);

  let text = brandHeader('📊', `DASHBOARD — ${getMonthName(now)} ${now.getFullYear()}`);
  text += `\n👥 <b>O'quvchilar:</b> ${activeStudents} faol / ${totalStudents} jami\n`;
  text += `👨‍🏫 <b>O'qituvchilar:</b> ${totalTeachers}\n`;
  text += `📚 <b>Guruhlar:</b> ${activeGroups} faol / ${totalGroups} jami\n\n`;
  text += `💰 <b>Shu oy tushumlar:</b> ${formatMoney(revenue)} (${monthPayments._count} ta)\n`;
  text += `💸 <b>Shu oy xarajatlar:</b> ${formatMoney(expenses)}\n`;
  text += `📈 <b>Foyda:</b> ${formatMoney(revenue - expenses)}\n\n`;
  text += `🔴 <b>Jami qarz:</b> ${formatMoney(debt)}`;

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── O'quvchilar ro'yxati ─────────────────────────────
export async function handleAdminStudents(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const students = await prisma.student.findMany({
    where: { user: { isActive: true } },
    include: {
      user: { select: { fullName: true, phone: true } },
      balance: true,
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: { group: { include: { course: { select: { name: true } } } } },
      },
    },
    orderBy: { user: { fullName: 'asc' } },
  });

  const statusCounts = {
    ACTIVE: students.filter(s => s.status === 'ACTIVE').length,
    LEAD: students.filter(s => s.status === 'LEAD').length,
    DEMO: students.filter(s => s.status === 'DEMO').length,
  };

  let text = brandHeader('👥', 'O\'QUVCHILAR');
  text += `Jami: <b>${students.length}</b> (Faol: ${statusCounts.ACTIVE}, Lead: ${statusCounts.LEAD}, Demo: ${statusCounts.DEMO})\n\n`;

  for (const s of students.slice(0, 20)) {
    const debt = Number(s.balance?.debt || 0);
    const groups = s.groupStudents.map(gs => gs.group.course.name).join(', ');
    const statusIcon = s.status === 'ACTIVE' ? '🟢' : s.status === 'LEAD' ? '🟡' : '🔵';
    text += `${statusIcon} <b>${escapeHtml(s.user.fullName)}</b>\n`;
    text += `   📱 ${s.user.phone} | 📚 ${groups || '-'}\n`;
    if (debt > 0) text += `   🔴 Qarz: ${formatMoney(debt)}\n`;
  }

  if (students.length > 20) {
    text += `\n<i>... va yana ${students.length - 20} ta</i>`;
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── O'qituvchilar ro'yxati ───────────────────────────
export async function handleAdminTeachers(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { fullName: true, phone: true } },
      groups: {
        where: { status: 'ACTIVE' },
        include: { course: { select: { name: true } } },
      },
    },
  });

  let text = brandHeader('👨‍🏫', 'O\'QITUVCHILAR');
  text += `Jami: <b>${teachers.length}</b>\n\n`;

  for (const t of teachers) {
    const groups = t.groups.map(g => g.course.name).join(', ');
    const salaryInfo = t.salaryType === 'PERCENTAGE_FROM_PAYMENT'
      ? `${Number(t.salaryValue)}% foiz`
      : t.salaryType === 'PER_LESSON_HOUR'
        ? `${formatMoney(Number(t.salaryValue))}/soat`
        : `${formatMoney(Number(t.salaryValue))}`;

    text += `👨‍🏫 <b>${escapeHtml(t.user.fullName)}</b>\n`;
    text += `   📱 ${t.user.phone}\n`;
    text += `   📚 ${groups || 'Guruh yo\'q'}\n`;
    text += `   💰 ${salaryInfo}\n\n`;
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── Guruhlar ro'yxati ────────────────────────────────
export async function handleAdminGroups(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const groups = await prisma.group.findMany({
    include: {
      course: { select: { name: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
      _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
      schedules: true,
    },
    orderBy: { status: 'asc' },
  });

  let text = brandHeader('📚', 'GURUHLAR');
  text += `Jami: <b>${groups.length}</b>\n\n`;

  const dayNames = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  for (const g of groups) {
    const statusIcon = g.status === 'ACTIVE' ? '🟢' : g.status === 'COMPLETED' ? '⚪' : '🔴';
    const schedule = g.schedules.map(s =>
      s.daysOfWeek.map((d: number) => dayNames[d]).join(',') + ` ${s.startTime}-${s.endTime}`
    ).join('; ');

    text += `${statusIcon} <b>${escapeHtml(g.name)}</b> (${g.course.name})\n`;
    text += `   👨‍🏫 ${escapeHtml(g.teacher.user.fullName)} | 👥 ${g._count.groupStudents}/${g.maxStudents}\n`;
    if (schedule) text += `   🕐 ${schedule}\n`;
    text += '\n';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── Kurslar ro'yxati ─────────────────────────────────
export async function handleAdminCourses(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { groups: true } },
    },
  });

  let text = brandHeader('📖', 'KURSLAR');
  text += `Jami: <b>${courses.length}</b>\n\n`;

  for (const c of courses) {
    const statusIcon = c.isActive ? '🟢' : '🔴';
    text += `${statusIcon} <b>${escapeHtml(c.name)}</b>\n`;
    text += `   💰 ${formatMoney(Number(c.monthlyPrice))}/oy\n`;
    text += `   📚 ${c._count.groups} guruh | ⏱ ${c.durationMonths} oy\n`;
    if (c.description) text += `   📝 ${escapeHtml(c.description)}\n`;
    text += '\n';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── To'lovlar ────────────────────────────────────────
export async function handleAdminPayments(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: monthStart, lte: monthEnd }, isDeleted: false },
    include: {
      student: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { paidAt: 'desc' },
    take: 20,
  });

  const totals = await prisma.payment.aggregate({
    where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
    _sum: { amount: true },
    _count: true,
  });

  let text = brandHeader('💰', `TO'LOVLAR — ${getMonthName(now)}`);
  text += `Jami: <b>${formatMoney(Number(totals._sum.amount || 0))}</b> (${totals._count} ta)\n\n`;

  for (const p of payments) {
    const statusIcon = p.status === 'PAID' ? '✅' : p.status === 'PENDING' ? '⏳' : '⚠️';
    const method = p.paymentMethod === 'CASH' ? '💵' : p.paymentMethod === 'CARD' ? '💳' : '📱';
    text += `${statusIcon} ${method} <b>${escapeHtml(p.student.user.fullName)}</b>\n`;
    text += `   ${formatMoney(Number(p.amount))} — ${new Date(p.paidAt).toLocaleDateString('uz')}\n`;
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── Xarajatlar ───────────────────────────────────────
export async function handleAdminExpenses(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: monthStart, lte: monthEnd } },
    orderBy: { date: 'desc' },
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  let text = brandHeader('💸', `XARAJATLAR — ${getMonthName(now)}`);
  text += `Jami: <b>${formatMoney(total)}</b>\n\n`;

  for (const e of expenses) {
    const catIcon = e.category === 'SALARY' ? '💼' : e.category === 'RENT' ? '🏠' : e.category === 'SUPPLIES' ? '📦' : '📋';
    text += `${catIcon} <b>${formatMoney(Number(e.amount))}</b>\n`;
    text += `   ${escapeHtml(e.description || '')} — ${new Date(e.date).toLocaleDateString('uz')}\n`;
  }

  if (expenses.length === 0) {
    text += '<i>Bu oy xarajatlar yo\'q</i>';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── Maoshlar ─────────────────────────────────────────
export async function handleAdminSalaries(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const salaries = await prisma.teacherSalary.findMany({
    include: {
      teacher: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { month: 'desc' },
    take: 20,
  });

  let text = brandHeader('💼', 'O\'QITUVCHI MAOSHLARI');

  if (salaries.length === 0) {
    text += '<i>Maosh ma\'lumotlari yo\'q</i>';
  } else {
    for (const s of salaries) {
      const statusIcon = s.status === 'PAID' ? '✅' : s.status === 'PENDING' ? '⏳' : '⚠️';
      const month = new Date(s.month);
      text += `${statusIcon} <b>${escapeHtml(s.teacher.user.fullName)}</b>\n`;
      text += `   ${getMonthName(month)} — Hisoblangan: ${formatMoney(Number(s.calculatedSalary))}\n`;
      text += `   To'langan: ${formatMoney(Number(s.paidSalary))}\n\n`;
    }
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ── Oylik hisobot ────────────────────────────────────
export async function handleAdminReports(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthName = getMonthName(now);

  // Barcha ma'lumotlarni parallel olish
  const [
    activeStudents, newStudents, leftStudents,
    totalRevenue, paidPayments, pendingPayments,
    totalExpenses, totalDebt,
    attendanceStats, lessonCount
  ] = await Promise.all([
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.student.count({ where: { user: { createdAt: { gte: monthStart, lte: monthEnd } } } }),
    prisma.student.count({ where: { status: 'INACTIVE', leftAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
    }),
    prisma.payment.count({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PENDING', isDeleted: false },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.studentBalance.aggregate({ _sum: { debt: true } }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { lesson: { date: { gte: monthStart, lte: monthEnd } } },
      _count: true,
    }),
    prisma.lesson.count({
      where: { date: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const revenue = Number(totalRevenue._sum.amount || 0);
  const expenses = Number(totalExpenses._sum.amount || 0);
  const debt = Number(totalDebt._sum.debt || 0);

  const totalAtt = attendanceStats.reduce((s, a) => s + a._count, 0);
  const presentAtt = attendanceStats.filter(a => a.status === 'PRESENT').reduce((s, a) => s + a._count, 0);
  const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

  let text = brandHeader('📈', `OYLIK HISOBOT — ${monthName} ${now.getFullYear()}`);

  text += `\n<b>👥 O'quvchilar</b>\n`;
  text += `   Faol: ${activeStudents} | Yangi: +${newStudents} | Ketgan: -${leftStudents}\n\n`;

  text += `<b>💰 Moliya</b>\n`;
  text += `   Tushum: ${formatMoney(revenue)} (${paidPayments} ta to'lov)\n`;
  text += `   Xarajat: ${formatMoney(expenses)}\n`;
  text += `   Foyda: ${formatMoney(revenue - expenses)}\n`;
  text += `   Kutilayotgan: ${pendingPayments} ta to'lov\n`;
  text += `   Jami qarz: ${formatMoney(debt)}\n\n`;

  text += `<b>📚 Darslar</b>\n`;
  text += `   Jami: ${lessonCount} ta dars\n`;
  text += `   Davomat: ${attRate}% (${presentAtt}/${totalAtt})\n`;

  // Xulosa
  text += `\n<b>📋 Xulosa:</b>\n`;
  if (revenue > expenses) {
    text += `✅ ${monthName} oyi <b>foydali</b> yakunlandi.\n`;
  } else {
    text += `⚠️ ${monthName} oyi xarajatlar tushumdan <b>oshdi</b>.\n`;
  }
  if (debt > 0) {
    text += `🔴 ${formatMoney(debt)} miqdorida qarzdorlik mavjud.\n`;
  }
  if (attRate >= 80) {
    text += `✅ Davomat yaxshi — ${attRate}%`;
  } else if (attRate >= 60) {
    text += `⚠️ Davomat o'rtacha — ${attRate}%`;
  } else {
    text += `🔴 Davomat past — ${attRate}%`;
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}
