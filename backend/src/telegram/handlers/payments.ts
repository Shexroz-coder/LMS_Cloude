/**
 * 💰 To'lovlar handler — Hozirgi oy + Arxiv
 */
import { BotContext } from '../bot';
import { getUserByChatId, getPaymentInfo, getPaymentCalculation } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatMoney, formatDate, paymentMethodLabel, escapeHtml, brandHeader, brandFooter } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

// ── Asosiy to'lovlar (hozirgi oy ko'rinishi) ──────────
export async function handlePayments(ctx: BotContext, studentId?: number) {
  try {
    const chatId = String(ctx.chat?.id);

    if (!studentId) {
      const user = await getUserByChatId(chatId);
      if (!user?.student) {
        await ctx.editMessageText('❌ O\'quvchi topilmadi.', { reply_markup: backToMenu() });
        return;
      }
      studentId = user.student.id;
    }

    const [paymentInfo, calc] = await Promise.all([
      getPaymentInfo(studentId!),
      getPaymentCalculation(studentId!),
    ]);

    const { balance, recentPayments } = paymentInfo;
    const balanceAmount = Number(balance?.balance || 0);
    const debtAmount = Number(balance?.debt || 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthName = MONTH_NAMES[now.getMonth()];

    // Hozirgi oy to'lovlari
    const currentMonthPayments = await prisma.payment.findMany({
      where: {
        studentId: studentId!,
        paidAt: { gte: monthStart, lte: monthEnd },
        isDeleted: false,
      },
      orderBy: { paidAt: 'desc' },
    });

    const currentTotal = currentMonthPayments.reduce((s, p) => s + Number(p.amount), 0);

    let text = brandHeader('💰', `TO'LOV HOLATI — ${monthName}`);

    // ── Balans bo'limi ──
    text += `📊 <b>Hisob holati</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (debtAmount > 0) {
      text += `🔴 Qarz: <b>${formatMoney(debtAmount)}</b>\n`;
    } else {
      text += `🟢 Qarz: <b>yo'q</b>\n`;
    }

    if (balanceAmount > 0) {
      text += `💳 Balans: <b>${formatMoney(balanceAmount)}</b>\n`;
    } else {
      text += `💳 Balans: <b>0 so'm</b>\n`;
    }

    // ── Kurslar va narxlar ──
    if (calc && calc.groups.length > 0) {
      text += `\n📚 <b>Kurslar va narxlar</b>\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const g of calc.groups) {
        text += `├ 📖 ${escapeHtml(g.courseName)}\n`;
        text += `│    ${escapeHtml(g.groupName)} — <b>${formatMoney(g.monthlyPrice)}</b>/oy\n`;
      }

      text += `└─────────────────────\n`;
      text += `💵 Jami oylik: <b>${formatMoney(calc.totalMonthly)}</b>\n`;

      if (calc.discountText) {
        text += `🏷 Chegirma: <b>${calc.discountText}</b>\n`;
      }
    }

    // ── Hozirgi oy to'lovlari ──
    text += `\n💳 <b>${monthName} oyi to'lovlari</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (currentMonthPayments.length > 0) {
      for (const p of currentMonthPayments) {
        const date = formatDate(p.paidAt);
        const amount = formatMoney(Number(p.amount));
        const method = paymentMethodLabel(p.paymentMethod);

        text += `├ ${method} <b>${amount}</b>\n`;
        text += `│  📅 ${date}`;
        if (p.note) text += ` — <i>${p.note}</i>`;
        text += '\n';
      }
      text += `└─────────────────────\n`;
      text += `💵 Jami: <b>${formatMoney(currentTotal)}</b>\n`;
    } else {
      text += '📝 Bu oy to\'lovlar yo\'q.\n';
    }

    text += brandFooter();

    // Arxiv tugmasi
    const kb = new InlineKeyboard();
    kb.text('📂 Arxiv (barcha oylar)', `payments_archive_${studentId}`).row();
    kb.text('⬅️ Asosiy menyu', 'main_menu');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('❌ handlePayments xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Arxiv to'lovlar (barcha oylar) ──────────────────
export async function handlePaymentsArchive(ctx: BotContext, studentId: number) {
  try {
    const payments = await prisma.payment.findMany({
      where: { studentId, isDeleted: false },
      orderBy: { paidAt: 'desc' },
    });

    let text = brandHeader('📂', 'TO\'LOVLAR ARXIVI');

    if (payments.length === 0) {
      text += '<i>Hali to\'lovlar yo\'q.</i>';
    } else {
      // Oylar bo'yicha guruhlash
      const byMonth: Record<string, typeof payments> = {};
      for (const p of payments) {
        const d = new Date(p.paidAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(p);
      }

      for (const key of Object.keys(byMonth)) {
        const [year, monthIdx] = key.split('-').map(Number);
        const monthPayments = byMonth[key];
        const total = monthPayments.reduce((s, p) => s + Number(p.amount), 0);

        text += `\n📅 <b>${MONTH_NAMES[monthIdx]} ${year}</b> — ${formatMoney(total)}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

        for (const p of monthPayments) {
          const date = formatDate(p.paidAt);
          const amount = formatMoney(Number(p.amount));
          const method = paymentMethodLabel(p.paymentMethod);
          text += `├ ${method} <b>${amount}</b> — ${date}\n`;
          if (p.note) text += `│  <i>${p.note}</i>\n`;
        }
      }
    }

    const kb = new InlineKeyboard();
    kb.text('⬅️ Hozirgi oy', `payments_current_${studentId}`).row();
    kb.text('⬅️ Asosiy menyu', 'main_menu');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  } catch (err) {
    console.error('❌ handlePaymentsArchive xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
