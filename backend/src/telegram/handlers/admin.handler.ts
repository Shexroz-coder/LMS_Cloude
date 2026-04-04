/**
 * Admin uchun Telegram bot handlerlari
 * Dashboard, o'quvchilar, guruhlar, moliya, hisobotlar
 */
import { BotContext } from '../bot';
import bot from '../bot';
import { getUserByChatId } from '../services/data.service';
import { adminMenu, backToMenu } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader, brandFooter } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';
import { sendAdminReport } from '../../cron/lesson-reminder.cron';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

function getMonthName(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
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

// ══════════════════════════════════════════════════════
//  DASHBOARD — Umumiy ko'rinish
// ══════════════════════════════════════════════════════
export async function handleAdminDashboard(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now.getFullYear(), now.getMonth());

  const [
    totalStudents, activeStudents, totalTeachers, activeGroups,
    monthPayments, totalDebt, monthExpenses, monthSalaries
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.teacher.count(),
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
    prisma.teacherSalary.aggregate({
      where: { month: { gte: monthStart, lte: monthEnd } },
      _sum: { calculatedSalary: true, paidSalary: true },
    }),
  ]);

  const revenue = Number(monthPayments._sum.amount || 0);
  const expenses = Number(monthExpenses._sum.amount || 0);
  const salaries = Number(monthSalaries._sum.calculatedSalary || 0);
  const debt = Number(totalDebt._sum.debt || 0);
  const profit = revenue - expenses - salaries;

  let text = `📊 <b>DASHBOARD</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📅 ${getMonthName(now)} ${now.getFullYear()}\n\n`;

  text += `┌─ 👥 <b>O'quvchilar</b>\n`;
  text += `│  Faol: <b>${activeStudents}</b> / ${totalStudents}\n`;
  text += `│  👨‍🏫 Ustozlar: <b>${totalTeachers}</b>\n`;
  text += `│  📚 Guruhlar: <b>${activeGroups}</b>\n`;
  text += `└────────────────────\n\n`;

  text += `┌─ 💰 <b>Shu oy moliya</b>\n`;
  text += `│  📥 Tushum: <b>${formatMoney(revenue)}</b>\n`;
  text += `│  📤 Xarajat: <b>${formatMoney(expenses)}</b>\n`;
  text += `│  💼 Oyliklar: <b>${formatMoney(salaries)}</b>\n`;
  text += `│  ────────────────\n`;
  text += `│  ${profit >= 0 ? '📈' : '📉'} Foyda: <b>${formatMoney(profit)}</b>\n`;
  text += `│  🔴 Jami qarz: <b>${formatMoney(debt)}</b>\n`;
  text += `└────────────────────`;

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ══════════════════════════════════════════════════════
//  MOLIYAVIY HISOBOT — Oy tanlash
// ══════════════════════════════════════════════════════
export async function handleAdminReports(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  let text = `📈 <b>OYLIK HISOBOTLAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Qaysi oyni ko'rmoqchisiz?\n`;

  const kb = new InlineKeyboard();

  // Oxirgi 6 oyni ko'rsatish
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const key = `${d.getFullYear()}_${d.getMonth()}`;
    const icon = i === 0 ? '📅' : '📂';
    kb.text(`${icon} ${label}`, `admin_report_${key}`).row();
  }

  kb.text('⬅️ Asosiy menyu', 'main_menu');
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Tanlangan oy hisoboti ────────────────────────────
export async function handleAdminMonthReport(ctx: BotContext, year: number, month: number) {
  if (!(await checkAdmin(ctx))) return;

  const { start: monthStart, end: monthEnd } = getMonthRange(year, month);
  const monthName = MONTH_NAMES[month];

  const [
    activeStudents, newStudents, leftStudents,
    paymentsData, totalPaidCount,
    expensesData, salariesData,
    totalDebt, attendanceStats, lessonCount,
    topPayers, debtors
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
    prisma.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.teacherSalary.findMany({
      where: { month: { gte: monthStart, lte: monthEnd } },
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
    }),
    prisma.studentBalance.aggregate({ _sum: { debt: true } }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { lesson: { date: { gte: monthStart, lte: monthEnd } } },
      _count: true,
    }),
    prisma.lesson.count({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    // Eng ko'p to'lagan o'quvchilar
    prisma.payment.groupBy({
      by: ['studentId'],
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
    // Eng ko'p qarzdorlar
    prisma.studentBalance.findMany({
      where: { debt: { gt: 0 } },
      include: { student: { include: { user: { select: { fullName: true } } } } },
      orderBy: { debt: 'desc' },
      take: 5,
    }),
  ]);

  const revenue = Number(paymentsData._sum.amount || 0);
  const expenses = Number(expensesData._sum.amount || 0);
  const totalSalary = salariesData.reduce((s, sal) => s + Number(sal.calculatedSalary), 0);
  const paidSalary = salariesData.reduce((s, sal) => s + Number(sal.paidSalary), 0);
  const debt = Number(totalDebt._sum.debt || 0);
  const profit = revenue - expenses - totalSalary;

  const totalAtt = attendanceStats.reduce((s, a) => s + a._count, 0);
  const presentAtt = attendanceStats.filter(a => a.status === 'PRESENT').reduce((s, a) => s + a._count, 0);
  const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

  let text = `📈 <b>OYLIK HISOBOT</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📅 <b>${monthName} ${year}</b>\n\n`;

  // O'quvchilar
  text += `┌─ 👥 <b>O'QUVCHILAR</b>\n`;
  text += `│  Faol: <b>${activeStudents}</b>\n`;
  text += `│  🟢 Yangi: <b>+${newStudents}</b>\n`;
  text += `│  🔴 Ketgan: <b>-${leftStudents}</b>\n`;
  text += `└────────────────────\n\n`;

  // Moliya
  text += `┌─ 💰 <b>MOLIYA</b>\n`;
  text += `│  📥 Daromad: <b>${formatMoney(revenue)}</b> (${totalPaidCount} ta)\n`;
  text += `│  📤 Xarajat: <b>${formatMoney(expenses)}</b>\n`;
  text += `│  💼 Oyliklar: <b>${formatMoney(totalSalary)}</b>\n`;
  text += `│  ────────────────\n`;
  text += `│  ${profit >= 0 ? '✅' : '🔴'} Sof foyda: <b>${formatMoney(profit)}</b>\n`;
  text += `└────────────────────\n\n`;

  // Ustozlar oyligi
  if (salariesData.length > 0) {
    text += `┌─ 💼 <b>USTOZLAR OYLIGI</b>\n`;
    for (const sal of salariesData) {
      const icon = sal.status === 'PAID' ? '✅' : '⏳';
      text += `│  ${icon} ${escapeHtml(sal.teacher.user.fullName)}\n`;
      text += `│     Hisob: ${formatMoney(Number(sal.calculatedSalary))}`;
      text += ` | To'l: ${formatMoney(Number(sal.paidSalary))}\n`;
    }
    text += `│  ────────────────\n`;
    text += `│  Jami: <b>${formatMoney(totalSalary)}</b> / To'langan: <b>${formatMoney(paidSalary)}</b>\n`;
    text += `└────────────────────\n\n`;
  }

  // Qarzdorlar
  if (debtors.length > 0) {
    text += `┌─ 🔴 <b>QARZDORLAR</b>\n`;
    for (const d of debtors) {
      text += `│  ${escapeHtml(d.student.user.fullName)}: <b>${formatMoney(Number(d.debt))}</b>\n`;
    }
    text += `│  ────────────────\n`;
    text += `│  Jami qarz: <b>${formatMoney(debt)}</b>\n`;
    text += `└────────────────────\n\n`;
  }

  // Darslar
  text += `┌─ 📚 <b>DARSLAR</b>\n`;
  text += `│  Jami: <b>${lessonCount}</b> ta\n`;
  text += `│  Davomat: <b>${attRate}%</b> (${presentAtt}/${totalAtt})\n`;
  text += `└────────────────────\n\n`;

  // Xulosa
  text += `<b>📋 XULOSA:</b>\n`;
  if (profit >= 0) {
    text += `✅ ${monthName} — <b>foydali</b> (+${formatMoney(profit)})\n`;
  } else {
    text += `🔴 ${monthName} — <b>zarar</b> (${formatMoney(profit)})\n`;
  }
  if (debt > 0) {
    text += `⚠️ Undiriladigan qarz: ${formatMoney(debt)}\n`;
  }
  if (attRate >= 80) {
    text += `✅ Davomat yaxshi (${attRate}%)`;
  } else if (attRate >= 60) {
    text += `⚠️ Davomat o'rtacha (${attRate}%)`;
  } else {
    text += `🔴 Davomat past (${attRate}%)`;
  }

  const kb = new InlineKeyboard();
  kb.text('⬅️ Oylar ro\'yxati', 'admin_reports').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ══════════════════════════════════════════════════════
//  TO'LOVLAR — Hozirgi oy + Arxiv
// ══════════════════════════════════════════════════════
export async function handleAdminPayments(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now.getFullYear(), now.getMonth());
  const monthName = getMonthName(now);

  const [payments, totals, methodStats] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, isDeleted: false },
      include: { student: { include: { user: { select: { fullName: true } } } } },
      orderBy: { paidAt: 'desc' },
      take: 15,
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const total = Number(totals._sum.amount || 0);

  let text = `💰 <b>TO'LOVLAR — ${monthName} ${now.getFullYear()}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 Jami: <b>${formatMoney(total)}</b> (${totals._count} ta)\n\n`;

  // Usullar bo'yicha
  if (methodStats.length > 0) {
    text += `┌─ 📊 <b>Usullar bo'yicha</b>\n`;
    for (const m of methodStats) {
      const icon = m.paymentMethod === 'CASH' ? '💵' : m.paymentMethod === 'CARD' ? '💳' : '📱';
      const label = m.paymentMethod === 'CASH' ? 'Naqd' : m.paymentMethod === 'CARD' ? 'Karta' : 'Online';
      text += `│  ${icon} ${label}: <b>${formatMoney(Number(m._sum.amount || 0))}</b> (${m._count})\n`;
    }
    text += `└────────────────────\n\n`;
  }

  // Oxirgi to'lovlar
  text += `<b>Oxirgi to'lovlar:</b>\n`;
  for (const p of payments) {
    const icon = p.status === 'PAID' ? '✅' : '⏳';
    const method = p.paymentMethod === 'CASH' ? '💵' : p.paymentMethod === 'CARD' ? '💳' : '📱';
    text += `${icon}${method} <b>${escapeHtml(p.student.user.fullName)}</b>\n`;
    text += `   ${formatMoney(Number(p.amount))} — ${new Date(p.paidAt).toLocaleDateString('uz')}\n`;
  }

  const kb = new InlineKeyboard();
  kb.text('📂 Arxiv (boshqa oylar)', 'admin_payments_archive').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Admin to'lovlar arxiv (oy tanlash) ───────────────
export async function handleAdminPaymentsArchive(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  let text = `📂 <b>TO'LOVLAR ARXIVI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Qaysi oyni ko'rmoqchisiz?\n`;

  const kb = new InlineKeyboard();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}_${d.getMonth()}`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    kb.text(`📅 ${label}`, `admin_pay_month_${key}`).row();
  }

  kb.text('⬅️ Asosiy menyu', 'main_menu');
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Admin tanlangan oy to'lovlari ────────────────────
export async function handleAdminPayMonth(ctx: BotContext, year: number, month: number) {
  if (!(await checkAdmin(ctx))) return;

  const { start: monthStart, end: monthEnd } = getMonthRange(year, month);
  const monthName = MONTH_NAMES[month];

  const [payments, totals] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, isDeleted: false },
      include: { student: { include: { user: { select: { fullName: true } } } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: 'PAID', isDeleted: false },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  let text = `💰 <b>TO'LOVLAR — ${monthName} ${year}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${formatMoney(Number(totals._sum.amount || 0))}</b> (${totals._count} ta)\n\n`;

  for (const p of payments) {
    const icon = p.status === 'PAID' ? '✅' : '⏳';
    const method = p.paymentMethod === 'CASH' ? '💵' : p.paymentMethod === 'CARD' ? '💳' : '📱';
    text += `${icon}${method} <b>${escapeHtml(p.student.user.fullName)}</b> — ${formatMoney(Number(p.amount))}\n`;
    text += `   ${new Date(p.paidAt).toLocaleDateString('uz')}`;
    if (p.note) text += ` — <i>${escapeHtml(p.note)}</i>`;
    text += '\n';
  }

  if (payments.length === 0) text += '<i>Bu oyda to\'lovlar yo\'q</i>\n';

  const kb = new InlineKeyboard();
  kb.text('⬅️ Arxiv', 'admin_payments_archive').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ══════════════════════════════════════════════════════
//  XARAJATLAR — Hozirgi oy + Arxiv
// ══════════════════════════════════════════════════════
export async function handleAdminExpenses(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now.getFullYear(), now.getMonth());

  const [expenses, categoryStats] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  let text = `💸 <b>XARAJATLAR — ${getMonthName(now)} ${now.getFullYear()}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${formatMoney(total)}</b>\n\n`;

  // Kategoriyalar
  if (categoryStats.length > 0) {
    text += `┌─ 📊 <b>Kategoriyalar</b>\n`;
    const catLabels: Record<string, string> = {
      SALARY: '💼 Oylik', RENT: '🏠 Ijara', SUPPLIES: '📦 Jihozlar',
      MARKETING: '📣 Marketing', UTILITIES: '⚡ Kommunal', OTHER: '📋 Boshqa',
    };
    for (const c of categoryStats) {
      const label = catLabels[c.category] || `📋 ${c.category}`;
      text += `│  ${label}: <b>${formatMoney(Number(c._sum.amount || 0))}</b>\n`;
    }
    text += `└────────────────────\n\n`;
  }

  for (const e of expenses) {
    const catIcon = e.category === 'SALARY' ? '💼' : e.category === 'RENT' ? '🏠' : e.category === 'SUPPLIES' ? '📦' : '📋';
    text += `${catIcon} <b>${formatMoney(Number(e.amount))}</b> — ${new Date(e.date).toLocaleDateString('uz')}\n`;
    if (e.description) text += `   <i>${escapeHtml(e.description)}</i>\n`;
  }

  if (expenses.length === 0) text += '<i>Bu oy xarajatlar yo\'q</i>';

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ══════════════════════════════════════════════════════
//  MAOSHLAR — Hozirgi oy + Arxiv
// ══════════════════════════════════════════════════════
export async function handleAdminSalaries(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now.getFullYear(), now.getMonth());
  const monthName = getMonthName(now);

  const salaries = await prisma.teacherSalary.findMany({
    where: { month: { gte: monthStart, lte: monthEnd } },
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
  });

  const totalCalc = salaries.reduce((s, sal) => s + Number(sal.calculatedSalary), 0);
  const totalPaid = salaries.reduce((s, sal) => s + Number(sal.paidSalary), 0);

  let text = `💼 <b>USTOZLAR OYLIGI — ${monthName} ${now.getFullYear()}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (salaries.length === 0) {
    text += '<i>Bu oyda oylik ma\'lumotlari yo\'q</i>\n';
  } else {
    for (const s of salaries) {
      const icon = s.status === 'PAID' ? '✅' : '⏳';
      text += `${icon} <b>${escapeHtml(s.teacher.user.fullName)}</b>\n`;
      text += `   Hisoblangan: ${formatMoney(Number(s.calculatedSalary))}\n`;
      text += `   To'langan: ${formatMoney(Number(s.paidSalary))}\n`;
      const diff = Number(s.calculatedSalary) - Number(s.paidSalary);
      if (diff > 0) text += `   🔴 Qoldiq: ${formatMoney(diff)}\n`;
      text += '\n';
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 Jami hisoblangan: <b>${formatMoney(totalCalc)}</b>\n`;
    text += `✅ Jami to'langan: <b>${formatMoney(totalPaid)}</b>\n`;
    if (totalCalc > totalPaid) {
      text += `🔴 Qoldiq: <b>${formatMoney(totalCalc - totalPaid)}</b>\n`;
    }
  }

  const kb = new InlineKeyboard();
  kb.text('📂 Arxiv (boshqa oylar)', 'admin_salaries_archive').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Admin oylik arxiv ────────────────────────────────
export async function handleAdminSalariesArchive(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const salaries = await prisma.teacherSalary.findMany({
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
    orderBy: { month: 'desc' },
  });

  // Oylar bo'yicha guruhlash
  const byMonth: Record<string, typeof salaries> = {};
  for (const s of salaries) {
    const d = new Date(s.month);
    const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(s);
  }

  let text = `📂 <b>OYLIKLAR ARXIVI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  let grandTotal = 0;

  for (const [monthLabel, monthSalaries] of Object.entries(byMonth)) {
    const monthTotal = monthSalaries.reduce((s, sal) => s + Number(sal.calculatedSalary), 0);
    const monthPaid = monthSalaries.reduce((s, sal) => s + Number(sal.paidSalary), 0);
    grandTotal += monthPaid;

    text += `📅 <b>${monthLabel}</b>\n`;
    for (const s of monthSalaries) {
      const icon = s.status === 'PAID' ? '✅' : '⏳';
      text += `  ${icon} ${escapeHtml(s.teacher.user.fullName)}: ${formatMoney(Number(s.calculatedSalary))}\n`;
    }
    text += `  💵 Jami: ${formatMoney(monthTotal)} / To'langan: ${formatMoney(monthPaid)}\n\n`;
  }

  if (Object.keys(byMonth).length === 0) {
    text += '<i>Hali oylik ma\'lumotlari yo\'q</i>';
  } else {
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 Barcha vaqt jami: <b>${formatMoney(grandTotal)}</b>`;
  }

  const kb = new InlineKeyboard();
  kb.text('⬅️ Hozirgi oy', 'admin_salaries').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ══════════════════════════════════════════════════════
//  QARZDORLAR ALOHIDA SAHIFA
// ══════════════════════════════════════════════════════
export async function handleAdminDebtors(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const debtors = await prisma.studentBalance.findMany({
    where: { debt: { gt: 0 } },
    include: {
      student: {
        include: {
          user: { select: { fullName: true, phone: true } },
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: { group: { include: { course: { select: { name: true } } } } },
          },
        },
      },
    },
    orderBy: { debt: 'desc' },
  });

  const totalDebt = debtors.reduce((s, d) => s + Number(d.debt), 0);

  let text = `🔴 <b>QARZDORLAR RO'YXATI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${debtors.length}</b> ta | Summa: <b>${formatMoney(totalDebt)}</b>\n\n`;

  for (const d of debtors) {
    const groups = d.student.groupStudents.map(gs => gs.group.course.name).join(', ');
    text += `🔴 <b>${escapeHtml(d.student.user.fullName)}</b>\n`;
    text += `   📱 ${d.student.user.phone}\n`;
    text += `   📚 ${groups || '-'}\n`;
    text += `   💰 Qarz: <b>${formatMoney(Number(d.debt))}</b>\n\n`;
  }

  if (debtors.length === 0) {
    text += '✅ Qarzdorlar yo\'q!';
  }

  const kb = new InlineKeyboard();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ══════════════════════════════════════════════════════
//  MAVJUD HANDLERLAR (O'quvchilar, Ustozlar, Guruhlar, Kurslar)
// ══════════════════════════════════════════════════════

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

  let text = `👥 <b>O'QUVCHILAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${students.length}</b> (🟢${statusCounts.ACTIVE} 🟡${statusCounts.LEAD} 🔵${statusCounts.DEMO})\n\n`;

  for (const s of students.slice(0, 20)) {
    const debt = Number(s.balance?.debt || 0);
    const groups = s.groupStudents.map(gs => gs.group.course.name).join(', ');
    const statusIcon = s.status === 'ACTIVE' ? '🟢' : s.status === 'LEAD' ? '🟡' : '🔵';
    text += `${statusIcon} <b>${escapeHtml(s.user.fullName)}</b>\n`;
    text += `   📱 ${s.user.phone} | 📚 ${groups || '-'}\n`;
    if (debt > 0) text += `   🔴 Qarz: ${formatMoney(debt)}\n`;
  }

  if (students.length > 20) text += `\n<i>... va yana ${students.length - 20} ta</i>`;

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

export async function handleAdminTeachers(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { fullName: true, phone: true } },
      groups: { where: { status: 'ACTIVE' }, include: { course: { select: { name: true } } } },
    },
  });

  let text = `👨‍🏫 <b>O'QITUVCHILAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${teachers.length}</b>\n\n`;

  for (const t of teachers) {
    const groups = t.groups.map(g => g.course.name).join(', ');
    const salaryInfo = t.salaryType === 'PERCENTAGE_FROM_PAYMENT'
      ? `${Number(t.salaryValue)}%` : t.salaryType === 'PER_LESSON_HOUR'
        ? `${formatMoney(Number(t.salaryValue))}/soat` : `${formatMoney(Number(t.salaryValue))}/oy`;

    text += `👨‍🏫 <b>${escapeHtml(t.user.fullName)}</b>\n`;
    text += `   📱 ${t.user.phone} | 💰 ${salaryInfo}\n`;
    text += `   📚 ${groups || 'Guruh yo\'q'}\n\n`;
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

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

  const dayNames = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  let text = `📚 <b>GURUHLAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${groups.length}</b>\n\n`;

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

export async function handleAdminCourses(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const courses = await prisma.course.findMany({
    include: { _count: { select: { groups: true } } },
  });

  let text = `📖 <b>KURSLAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Jami: <b>${courses.length}</b>\n\n`;

  for (const c of courses) {
    const statusIcon = c.isActive ? '🟢' : '🔴';
    text += `${statusIcon} <b>${escapeHtml(c.name)}</b>\n`;
    text += `   💰 ${formatMoney(Number(c.monthlyPrice))}/oy | 📚 ${c._count.groups} guruh | ⏱ ${c.durationMonths} oy\n`;
    if (c.description) text += `   📝 ${escapeHtml(c.description)}\n`;
    text += '\n';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: adminMenu() });
}

