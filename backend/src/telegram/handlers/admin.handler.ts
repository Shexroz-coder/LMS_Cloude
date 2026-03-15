/**
 * Admin uchun Telegram bot handlerlari
 * Dashboard, o'quvchilar, guruhlar, moliya, hisobotlar
 */
import { BotContext } from '../bot';
import { getUserByChatId } from '../services/data.service';
import { adminMenu, backToMenu } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader, brandFooter } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';

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
