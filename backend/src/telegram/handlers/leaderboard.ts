/**
 * 🏆 Reyting (Leaderboard) handler
 */
import { BotContext } from '../bot';
import { getUserByChatId, getLeaderboard, getStudentRank } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { escapeHtml, rankEmoji, brandHeader, brandFooter } from '../utils/format';

export async function handleLeaderboard(ctx: BotContext, studentId?: number) {
  try {
    const chatId = String(ctx.chat?.id);

    // O'quvchi ID ni aniqlash (highlight uchun)
    let myStudentId = studentId;
    if (!myStudentId) {
      const user = await getUserByChatId(chatId);
      if (user?.student) {
        myStudentId = user.student.id;
      }
    }

    const [leaders, myRank] = await Promise.all([
      getLeaderboard(15),
      myStudentId ? getStudentRank(myStudentId) : null,
    ]);

    let text = brandHeader('🏆', 'REYTING JADVALI');

    if (leaders.length === 0) {
      text += '📝 Reyting jadvali bo\'sh.';
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
      return;
    }

    // ── Top 15 ──
    for (const s of leaders) {
      const isMe = s.id === myStudentId;
      const emoji = rankEmoji(s.rank);
      const name = escapeHtml(s.fullName);

      if (isMe) {
        text += `${emoji} <b>➤ ${name} — ${s.coinBalance} 🪙</b>\n`;
      } else {
        text += `${emoji} ${name} — ${s.coinBalance} 🪙\n`;
      }
    }

    // ── O'z pozitsiyam ──
    if (myRank && myRank.rank > 15) {
      text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📍 Sizning o'rningiz: <b>${myRank.rank}-o'rin</b> (${myRank.balance} 🪙)\n`;
    } else if (myRank) {
      text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📍 Siz <b>${myRank.rank}-o'rin</b>dasiz!\n`;
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleLeaderboard xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
