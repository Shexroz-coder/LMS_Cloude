/**
 * 💰 To'lovlar handler — Balans + Qarz + Kurslar tafsiloti
 */
import { BotContext } from '../bot';
import { getUserByChatId, getPaymentInfo, getPaymentCalculation } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatMoney, formatDate, paymentMethodLabel, escapeHtml, brandHeader, brandFooter } from '../utils/format';

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

    let text = brandHeader('💰', "TO'LOV HOLATI");

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

    // ── Oxirgi to'lovlar ──
    text += `\n💳 <b>Oxirgi to'lovlar</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (recentPayments.length > 0) {
      for (const p of recentPayments) {
        const date = formatDate(p.paidAt);
        const amount = formatMoney(Number(p.amount));
        const method = paymentMethodLabel(p.paymentMethod);

        text += `├ ${method} <b>${amount}</b>\n`;
        text += `│  📅 ${date}`;
        if (p.note) text += ` — <i>${p.note}</i>`;
        text += '\n';
      }
      text += `└─────────────────────\n`;
    } else {
      text += '📝 Hali to\'lovlar yo\'q.\n';
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handlePayments xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
