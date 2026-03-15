/**
 * Dars eslatmasi cron
 * Har 30 daqiqada tekshiradi — agar 1 soat ichida dars boshlanishi kerak bo'lsa,
 * o'quvchi va ota-onaga Telegram orqali xabar yuboradi.
 * Har bir xabardan keyin admin'ga hisobot yuboradi.
 */
import cron from 'node-cron';
import prisma from '../lib/prisma';
import bot from '../telegram/bot';
import { escapeHtml } from '../telegram/utils/format';

const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

interface MessageLog {
  recipientName: string;
  recipientType: 'student' | 'parent';
  chatId: string;
  status: 'sent' | 'failed';
  error?: string;
  messageId?: number;
}

// ══════════════════════════════════════════════════════
//  DARS ESLATMASI
// ══════════════════════════════════════════════════════
export async function sendLessonReminders() {
  const now = new Date();
  const todayDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  console.log(`\n🔔 [REMINDER] Dars eslatmalari tekshirilmoqda — ${DAY_NAMES[todayDay]} ${now.toLocaleTimeString('uz')}`);

  try {
    // Bugun darsi bor guruhlarni topish
    const groups = await prisma.group.findMany({
      where: {
        status: 'ACTIVE',
        schedules: { some: { daysOfWeek: { has: todayDay } } },
      },
      include: {
        course: { select: { name: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        schedules: { where: { daysOfWeek: { has: todayDay } } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, telegramChatId: true, phone: true } },
              },
            },
          },
        },
      },
    });

    const messageLogs: MessageLog[] = [];
    let totalSent = 0;

    for (const group of groups) {
      for (const schedule of group.schedules) {
        // Dars boshlanish vaqtini olish
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const lessonStartMinutes = startH * 60 + startM;

        // Faqat 30-60 daqiqa ichida boshlanadigan darslarga xabar
        const diff = lessonStartMinutes - currentMinutes;
        if (diff < 30 || diff > 60) continue;

        const lessonTime = `${schedule.startTime} — ${schedule.endTime}`;
        const room = schedule.room ? ` | 🏠 ${schedule.room}` : '';

        for (const gs of group.groupStudents) {
          const student = gs.student;
          const msgText = `🔔 <b>Dars eslatmasi</b>\n\n` +
            `📚 <b>${escapeHtml(group.course.name)}</b>\n` +
            `👨‍🏫 ${escapeHtml(group.teacher.user.fullName)}\n` +
            `🕐 ${lessonTime}${room}\n` +
            `📅 ${DAY_NAMES[todayDay]}\n\n` +
            `⏰ Dars <b>${diff}</b> daqiqadan keyin boshlanadi!`;

          // O'quvchiga xabar
          if (student.user.telegramChatId) {
            try {
              const sent = await bot.api.sendMessage(student.user.telegramChatId, msgText, { parse_mode: 'HTML' });
              messageLogs.push({
                recipientName: student.user.fullName,
                recipientType: 'student',
                chatId: student.user.telegramChatId,
                status: 'sent',
                messageId: sent.message_id,
              });
              totalSent++;
            } catch (e: any) {
              messageLogs.push({
                recipientName: student.user.fullName,
                recipientType: 'student',
                chatId: student.user.telegramChatId,
                status: 'failed',
                error: e.message?.slice(0, 100),
              });
            }
          }

          // Ota-onaga xabar
          const parentUser = await prisma.user.findFirst({
            where: {
              role: 'PARENT',
              parentStudents: { some: { id: student.id } },
              telegramChatId: { not: null },
            },
            select: { telegramChatId: true, fullName: true },
          });

          if (parentUser?.telegramChatId) {
            const parentMsg = `🔔 <b>Dars eslatmasi</b>\n\n` +
              `👦 <b>${escapeHtml(student.user.fullName)}</b>ning darsi:\n` +
              `📚 ${escapeHtml(group.course.name)}\n` +
              `👨‍🏫 ${escapeHtml(group.teacher.user.fullName)}\n` +
              `🕐 ${lessonTime}${room}\n\n` +
              `⏰ Dars <b>${diff}</b> daqiqadan keyin boshlanadi!`;

            try {
              const sent = await bot.api.sendMessage(parentUser.telegramChatId, parentMsg, { parse_mode: 'HTML' });
              messageLogs.push({
                recipientName: parentUser.fullName,
                recipientType: 'parent',
                chatId: parentUser.telegramChatId,
                status: 'sent',
                messageId: sent.message_id,
              });
              totalSent++;
            } catch (e: any) {
              messageLogs.push({
                recipientName: parentUser.fullName,
                recipientType: 'parent',
                chatId: parentUser.telegramChatId,
                status: 'failed',
                error: e.message?.slice(0, 100),
              });
            }
          }
        }
      }
    }

    // Admin'ga hisobot yuborish
    if (messageLogs.length > 0) {
      await sendAdminReport('🔔 Dars eslatmasi', messageLogs, totalSent);
    }

    console.log(`✅ [REMINDER] ${totalSent} ta eslatma yuborildi`);
    return { totalSent, logs: messageLogs };
  } catch (error) {
    console.error('❌ [REMINDER] Xatolik:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  ADMIN'GA HISOBOT YUBORISH
// ══════════════════════════════════════════════════════
export async function sendAdminReport(title: string, logs: MessageLog[], totalSent: number) {
  try {
    // Admin foydalanuvchilarni topish
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });

    if (admins.length === 0) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('uz');

    const sent = logs.filter(l => l.status === 'sent');
    const failed = logs.filter(l => l.status === 'failed');
    const students = logs.filter(l => l.recipientType === 'student' && l.status === 'sent');
    const parents = logs.filter(l => l.recipientType === 'parent' && l.status === 'sent');

    let report = `📋 <b>XABAR HISOBOTI</b>\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📌 ${title}\n`;
    report += `📅 ${dateStr} | 🕐 ${timeStr}\n\n`;

    report += `┌─ 📊 <b>Natija</b>\n`;
    report += `│  ✅ Yuborildi: <b>${totalSent}</b>\n`;
    report += `│  🎓 O'quvchilar: <b>${students.length}</b>\n`;
    report += `│  👨‍👩‍👧 Ota-onalar: <b>${parents.length}</b>\n`;
    if (failed.length > 0) {
      report += `│  ❌ Xato: <b>${failed.length}</b>\n`;
    }
    report += `└────────────────────\n\n`;

    // Ro'yxat (max 30 ta)
    if (sent.length > 0) {
      report += `<b>✅ Yuborilganlar:</b>\n`;
      for (const l of sent.slice(0, 30)) {
        const icon = l.recipientType === 'student' ? '🎓' : '👨‍👩‍👧';
        report += `${icon} ${escapeHtml(l.recipientName)}\n`;
      }
      if (sent.length > 30) {
        report += `<i>... va yana ${sent.length - 30} ta</i>\n`;
      }
      report += '\n';
    }

    if (failed.length > 0) {
      report += `<b>❌ Xatoliklar:</b>\n`;
      for (const l of failed.slice(0, 10)) {
        const icon = l.recipientType === 'student' ? '🎓' : '👨‍👩‍👧';
        report += `${icon} ${escapeHtml(l.recipientName)}: ${l.error || 'noma\'lum'}\n`;
      }
      report += '\n';
    }

    // Admin'ga yuborish
    for (const admin of admins) {
      if (admin.telegramChatId) {
        try {
          await bot.api.sendMessage(admin.telegramChatId, report, { parse_mode: 'HTML' });
        } catch (e) {
          console.error('❌ Admin hisobot xatosi:', e);
        }
      }
    }
  } catch (error) {
    console.error('❌ Admin hisobot xatosi:', error);
  }
}

// ══════════════════════════════════════════════════════
//  CRON ISHGA TUSHIRISH
// ══════════════════════════════════════════════════════
export function startLessonReminderCron() {
  // Har 30 daqiqada tekshirish (soat 07:00 — 21:00)
  cron.schedule('*/30 7-21 * * *', async () => {
    try {
      await sendLessonReminders();
    } catch (err) {
      console.error('❌ [REMINDER] Cron xato:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  console.log('🔔 [REMINDER] Dars eslatma cron ro\'yxatdan o\'tdi (har 30 daq, 07:00-21:00)');
}
