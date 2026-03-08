/**
 * 📊 Baholar handler — Chiroyli UI bilan
 */
import { BotContext } from '../bot';
import { getUserByChatId, getGrades } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatDate, escapeHtml, progressBar, brandHeader, brandFooter } from '../utils/format';

export async function handleGrades(ctx: BotContext, studentId?: number) {
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

    const grades = await getGrades(studentId!);

    let text = brandHeader('📊', 'BAHOLAR');

    if (grades.length === 0) {
      text += '📝 Hali baholar yo\'q.';
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
      return;
    }

    // ── O'rtacha ball ──
    const avg = grades.reduce((s, g) => s + Number(g.score), 0) / grades.length;
    const avgEmoji = avg >= 80 ? '🟢' : avg >= 60 ? '🟡' : '🔴';
    const avgPercent = Math.min(100, avg);

    text += `📈 <b>O'rtacha ball</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${progressBar(avgPercent)} ${avgEmoji} <b>${avg.toFixed(1)}</b> / 100\n\n`;

    // ── Kurslar bo'yicha guruhlash ──
    const byCourse: Record<string, Array<{ score: number; date: Date | string; type: string | null; comment: string | null }>> = {};
    for (const g of grades) {
      const courseName = g.lesson.group.course.name;
      if (!byCourse[courseName]) byCourse[courseName] = [];
      byCourse[courseName].push({
        score: Number(g.score),
        date: g.givenAt,
        type: g.type,
        comment: g.comment,
      });
    }

    for (const [course, courseGrades] of Object.entries(byCourse)) {
      const courseAvg = courseGrades.reduce((s, g) => s + g.score, 0) / courseGrades.length;
      const courseEmoji = courseAvg >= 80 ? '🟢' : courseAvg >= 60 ? '🟡' : '🔴';

      text += `📖 <b>${escapeHtml(course)}</b> (${courseEmoji} ${courseAvg.toFixed(0)})\n`;
      text += `┌─────────────────────\n`;

      for (const g of courseGrades) {
        const scoreEmoji = g.score >= 80 ? '🟢' : g.score >= 60 ? '🟡' : '🔴';
        const date = formatDate(g.date);
        text += `│ ${scoreEmoji} <b>${g.score}</b>`;
        if (g.type) text += ` (${g.type})`;
        text += ` — ${date}`;
        if (g.comment) text += `\n│    💬 <i>${escapeHtml(g.comment)}</i>`;
        text += '\n';
      }
      text += `└─────────────────────\n\n`;
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleGrades xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
