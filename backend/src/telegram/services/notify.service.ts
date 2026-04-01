/**
 * Telegram orqali notification yuborish xizmati
 * Mavjud Socket.io notification tizimiga parallel ishlatiladi
 */
import prisma from '../../lib/prisma';
import bot from '../bot';
import { escapeHtml, formatMoney, formatDate, attendanceEmoji, getBrandName } from '../utils/format';

// ── ADMIN HISOBOT — har bir yuborilgan xabar haqida ──────
async function notifyAdmin(
  recipientName: string,
  recipientRole: string,
  messageType: string,
  messageSummary: string,
) {
  try {
    const adminChatId = process.env.TELEGRAM_ADMIN_ID;
    if (!adminChatId) return;

    const now = new Date();
    const timeStr = now.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const text =
      `📋 <b>BOT HISOBOT</b>\n\n` +
      `📨 Turi: <b>${escapeHtml(messageType)}</b>\n` +
      `👤 Kimga: <b>${escapeHtml(recipientName)}</b> (${recipientRole})\n` +
      `📝 Mazmuni: ${escapeHtml(messageSummary)}\n` +
      `🕐 Vaqt: ${timeStr}\n\n` +
      `<i>🤖 Avtomatik hisobot</i>`;

    await bot.api.sendMessage(adminChatId, text, { parse_mode: 'HTML' });

    // LMS platformada ham notification yaratish
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (admin) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Bot xabar: ${messageType}`,
          body: `${recipientName} (${recipientRole}) ga yuborildi: ${messageSummary}`,
          type: 'SYSTEM',
        },
      });
    }
  } catch (e) {
    // Admin notification xatosi boshqa jarayonlarga ta'sir qilmasin
    console.error('Admin hisobot xatosi:', e);
  }
}

// ── Umumiy notification yuborish ──────────────────
export async function sendTelegramNotification(userId: number, notification: {
  title: string;
  message: string;
  type?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });

    if (!user?.telegramChatId) return;

    const typeEmoji: Record<string, string> = {
      INFO: 'ℹ️',
      WARNING: '⚠️',
      SUCCESS: '✅',
      ERROR: '❌',
      PAYMENT: '💰',
      ATTENDANCE: '✅',
      GRADE: '📊',
      ANNOUNCEMENT: '📢',
    };

    const emoji = typeEmoji[notification.type || 'INFO'] || '🔔';

    const text =
      `${emoji} <b>${escapeHtml(notification.title)}</b>\n\n` +
      `${escapeHtml(notification.message)}\n\n` +
      `<i>🤖 ${getBrandName()}</i>`;

    await bot.api.sendMessage(user.telegramChatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Telegram notification yuborishda xato:', err);
  }
}

// ── Davomat xabari (o'quvchi va ota-onaga) ────────
export async function sendAttendanceNotification(
  studentId: number,
  status: string,
  courseName: string,
  date: Date
) {
  try {
    // O'quvchini topish
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, fullName: true, telegramChatId: true } },
      },
    });

    if (!student) return;

    const emoji = attendanceEmoji(status);
    const dateStr = formatDate(date);
    const statusLabel = status === 'PRESENT' ? 'Keldi' : status === 'ABSENT' ? 'Kelmadi' : status === 'LATE' ? 'Kechikdi' : status;

    const text =
      `${emoji} <b>Davomat</b>\n\n` +
      `👤 ${escapeHtml(student.user.fullName)}\n` +
      `📚 ${escapeHtml(courseName)}\n` +
      `📅 ${dateStr}\n` +
      `📋 Status: <b>${statusLabel}</b>\n\n` +
      `<i>🤖 ${getBrandName()}</i>`;

    // O'quvchiga yuborish
    if (student.user.telegramChatId) {
      await bot.api.sendMessage(student.user.telegramChatId, text, { parse_mode: 'HTML' });
      await notifyAdmin(student.user.fullName, 'O\'quvchi', 'Davomat', `${statusLabel} — ${courseName} (${dateStr})`);
    }

    // Ota-onaga yuborish
    if (student.parentId) {
      const parent = await prisma.user.findUnique({
        where: { id: student.parentId },
        select: { telegramChatId: true, fullName: true },
      });
      if (parent?.telegramChatId) {
        await bot.api.sendMessage(parent.telegramChatId, text, { parse_mode: 'HTML' });
        await notifyAdmin(parent.fullName || 'Ota-ona', 'Ota-ona', 'Davomat', `${student.user.fullName}: ${statusLabel} — ${courseName}`);
      }
    }
  } catch (err) {
    console.error('Davomat Telegram xabari xatosi:', err);
  }
}

// ── Qarz xabari ───────────────────────────────────
export async function sendDebtNotification(
  studentId: number,
  debtAmount: number,
  courseName: string
) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, fullName: true, telegramChatId: true } },
      },
    });

    if (!student) return;

    const text =
      `🔴 <b>Qarz xabari</b>\n\n` +
      `👤 ${escapeHtml(student.user.fullName)}\n` +
      `📚 ${escapeHtml(courseName)}\n` +
      `💰 Qarz: <b>${formatMoney(debtAmount)}</b>\n\n` +
      `Iltimos, to'lovni amalga oshiring.\n\n` +
      `<i>🤖 ${getBrandName()}</i>`;

    // O'quvchiga yuborish
    if (student.user.telegramChatId) {
      await bot.api.sendMessage(student.user.telegramChatId, text, { parse_mode: 'HTML' });
      await notifyAdmin(student.user.fullName, 'O\'quvchi', 'Qarz', `${formatMoney(debtAmount)} — ${courseName}`);
    }

    // Ota-onaga yuborish
    if (student.parentId) {
      const parent = await prisma.user.findUnique({
        where: { id: student.parentId },
        select: { telegramChatId: true, fullName: true },
      });
      if (parent?.telegramChatId) {
        await bot.api.sendMessage(parent.telegramChatId, text, { parse_mode: 'HTML' });
        await notifyAdmin(parent.fullName || 'Ota-ona', 'Ota-ona', 'Qarz', `${student.user.fullName}: ${formatMoney(debtAmount)}`);
      }
    }
  } catch (err) {
    console.error('Qarz Telegram xabari xatosi:', err);
  }
}

