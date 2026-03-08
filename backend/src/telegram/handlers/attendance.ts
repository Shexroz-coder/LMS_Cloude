/**
 * ✅ Davomat handler — Tarix + Statistika
 */
import { BotContext } from '../bot';
import { getUserByChatId, getAttendanceHistory, getAttendanceStats } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatDate, attendanceEmoji, escapeHtml, progressBar, formatMonth, brandHeader, brandFooter } from '../utils/format';

export async function handleAttendance(ctx: BotContext, studentId?: number) {
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

    const [records, stats] = await Promise.all([
      getAttendanceHistory(studentId!, 20),
      getAttendanceStats(studentId!),
    ]);

    const now = new Date();
    const monthName = formatMonth(now.getFullYear(), now.getMonth());

    let text = brandHeader('✅', 'DAVOMAT');

    // ── Bu oylik statistika ──
    text += `📊 <b>${monthName}</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${progressBar(stats.thisMonth.rate)} <b>${stats.thisMonth.rate}%</b>\n\n`;
    text += `   ✅ Keldi: <b>${stats.thisMonth.present}</b>\n`;
    text += `   ⏰ Kechikdi: <b>${stats.thisMonth.late}</b>\n`;
    text += `   ❌ Kelmadi: <b>${stats.thisMonth.absent}</b>\n`;
    text += `   📋 Sababli: <b>${stats.thisMonth.excused}</b>\n`;
    text += `   📈 Jami: <b>${stats.thisMonth.total}</b> dars\n\n`;

    // ── Umumiy statistika ──
    text += `📈 <b>Umumiy natija</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${progressBar(stats.allTime.rate)} <b>${stats.allTime.rate}%</b>\n`;
    text += `   Jami: ${stats.allTime.total} dars | `;
    text += `✅ ${stats.allTime.present} | ⏰ ${stats.allTime.late} | ❌ ${stats.allTime.absent}\n\n`;

    // ── Oxirgi yozuvlar ──
    if (records.length > 0) {
      text += `📋 <b>So'nggi yozuvlar</b>\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const r of records.slice(0, 15)) {
        const date = formatDate(r.lesson.date);
        const course = escapeHtml(r.lesson.group.course.name);
        const emoji = attendanceEmoji(r.status);
        text += `${emoji} ${date} — ${course}\n`;
      }
    } else {
      text += '📝 Hali davomat yozuvlari yo\'q.';
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleAttendance xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
