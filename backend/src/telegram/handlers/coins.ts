/**
 * 🪙 Tangalar handler — Balans + Reyting + Tranzaksiyalar
 */
import { BotContext } from '../bot';
import { getUserByChatId, getCoinInfo, getStudentRank } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatDate, escapeHtml, rankEmoji, brandHeader, brandFooter } from '../utils/format';

export async function handleCoins(ctx: BotContext, studentId?: number) {
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

    const [coinInfo, rankInfo] = await Promise.all([
      getCoinInfo(studentId!),
      getStudentRank(studentId!),
    ]);

    const { balance, transactions } = coinInfo;

    let text = brandHeader('🪙', 'TANGALAR');

    // ── Balans ──
    text += `💰 Balans: <b>${balance} tanga</b>\n`;

    if (rankInfo) {
      text += `${rankEmoji(rankInfo.rank)} O'rningiz: <b>${rankInfo.rank}-o'rin</b>\n`;
    }
    text += '\n';

    // ── Tranzaksiyalar ──
    text += `📋 <b>Oxirgi tranzaksiyalar</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (transactions.length > 0) {
      for (const t of transactions) {
        const date = formatDate(t.createdAt);
        const amount = Number(t.amount);
        const emoji = amount > 0 ? '🟢' : '🔴';
        const sign = amount > 0 ? '+' : '';
        const reason = t.reason ? escapeHtml(t.reason) : 'Noma\'lum';

        text += `├ ${emoji} <b>${sign}${amount}</b> tanga\n`;
        text += `│  📅 ${date} — ${reason}\n`;
      }
      text += `└─────────────────────\n`;
    } else {
      text += '📝 Hali tranzaksiyalar yo\'q.\n';
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleCoins xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
