/**
 * 👤 Profil handler — To'liq ma'lumot + Guruhlar + Jadval
 */
import { BotContext } from '../bot';
import { getUserByChatId, getStudentProfile, getAttendanceStats, getStudentRank } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatDate, formatMoney, dayNameShort, formatTime, escapeHtml, progressBar, rankEmoji, brandHeader, brandFooter } from '../utils/format';

export async function handleProfile(ctx: BotContext, studentId?: number) {
  try {
    const chatId = String(ctx.chat?.id);

    if (!studentId) {
      const user = await getUserByChatId(chatId);
      if (!user?.student) {
        // Ota-ona yoki boshqa rol
        if (user) {
          let text = brandHeader('👤', 'PROFIL');
          text += `👤 <b>${escapeHtml(user.fullName)}</b>\n`;
          text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
          text += `📱 Telefon: ${user.phone}\n`;
          text += `🏷 Rol: ${user.role}\n`;
          text += `📅 Ro'yxatdan: ${formatDate(user.createdAt)}\n`;

          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
          return;
        }
        await ctx.editMessageText('❌ Foydalanuvchi topilmadi.', { reply_markup: backToMenu() });
        return;
      }
      studentId = user.student.id;
    }

    const [student, stats, rankInfo] = await Promise.all([
      getStudentProfile(studentId!),
      getAttendanceStats(studentId!),
      getStudentRank(studentId!),
    ]);

    if (!student) {
      await ctx.editMessageText('❌ O\'quvchi topilmadi.', { reply_markup: backToMenu() });
      return;
    }

    let text = brandHeader('👤', 'PROFIL');

    // ── Shaxsiy ma'lumotlar ──
    text += `👤 <b>${escapeHtml(student.user.fullName)}</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📱 Telefon: ${student.user.phone}\n`;
    text += `📅 Ro'yxatdan: ${formatDate(student.user.createdAt)}\n\n`;

    // ── Moliyaviy holat ──
    const balance = Number(student.balance?.balance || 0);
    const debt = Number(student.balance?.debt || 0);

    text += `💳 <b>Moliya</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 Balans: <b>${formatMoney(balance)}</b>\n`;
    if (debt > 0) {
      text += `🔴 Qarz: <b>${formatMoney(debt)}</b>\n`;
    } else {
      text += `🟢 Qarz: yo'q\n`;
    }
    text += `🪙 Tangalar: <b>${student.coinBalance || 0}</b>`;
    if (rankInfo) text += ` (${rankEmoji(rankInfo.rank)} ${rankInfo.rank}-o'rin)`;
    text += '\n\n';

    // ── Davomat statistika ──
    text += `✅ <b>Davomat</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${progressBar(stats.allTime.rate)} <b>${stats.allTime.rate}%</b>\n`;
    text += `Jami: ${stats.allTime.total} dars | ✅ ${stats.allTime.present} | ❌ ${stats.allTime.absent}\n\n`;

    // ── Guruhlar ──
    if (student.groupStudents.length > 0) {
      text += `📚 <b>Guruhlar</b> (${student.groupStudents.length} ta)\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const gs of student.groupStudents) {
        const g = gs.group;
        text += `├ 📖 <b>${escapeHtml(g.name)}</b>\n`;
        text += `│  Kurs: ${escapeHtml(g.course.name)}\n`;
        text += `│  Ustoz: ${escapeHtml(g.teacher.user.fullName)}\n`;

        if (g.schedules.length > 0) {
          for (const sc of g.schedules) {
            const days = sc.daysOfWeek.map((d: number) => dayNameShort(d)).join(', ');
            text += `│  📅 ${days} | ${formatTime(sc.startTime)}–${formatTime(sc.endTime)}`;
            if (sc.room) text += ` | 🏫 ${sc.room}`;
            text += '\n';
          }
        }
        text += '│\n';
      }
      text += `└─────────────────────\n`;
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleProfile xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