// ── To'lov tasdiqlash xabari ──────────────────────
export async function sendPaymentNotification(
  studentId: number,
  amount: number,
  method: string
) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { telegramChatId: true, fullName: true } },
      },
    });

    if (!student) return;

    const text =
      `✅ <b>To'lov qabul qilindi</b>\n\n` +
      `👤 ${escapeHtml(student.user.fullName)}\n` +
      `💰 Miqdor: <b>${formatMoney(amount)}</b>\n` +
      `💳 Usul: ${method}\n` +
      `📅 ${formatDate(new Date())}\n\n` +
      `<i>🤖 ${getBrandName()}</i>`;

    // O'quvchiga
    if (student.user.telegramChatId) {
      await bot.api.sendMessage(student.user.telegramChatId, text, { parse_mode: 'HTML' });
      await notifyAdmin(student.user.fullName, 'O\'quvchi', 'To\'lov', `${formatMoney(amount)} (${method})`);
    }

    // Ota-onaga
    if (student.parentId) {
      const parent = await prisma.user.findUnique({
        where: { id: student.parentId },
        select: { telegramChatId: true, fullName: true },
      });
      if (parent?.telegramChatId) {
        await bot.api.sendMessage(parent.telegramChatId, text, { parse_mode: 'HTML' });
        await notifyAdmin(parent.fullName || 'Ota-ona', 'Ota-ona', 'To\'lov', `${student.user.fullName}: ${formatMoney(amount)}`);
      }
    }
  } catch (err) {
    console.error('To\'lov Telegram xabari xatosi:', err);
  }
}

// ── E'lon (announcement) yuborish ─────────────────
export async function sendAnnouncementToAll(title: string, content: string) {
  try {
    const users = await prisma.user.findMany({
      where: {
        telegramChatId: { not: null },
        isActive: true,
      },
      select: { telegramChatId: true },
    });

    const text =
      `📢 <b>${escapeHtml(title)}</b>\n\n` +
      `${escapeHtml(content)}\n\n` +
      `<i>🤖 ${getBrandName()}</i>`;

    let sent = 0;
    for (const u of users) {
      if (u.telegramChatId) {
        try {
          await bot.api.sendMessage(u.telegramChatId, text, { parse_mode: 'HTML' });
          sent++;
        } catch { /* User may have blocked the bot */ }
      }
    }

    console.log(`📢 Telegram e'lon yuborildi: ${sent}/${users.length} foydalanuvchiga`);
    await notifyAdmin('Hammaga', 'Barcha foydalanuvchilar', 'E\'lon', `${title} — ${sent} ta foydalanuvchiga yuborildi`);
    return sent;
  } catch (err) {
    console.error('E\'lon Telegram xabari xatosi:', err);
    return 0;
  }
}
