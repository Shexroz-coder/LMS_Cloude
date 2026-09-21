process.env.TZ = 'Asia/Tashkent';
/**
 * FOUNDER HISOBOT CRON
 *
 * Haftalik (dushanba 08:00) va oylik (har oy 1-sanasi 08:00) — server
 * bazadan ma'lumot yig'adi, AI tahlil qiladi va FOUNDER (hamda ADMIN)
 * Telegramiga tahliliy hisobot yuboradi.
 */
import cron from 'node-cron';
import prisma from '../lib/prisma';
import bot from '../telegram/bot';
import { getFinanceTotals, getTotalIncome, getTotalExpenses } from '../services/finance.service';
import { isLlmConfigured, analyze } from '../services/llm.service';

const p = prisma as any;
const money = (v: number) => Math.round(v).toLocaleString('uz-UZ').replace(/,/g, ' ') + " so'm";

interface PeriodData {
  label: string;
  income: number; expenses: number; net: number;
  debt: number; debtorCount: number;
  activeStudents: number; newStudents: number; leftStudents: number;
  attendanceRate: number;
  branches: Array<{ name: string; income: number; debt: number; students: number }>;
  prevIncome: number; prevDebt: number;
}

async function gather(from: Date, to: Date, prevFrom: Date, prevTo: Date, label: string): Promise<PeriodData> {
  const finance = await getFinanceTotals();
  const [income, expenses, prevIncome, prevDebtBalances, activeStudents, newStudents, leftStudents, attendance, branches] = await Promise.all([
    getTotalIncome(from, to),
    getTotalExpenses(from, to),
    getTotalIncome(prevFrom, prevTo),
    p.studentBalance.aggregate({ _sum: { debt: true } }),
    p.student.count({ where: { status: 'ACTIVE' } }),
    p.student.count({ where: { createdAt: { gte: from, lte: to } } as any }),
    p.student.count({ where: { status: 'INACTIVE', leftAt: { gte: from, lte: to } } as any }),
    p.attendance.groupBy({ by: ['status'], where: { lesson: { date: { gte: from, lte: to } } }, _count: true }),
    p.branch.findMany({ orderBy: { id: 'asc' } }),
  ]);

  const totalAtt = attendance.reduce((s: number, a: any) => s + a._count, 0);
  const presentAtt = attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').reduce((s: number, a: any) => s + a._count, 0);

  const branchStats = await Promise.all(branches.map(async (b: any) => {
    const [bIncome, bFin, bStudents] = await Promise.all([
      getTotalIncome(from, to, b.id),
      getFinanceTotals(b.id),
      p.student.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
    ]);
    return { name: b.name, income: bIncome, debt: bFin.totalDebt, students: bStudents };
  }));

  return {
    label,
    income, expenses, net: income - expenses,
    debt: finance.totalDebt, debtorCount: finance.debtorCount,
    activeStudents, newStudents, leftStudents,
    attendanceRate: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0,
    branches: branchStats,
    prevIncome, prevDebt: Math.round(Number(prevDebtBalances._sum?.debt || 0)),
  };
}

function formatReport(d: PeriodData, aiAnalysis: string): string {
  const branchLines = d.branches.length > 1
    ? '\n\n🏢 <b>Filiallar:</b>\n' + d.branches.map(b => `• ${b.name}: tushum ${money(b.income)}, qarz ${money(b.debt)}, ${b.students} o'quvchi`).join('\n')
    : '';
  return (
    `📊 <b>Robotic Edu — ${d.label} hisobot</b>\n\n` +
    `💰 Tushum: <b>${money(d.income)}</b>\n` +
    `💸 Xarajat: <b>${money(d.expenses)}</b>\n` +
    `📈 Sof natija: <b>${money(d.net)}</b>\n` +
    `🔴 Qarzdorlik: <b>${money(d.debt)}</b> (${d.debtorCount} o'quvchi)\n` +
    `👥 Faol o'quvchilar: <b>${d.activeStudents}</b>\n` +
    `➕ Yangi: ${d.newStudents}   ➖ Ketgan: ${d.leftStudents}\n` +
    `✅ Davomat: <b>${d.attendanceRate}%</b>` +
    branchLines +
    (aiAnalysis ? `\n\n🤖 <b>AI tahlili:</b>\n${aiAnalysis}` : '')
  );
}

async function buildAndSend(d: PeriodData): Promise<void> {
  let aiAnalysis = '';
  if (isLlmConfigured()) {
    try {
      const incomeChange = d.prevIncome > 0 ? Math.round((d.income - d.prevIncome) / d.prevIncome * 100) : 0;
      const debtChange = d.debt - d.prevDebt;
      aiAnalysis = await analyze(
        'Sen o\'quv markazi moliyaviy tahlilchisisan. Qisqa (3-5 gap), o\'zbek tilida, aniq va amaliy tahlil ber. Asosiy muammoni va 1-2 tavsiyani ayt.',
        `Davr: ${d.label}. Tushum: ${d.income} (o'tgan davrga nisbatan ${incomeChange}%). Xarajat: ${d.expenses}. Sof: ${d.net}. Qarzdorlik: ${d.debt} (o'zgarish: ${debtChange >= 0 ? '+' : ''}${debtChange}). Faol o'quvchi: ${d.activeStudents}, yangi: ${d.newStudents}, ketgan: ${d.leftStudents}. Davomat: ${d.attendanceRate}%. Filiallar: ${JSON.stringify(d.branches)}.`
      );
    } catch (e) { console.error('AI tahlil xatosi:', e); }
  }

  const text = formatReport(d, aiAnalysis);

  // FOUNDER va ADMIN foydalanuvchilarга (telegram ulagan)
  const recipients = await p.user.findMany({
    where: { role: { in: ['FOUNDER', 'ADMIN'] }, telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  for (const r of recipients) {
    try { await bot.api.sendMessage(r.telegramChatId, text, { parse_mode: 'HTML' }); }
    catch (e) { console.error('Founder hisobot yuborishda xato:', e); }
  }
  console.log(`✅ [CRON] ${d.label} hisobot ${recipients.length} kishiga yuborildi`);
}

export async function sendWeeklyReport(): Promise<void> {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const from = new Date(to); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1); prevTo.setHours(23, 59, 59);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - 6); prevFrom.setHours(0, 0, 0, 0);
  const d = await gather(from, to, prevFrom, prevTo, 'Haftalik');
  await buildAndSend(d);
}

export async function sendMonthlyReport(): Promise<void> {
  const now = new Date();
  // O'tgan oy
  const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevTo = new Date(from.getFullYear(), from.getMonth(), 0, 23, 59, 59);
  const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  const d = await gather(from, to, prevFrom, prevTo, 'Oylik');
  await buildAndSend(d);
}

export function startFounderReportCron(): void {
  // Haftalik — har dushanba 08:00
  cron.schedule('0 8 * * 1', async () => {
    console.log('📊 [CRON] Haftalik founder hisobot...');
    try { await sendWeeklyReport(); } catch (e) { console.error('❌ Haftalik hisobot:', e); }
  }, { timezone: 'Asia/Tashkent' });

  // Oylik — har oy 1-sanasi 08:00
  cron.schedule('0 8 1 * *', async () => {
    console.log('📊 [CRON] Oylik founder hisobot...');
    try { await sendMonthlyReport(); } catch (e) { console.error('❌ Oylik hisobot:', e); }
  }, { timezone: 'Asia/Tashkent' });

  console.log('📅 [CRON] Founder hisobot: haftalik (Du 08:00) + oylik (1-sana 08:00)');
}
