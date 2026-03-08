/**
 * 📅 Darslar handler — Bugungi + Haftalik jadval
 */
import { BotContext } from '../bot';
import { getUserByChatId, getTodaySchedule, getWeeklySchedule } from '../services/data.service';
import { backToMenu, scheduleToggle, scheduleToggleChild } from '../utils/keyboards';
import { formatTime, dayName, escapeHtml, brandHeader, brandFooter } from '../utils/format';

// ── Bugungi darslar ─────────────────────────────────
export async function handleScheduleToday(ctx: BotContext, studentId?: number, childId?: number) {
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

    const schedule = await getTodaySchedule(studentId!);
    const today = new Date();
    const dayStr = dayName(today.getDay());
    const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;

    const keyboard = childId ? scheduleToggleChild(childId, 'today') : scheduleToggle('today');

    if (schedule.length === 0) {
      await ctx.editMessageText(
        brandHeader('📅', 'BUGUNGI DARSLAR', `${dayStr}, ${dateStr}`) +
        `😊 Bugun dars yo'q! Dam oling.` + brandFooter(),
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
      return;
    }

    let text = brandHeader('📅', 'BUGUNGI DARSLAR', `${dayStr}, ${dateStr}`);
    text += `📚 Jami: <b>${schedule.length} ta</b> dars\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < schedule.length; i++) {
      const s = schedule[i];
      const num = i + 1;
      text += `<b>${num}.</b> 🕐 ${formatTime(s.startTime)} — ${formatTime(s.endTime)}\n`;
      text += `    ├ 📖 ${escapeHtml(s.courseName)}\n`;
      text += `    ├ 👥 ${escapeHtml(s.groupName)}\n`;
      text += `    ├ 👨‍🏫 ${escapeHtml(s.teacherName)}\n`;
      if (s.room) text += `    └ 🏫 ${escapeHtml(s.room)}\n`;
      else text += `    └ 🏫 —\n`;
      if (i < schedule.length - 1) text += '\n';
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('❌ handleScheduleToday xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Haftalik jadval ─────────────────────────────────
export async function handleScheduleWeek(ctx: BotContext, studentId?: number, childId?: number) {
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

    const weekly = await getWeeklySchedule(studentId!);
    const keyboard = childId ? scheduleToggleChild(childId, 'week') : scheduleToggle('week');

    let text = brandHeader('🗓', 'HAFTALIK JADVAL');

    let hasAnyLesson = false;
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Du–Yak

    for (const d of dayOrder) {
      const lessons = weekly[d];
      if (lessons.length === 0) continue;

      hasAnyLesson = true;
      const today = new Date().getDay();
      const marker = d === today ? ' 👈' : '';

      text += `📌 <b>${dayName(d)}</b>${marker}\n`;
      text += `┌─────────────────────\n`;

      for (const s of lessons) {
        text += `│ 🕐 ${formatTime(s.startTime)}–${formatTime(s.endTime)}`;
        text += ` | 📖 ${escapeHtml(s.courseName)}\n`;
        text += `│    👨‍🏫 ${escapeHtml(s.teacherName)}`;
        if (s.room) text += ` | 🏫 ${escapeHtml(s.room)}`;
        text += '\n';
      }
      text += `└─────────────────────\n\n`;
    }

    if (!hasAnyLesson) {
      text += '😊 Jadval bo\'sh — hali guruhlar yo\'q.';
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('❌ handleScheduleWeek xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Eski nomdagi export (backward compat) ───────────
export const handleSchedule = handleScheduleToday;
