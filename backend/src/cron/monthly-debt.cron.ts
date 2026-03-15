/**
 * Oylik qarzdorlik hisoblash + To'lov eslatma cron
 *
 * 1. Har oy 1-sanasi 00:01 — qarz hisoblash
 * 2. Har oy 25-sanasi 10:00 — keyingi oy to'lov eslatmasi
 */
import cron from 'node-cron';
import prisma from '../lib/prisma';
import bot from '../telegram/bot';
import { escapeHtml } from '../telegram/utils/format';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

function formatMoney(amount: number): string {
  return amount.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}

// ══════════════════════════════════════════════════════
//  1. OYLIK QARZ HISOBLASH (Har oy 1-kuni)
// ══════════════════════════════════════════════════════
export async function calculateMonthlyDebts() {
  const now = new Date();
  console.log(`\n📊 [CRON] Oylik qarzdorlik hisoblash — ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`);

  try {
    const activeStudents = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { fullName: true, id: true, telegramChatId: true } },
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                course: { select: { monthlyPrice: true, name: true } },
              },
            },
          },
        },
      },
    });

    let processed = 0;
    let totalDebtAdded = 0;
    const monthName = MONTH_NAMES[now.getMonth()];

    for (const student of activeStudents) {
      let totalMonthly = 0;
      const courseNames: string[] = [];

      for (const gs of student.groupStudents) {
        totalMonthly += Number(gs.group.course.monthlyPrice);
        courseNames.push(gs.group.course.name);
      }

      if (totalMonthly === 0) continue;

      // Chegirma
      let discount = 0;
      if (student.discountType && student.discountValue) {
        const discountVal = Number(student.discountValue);
        if (student.discountType === 'PERCENTAGE') {
          discount = Math.round(totalMonthly * discountVal / 100);
        } else if (student.discountType === 'FIXED_AMOUNT') {
          discount = discountVal;
        }
      }

      const monthlyFee = totalMonthly - discount;
      if (monthlyFee <= 0) continue;

      const currentBalance = Number(student.balance?.balance || 0);
      const currentDebt = Number(student.balance?.debt || 0);

      let newBalance = currentBalance;
      let newDebt = currentDebt;

      if (currentBalance >= monthlyFee) {
        newBalance = currentBalance - monthlyFee;
      } else {
        const remaining = monthlyFee - currentBalance;
        newBalance = 0;
        newDebt = currentDebt + remaining;
      }

      await prisma.studentBalance.upsert({
        where: { studentId: student.id },
        update: { balance: newBalance, debt: newDebt, lastUpdated: new Date() },
        create: { studentId: student.id, balance: 0, debt: monthlyFee, lastUpdated: new Date() },
      });

      // MonthlyFee yozish (hisobot uchun)
      for (const gs of student.groupStudents) {
        const baseAmount = Number(gs.group.course.monthlyPrice);
        const discountPart = student.groupStudents.length > 0
          ? Math.round(discount / student.groupStudents.length) : 0;

        await prisma.monthlyFee.upsert({
          where: {
            studentId_groupId_month: {
              studentId: student.id,
              groupId: gs.groupId,
              month: new Date(now.getFullYear(), now.getMonth(), 1),
            },
          },
          update: {
            baseAmount,
            discountAmount: discountPart,
            finalAmount: baseAmount - discountPart,
          },
          create: {
            studentId: student.id,
            groupId: gs.groupId,
            month: new Date(now.getFullYear(), now.getMonth(), 1),
            baseAmount,
            discountAmount: discountPart,
            finalAmount: baseAmount - discountPart,
          },
        });
      }

      // Telegram xabar — qarz haqida
      if (newDebt > 0 && student.user.telegramChatId) {
        try {
          let msg = `📋 <b>Oylik hisob — ${monthName}</b>\n\n`;
          msg += `📚 Kurslar: ${courseNames.join(', ')}\n`;
          msg += `💰 Oylik to'lov: <b>${formatMoney(monthlyFee)}</b>\n`;
          if (discount > 0) msg += `🏷 Chegirma: -${formatMoney(discount)}\n`;
          msg += `\n🔴 Sizning qarzingiz: <b>${formatMoney(newDebt)}</b>\n\n`;
          msg += `⚠️ Iltimos, to'lovni o'z vaqtida amalga oshiring.`;

          await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
        } catch (e) {
          console.error(`  ⚠️ Telegram xabar yuborishda xato (${student.user.fullName}):`, e);
        }
      }

      // Notification yaratish
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: `${monthName} oyi to'lov`,
          body: newDebt > 0
            ? `${monthName} oyi uchun ${formatMoney(monthlyFee)} to'lov hisoblandi. Qarzingiz: ${formatMoney(newDebt)}`
            : `${monthName} oyi to'lovi balansdan avtomatik yechildi.`,
          type: 'PAYMENT',
        },
      });

      processed++;
      totalDebtAdded += Math.max(0, newDebt - currentDebt);
    }

    console.log(`✅ [CRON] Oylik qarz hisoblash tugadi: ${processed} ta, +${totalDebtAdded} so'm`);
    return { processed, totalDebtAdded };
  } catch (error) {
    console.error('❌ [CRON] Xatolik:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  2. TO'LOV ESLATMA (Har oy 25-kuni)
// ══════════════════════════════════════════════════════
export async function sendPaymentReminders() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthName = MONTH_NAMES[nextMonth.getMonth()];

  console.log(`\n🔔 [CRON] To'lov eslatmasi — ${nextMonthName} ${nextMonth.getFullYear()} uchun`);

  try {
    const activeStudents = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { fullName: true, id: true, telegramChatId: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: { include: { course: { select: { monthlyPrice: true, name: true } } } },
          },
        },
      },
    });

    let sent = 0;

    for (const student of activeStudents) {
      let totalMonthly = 0;
      const courseNames: string[] = [];

      for (const gs of student.groupStudents) {
        totalMonthly += Number(gs.group.course.monthlyPrice);
        courseNames.push(gs.group.course.name);
      }

      if (totalMonthly === 0) continue;

      // Chegirma
      let discount = 0;
      if (student.discountType && student.discountValue) {
        const discountVal = Number(student.discountValue);
        if (student.discountType === 'PERCENTAGE') {
          discount = Math.round(totalMonthly * discountVal / 100);
        } else if (student.discountType === 'FIXED_AMOUNT') {
          discount = discountVal;
        }
      }

      const monthlyFee = totalMonthly - discount;
      if (monthlyFee <= 0) continue;

      // Telegram xabar
      if (student.user.telegramChatId) {
        try {
          let msg = `🔔 <b>To'lov eslatmasi</b>\n\n`;
          msg += `Hurmatli <b>${escapeHtml(student.user.fullName)}</b>,\n\n`;
          msg += `Siz <b>${nextMonthName}</b> oyi uchun <b>${formatMoney(monthlyFee)}</b> to'lovni amalga oshirishingiz kerak.\n\n`;
          msg += `📚 Kurslar: ${courseNames.join(', ')}\n`;
          if (discount > 0) msg += `🏷 Chegirma: -${formatMoney(discount)}\n`;
          msg += `💰 To'lov summasi: <b>${formatMoney(monthlyFee)}</b>\n\n`;
          msg += `⏰ Iltimos, oy boshigacha to'lovni amalga oshiring.`;

          await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
          sent++;
        } catch (e) {
          console.error(`  ⚠️ Eslatma yuborib bo'lmadi (${student.user.fullName}):`, e);
        }
      }

      // Ota-onaga ham xabar
      const parentUser = await prisma.user.findFirst({
        where: {
          role: 'PARENT',
          parentStudents: { some: { id: student.id } },
          telegramChatId: { not: null },
        },
        select: { telegramChatId: true, fullName: true },
      });

      if (parentUser?.telegramChatId) {
        try {
          let msg = `🔔 <b>To'lov eslatmasi</b>\n\n`;
          msg += `Hurmatli ota-ona,\n\n`;
          msg += `<b>${escapeHtml(student.user.fullName)}</b> uchun <b>${nextMonthName}</b> oyi to'lovi:\n`;
          msg += `💰 <b>${formatMoney(monthlyFee)}</b>\n\n`;
          msg += `📚 ${courseNames.join(', ')}\n`;
          msg += `⏰ Iltimos, oy boshigacha to'lovni amalga oshiring.`;

          await bot.api.sendMessage(parentUser.telegramChatId, msg, { parse_mode: 'HTML' });
        } catch (e) {
          // ignore
        }
      }

      // Notification
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: `${nextMonthName} to'lov eslatmasi`,
          body: `${nextMonthName} oyi uchun ${formatMoney(monthlyFee)} to'lov kerak.`,
          type: 'PAYMENT',
        },
      });
    }

    console.log(`✅ [CRON] ${sent} ta o'quvchiga to'lov eslatmasi yuborildi`);
    return { sent };
  } catch (error) {
    console.error('❌ [CRON] Eslatma xatosi:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  CRON JOBLARNI ISHGA TUSHIRISH
// ══════════════════════════════════════════════════════
export function startMonthlyDebtCron() {
  // Har oy 1-sanasi 00:01 — qarz hisoblash
  cron.schedule('1 0 1 * *', async () => {
    console.log('🔄 [CRON] Oylik qarz hisoblash...');
    try { await calculateMonthlyDebts(); } catch (err) { console.error('❌ [CRON]:', err); }
  }, { timezone: 'Asia/Tashkent' });

  // Har oy 25-sanasi 10:00 — to'lov eslatmasi
  cron.schedule('0 10 25 * *', async () => {
    console.log('🔔 [CRON] To\'lov eslatmalari...');
    try { await sendPaymentReminders(); } catch (err) { console.error('❌ [CRON]:', err); }
  }, { timezone: 'Asia/Tashkent' });

  console.log('📅 [CRON] Cron joblar ro\'yxatdan o\'tdi:');
  console.log('   1️⃣ Oylik qarz — har oy 1-kuni 00:01');
  console.log('   2️⃣ To\'lov eslatma — har oy 25-kuni 10:00');
}