// ══════════════════════════════════════════════════════
//  BROADCAST — Xabar yuborish tizimi
// ══════════════════════════════════════════════════════

export async function handleAdminBroadcast(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  let text = `📢 <b>BROADCAST XABAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Kimga xabar yubormoqchisiz?\n`;

  const kb = new InlineKeyboard();
  kb.text('🎓 Barcha o\'quvchilar', 'broadcast_students').row();
  kb.text('👨‍👩‍👧 Barcha ota-onalar', 'broadcast_parents').row();
  kb.text('👨‍🏫 Barcha ustozlar', 'broadcast_teachers').row();
  kb.text('👥 Hammaga', 'broadcast_all').row();
  kb.text('📋 Yuborilgan xabarlar', 'broadcast_history').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleBroadcastTarget(ctx: BotContext, target: string) {
  if (!(await checkAdmin(ctx))) return;

  const targetLabel = target === 'students' ? 'O\'quvchilar' :
    target === 'parents' ? 'Ota-onalar' :
      target === 'teachers' ? 'Ustozlar' : 'Hammaga';

  ctx.session.step = 'waiting_broadcast_text';
  ctx.session.broadcastTarget = target;

  let text = `📢 <b>BROADCAST — ${targetLabel}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Yubormoqchi bo'lgan xabaringizni yozing:\n\n`;
  text += `<i>Matn yozib yuboring...</i>`;

  const kb = new InlineKeyboard();
  kb.text('❌ Bekor qilish', 'admin_broadcast');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleBroadcastSend(ctx: BotContext) {
  const messageText = ctx.message?.text;
  const target = ctx.session.broadcastTarget;

  ctx.session.step = 'idle';
  ctx.session.broadcastTarget = undefined;

  if (!messageText || !target) {
    await ctx.reply('❌ Xabar yoki target topilmadi.');
    return;
  }

  // Admin tekshirish
  const chatId = String(ctx.chat?.id);
  const adminUser = await getUserByChatId(chatId);
  if (!adminUser || adminUser.role !== 'ADMIN') {
    await ctx.reply('❌ Faqat admin uchun.');
    return;
  }

  await ctx.reply('⏳ Xabarlar yuborilmoqda...');

  // Target bo'yicha foydalanuvchilarni topish
  let whereClause: any = { telegramChatId: { not: null }, isActive: true };
  if (target === 'students') whereClause.role = 'STUDENT';
  else if (target === 'parents') whereClause.role = 'PARENT';
  else if (target === 'teachers') whereClause.role = 'TEACHER';

  const users = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, fullName: true, telegramChatId: true, role: true },
  });

  let sentCount = 0;
  let failCount = 0;
  const sentMessages: { chatId: string; messageId: number; name: string; role: string }[] = [];
  const failedUsers: { name: string; error: string }[] = [];

  for (const user of users) {
    if (!user.telegramChatId) continue;
    try {
      const sent = await bot.api.sendMessage(user.telegramChatId, `📢 <b>Xabar</b>\n\n${messageText}`, { parse_mode: 'HTML' });
      sentMessages.push({ chatId: user.telegramChatId, messageId: sent.message_id, name: user.fullName, role: user.role });
      sentCount++;
    } catch (e: any) {
      failCount++;
      failedUsers.push({ name: user.fullName, error: e.message?.slice(0, 50) || 'unknown' });
    }
  }

  // E'lonni saqlash
  const targetRoles = target === 'students' ? ['STUDENT'] :
    target === 'parents' ? ['PARENT'] :
      target === 'teachers' ? ['TEACHER'] :
        ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'];

  await prisma.announcement.create({
    data: {
      title: 'Broadcast xabar',
      body: messageText,
      targetRoles: targetRoles as any,
      createdBy: adminUser.id,
    },
  });

  // Admin'ga hisobot
  const targetLabel = target === 'students' ? 'O\'quvchilar' :
    target === 'parents' ? 'Ota-onalar' :
      target === 'teachers' ? 'Ustozlar' : 'Hammaga';

  let report = `📋 <b>BROADCAST HISOBOTI</b>\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `📌 Target: <b>${targetLabel}</b>\n`;
  report += `📅 ${new Date().toLocaleString('uz')}\n\n`;
  report += `✅ Yuborildi: <b>${sentCount}</b>\n`;
  if (failCount > 0) report += `❌ Xato: <b>${failCount}</b>\n`;
  report += '\n';

  report += `<b>📝 Xabar:</b>\n`;
  report += `<i>${escapeHtml(messageText.slice(0, 200))}${messageText.length > 200 ? '...' : ''}</i>\n\n`;

  if (sentMessages.length > 0) {
    report += `<b>✅ Ro'yxat:</b>\n`;
    for (const m of sentMessages.slice(0, 25)) {
      const icon = m.role === 'STUDENT' ? '🎓' : m.role === 'PARENT' ? '👨‍👩‍👧' : '👨‍🏫';
      report += `${icon} ${escapeHtml(m.name)}\n`;
    }
    if (sentMessages.length > 25) report += `<i>... va yana ${sentMessages.length - 25} ta</i>\n`;
  }

  if (failedUsers.length > 0) {
    report += `\n<b>❌ Xatoliklar:</b>\n`;
    for (const f of failedUsers.slice(0, 10)) {
      report += `⚠️ ${escapeHtml(f.name)}: ${f.error}\n`;
    }
  }

  // Sessionga saqlash (o'chirish uchun)
  (ctx.session as any).lastBroadcastMessages = sentMessages;

  const kb = new InlineKeyboard();
  if (sentMessages.length > 0) {
    kb.text('🗑 Barcha xabarlarni o\'chirish', 'broadcast_delete_all').row();
    kb.text('🔄 Qayta yuborish', `broadcast_resend_${target}`).row();
  }
  kb.text('⬅️ Broadcast menyu', 'admin_broadcast');

  await ctx.reply(report, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleBroadcastDeleteAll(ctx: BotContext) {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);
  if (!user || user.role !== 'ADMIN') return;

  const messages = (ctx.session as any).lastBroadcastMessages as
    { chatId: string; messageId: number; name: string }[] | undefined;

  if (!messages || messages.length === 0) {
    await ctx.editMessageText('❌ O\'chiriladigan xabarlar topilmadi.', { reply_markup: backToMenu() });
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const m of messages) {
    try {
      await bot.api.deleteMessage(m.chatId, m.messageId);
      deleted++;
    } catch (e) {
      failed++;
    }
  }

  delete (ctx.session as any).lastBroadcastMessages;

  let text = `🗑 <b>XABARLAR O'CHIRILDI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `✅ O'chirildi: <b>${deleted}</b>\n`;
  if (failed > 0) text += `❌ Xato: <b>${failed}</b>\n`;

  const kb = new InlineKeyboard();
  kb.text('⬅️ Broadcast menyu', 'admin_broadcast');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleBroadcastResend(ctx: BotContext, target: string) {
  await handleBroadcastTarget(ctx, target);
}

export async function handleBroadcastHistory(ctx: BotContext) {
  if (!(await checkAdmin(ctx))) return;

  const announcements = await prisma.announcement.findMany({
    include: { creator: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  let text = `📋 <b>YUBORILGAN E'LONLAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (announcements.length === 0) {
    text += '<i>Hali e\'lonlar yo\'q</i>';
  } else {
    for (const a of announcements) {
      const date = new Date(a.createdAt).toLocaleDateString('uz');
      const roles = a.targetRoles.join(', ');
      text += `📢 <b>${escapeHtml(a.title)}</b>\n`;
      text += `   📅 ${date} | 🎯 ${roles}\n`;
      text += `   <i>${escapeHtml(a.body.slice(0, 80))}${a.body.length > 80 ? '...' : ''}</i>\n\n`;
    }
  }

  const kb = new InlineKeyboard();
  kb.text('⬅️ Broadcast menyu', 'admin_broadcast');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ─── Admin: Ustozlar Davomat Nazorati ────────────────────────────────────────

const DAY_NAMES_UZ = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];
const MONTH_NAMES_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function formatLocalDateAdmin(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function handleAdminAttendanceMonitor(ctx: BotContext, dateStr?: string) {
  if (!(await checkAdmin(ctx))) return;

  // Default: bugun (Toshkent vaqti)
  const todayStr = formatLocalDateAdmin(new Date());
  const targetDateStr = dateStr || todayStr;
  const targetDate = new Date(targetDateStr + 'T00:00:00.000Z');

  // targetDate ning hafta kuni (0=Yak ... 6=Shan)
  const dispDate = new Date(targetDateStr + 'T12:00:00.000Z');
  const weekday = dispDate.getUTCDay(); // 0..6
  const dayLabel = DAY_NAMES_UZ[weekday];
  const dateLabel = `${dispDate.getUTCDate()}-${MONTH_NAMES_SHORT[dispDate.getUTCMonth()]}`;
  const isToday = targetDateStr === todayStr;

  // O'sha kunda (weekday) jadval bor barcha aktiv guruhlarni olish
  // weekdayMap: JS 0=Sun..6=Sat → Prisma DayOfWeek: SUNDAY, MONDAY, ...
  // Guruhlarni topish: o'sha weekday da dars bor, ACTIVE
  // daysOfWeek = Int[] (0=Yak, 1=Dush, ... 6=Shan) — JS getUTCDay() bilan mos
  const groups = await prisma.group.findMany({
    where: {
      status: 'ACTIVE',
      schedules: { some: { daysOfWeek: { has: weekday } } },
    },
    include: {
      teacher: { include: { user: { select: { fullName: true } } } },
      schedules: { where: { daysOfWeek: { has: weekday } } },
      _count: { select: { groupStudents: true } },
    },
    orderBy: { teacher: { user: { fullName: 'asc' } } },
  });

  if (groups.length === 0) {
    const kb = new InlineKeyboard();
    // Navigation: prev / next
    const prevDate = new Date(targetDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    kb.text('⬅️ Oldingi kun', `admin_att_monitor_${formatLocalDateAdmin(prevDate)}`);
    kb.text('Keyingi kun ➡️', `admin_att_monitor_${formatLocalDateAdmin(nextDate)}`).row();
    kb.text('📅 Bugun', `admin_att_monitor_${todayStr}`).row();
    kb.text('⬅️ Bosh menyu', 'main_menu');

    const text = `📋 <b>DAVOMAT NAZORATI</b>\n`
      + `━━━━━━━━━━━━━━━━━━━━━━━\n`
      + `📅 ${dayLabel}, ${dateLabel}${isToday ? ' (bugun)' : ''}\n\n`
      + `<i>Bu kunda hech qanday dars yo'q</i>`;
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
    return;
  }

  // Mavjud lesson recordlarini olish (targetDate uchun)
  const nextDay = new Date(targetDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const existingLessons = await prisma.lesson.findMany({
    where: {
      date: { gte: targetDate, lt: nextDay },
      groupId: { in: groups.map(g => g.id) },
    },
    include: {
      _count: { select: { attendance: true } },
    },
  });

  // GroupId → lesson map
  const lessonByGroup = new Map(existingLessons.map(l => [l.groupId, l]));

  // Teacher ga guruhlarini guruhlash
  const teacherMap = new Map<string, {
    name: string;
    groups: Array<{
      groupName: string;
      lessonStatus: 'COMPLETED' | 'PARTIAL' | 'MISSING';
      attendanceCount: number;
      totalStudents: number;
      startTime: string;
    }>;
  }>();

  for (const group of groups) {
    const teacherName = (group as any).teacher.user.fullName;
    const teacherId = String(group.teacherId);
    const lesson = lessonByGroup.get(group.id);
    const totalStudents = (group as any)._count.groupStudents as number;
    const scheduleItem = (group as any).schedules?.[0];
    const startTime = scheduleItem?.startTime
      ? String(scheduleItem.startTime).slice(0, 5)
      : '--:--';

    let lessonStatus: 'COMPLETED' | 'PARTIAL' | 'MISSING';
    let attendanceCount = 0;

    if (!lesson) {
      lessonStatus = 'MISSING';
    } else if (lesson.status === 'COMPLETED') {
      lessonStatus = 'COMPLETED';
      attendanceCount = (lesson as any)._count.attendance as number;
    } else {
      // lesson bor lekin COMPLETED emas
      attendanceCount = (lesson as any)._count.attendance as number;
      lessonStatus = attendanceCount > 0 ? 'PARTIAL' : 'MISSING';
    }

    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, { name: teacherName, groups: [] });
    }
    teacherMap.get(teacherId)!.groups.push({
      groupName: group.name,
      lessonStatus,
      attendanceCount,
      totalStudents,
      startTime,
    });
  }

  // Statistika
  let completedCount = 0;
  let partialCount = 0;
  let missingCount = 0;

  for (const [, teacher] of teacherMap) {
    for (const g of teacher.groups) {
      if (g.lessonStatus === 'COMPLETED') completedCount++;
      else if (g.lessonStatus === 'PARTIAL') partialCount++;
      else missingCount++;
    }
  }

  let text = `📋 <b>DAVOMAT NAZORATI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📅 ${dayLabel}, ${dateLabel}${isToday ? ' (bugun)' : ''}\n`;
  text += `✅ ${completedCount} | ⚠️ ${partialCount} | ❌ ${missingCount}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const [, teacher] of teacherMap) {
    text += `👨‍🏫 <b>${escapeHtml(teacher.name)}</b>\n`;
    for (const g of teacher.groups) {
      const icon = g.lessonStatus === 'COMPLETED' ? '✅'
        : g.lessonStatus === 'PARTIAL' ? '⚠️' : '❌';
      const attInfo = g.lessonStatus !== 'MISSING'
        ? ` (${g.attendanceCount}/${g.totalStudents} o'q)`
        : '';
      text += `  ${icon} ${escapeHtml(g.groupName)} — ${g.startTime}${attInfo}\n`;
    }
    text += '\n';
  }

  // 7 kunlik navigation
  const kb = new InlineKeyboard();
  const prevDate = new Date(targetDate);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(targetDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  kb.text('⬅️ Oldingi kun', `admin_att_monitor_${formatLocalDateAdmin(prevDate)}`);
  kb.text('Keyingi kun ➡️', `admin_att_monitor_${formatLocalDateAdmin(nextDate)}`).row();

  // 7 kunlik tezkor navigatsiya (bugundan -3 to +3)
  const today = new Date(todayStr + 'T00:00:00.000Z');
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const ds = formatLocalDateAdmin(d);
    const dd = new Date(ds + 'T12:00:00.000Z');
    const label = i === 0 ? '📍' : `${dd.getUTCDate()}/${dd.getUTCMonth() + 1}`;
    const mark = ds === targetDateStr ? `[${label}]` : label;
    kb.text(mark, `admin_att_monitor_${ds}`);
    if (i === 0) kb.row();
  }
  kb.row();
  kb.text('🔄 Yangilash', `admin_att_monitor_${targetDateStr}`);
  kb.text('⬅️ Bosh menyu', 'main_menu');

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
