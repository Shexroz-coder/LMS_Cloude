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

      const monthlyFee = Math.round(totalMonthly - discount);
      if (monthlyFee <= 0) continue;

      const currentBalance = Math.round(Number(student.balance?.balance || 0));
      const currentDebt = Math.round(Number(student.balance?.debt || 0));

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
      let discountDistributed = 0;
      for (let idx = 0; idx < student.groupStudents.length; idx++) {
        const gs = student.groupStudents[idx];
        const baseAmount = Number(gs.group.course.monthlyPrice);
        // Oxirgi guruhga qoldiqni berish (precision yo'qotmaslik uchun)
        const discountPart = idx === student.groupStudents.length - 1
          ? discount - discountDistributed
          : Math.round(discount / student.groupStudents.length);
        discountDistributed += discountPart;

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
//  3. VA'DA SANASI ESLATMA (Har kuni 09:00)
// ══════════════════════════════════════════════════════
export async function sendPromiseDateReminders() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`\n🔔 [CRON] Va'da eslatmalari — ${today.toLocaleDateString('uz')}`);

  try {
    // Bugun yoki o'tgan va'da sanasi bor o'quvchilarni topish
    const studentsWithPromise = await (prisma.studentBalance as any).findMany({
      where: {
        promiseDate: { not: null, lte: tomorrow },
        debt: { gt: 0 },
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true, telegramChatId: true } },
          },
        },
      },
    }) as Array<{
      studentId: number;
      debt: any;
      promiseDate: Date | null;
      promiseAmount: any;
      promiseNote: string | null;
      student: {
        id: number;
        user: { id: number; fullName: string; telegramChatId: string | null };
      };
    }>;

    let sent = 0;

    for (const sb of studentsWithPromise) {
      const promiseDate = new Date(sb.promiseDate!);
      const isToday = promiseDate.getTime() === today.getTime();
      const isOverdue = promiseDate < today;
      const debt = Number(sb.debt);
      const promiseAmount = sb.promiseAmount ? Number(sb.promiseAmount) : debt;
      const promiseDateStr = promiseDate.toLocaleDateString('uz-UZ');

      // O'quvchiga Telegram xabar
      if (sb.student.user.telegramChatId) {
        try {
          let msg = '';
          if (isToday) {
            msg = `⏰ <b>To'lov va'dasi — Bugun!</b>\n\n`;
            msg += `Hurmatli <b>${escapeHtml(sb.student.user.fullName)}</b>,\n\n`;
            msg += `Bugun (${promiseDateStr}) to'lov va'dangiz kuni.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>\n`;
            msg += `🔴 Joriy qarz: <b>${formatMoney(debt)}</b>\n`;
            if (sb.promiseNote) msg += `📌 Izoh: ${sb.promiseNote}\n`;
            msg += `\n✅ Iltimos, bugun to'lovni amalga oshiring.`;
          } else if (isOverdue) {
            msg = `🚨 <b>To'lov va'dasi o'tib ketdi!</b>\n\n`;
            msg += `Hurmatli <b>${escapeHtml(sb.student.user.fullName)}</b>,\n\n`;
            msg += `${promiseDateStr} dagi to'lov va'dangiz muddati o'tdi.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>\n`;
            msg += `🔴 Joriy qarz: <b>${formatMoney(debt)}</b>\n`;
            msg += `\n⚠️ Iltimos, imkon qadar tezroq to'lovni amalga oshiring!`;
          } else {
            // Ertaga
            msg = `📅 <b>To'lov va'dasi — Ertaga!</b>\n\n`;
            msg += `Hurmatli <b>${escapeHtml(sb.student.user.fullName)}</b>,\n\n`;
            msg += `Ertaga (${promiseDateStr}) to'lov va'dangiz kuni.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>\n`;
            msg += `🔴 Joriy qarz: <b>${formatMoney(debt)}</b>\n`;
            msg += `\n📝 Iltimos, to'lovga tayyor bo'ling.`;
          }

          await bot.api.sendMessage(sb.student.user.telegramChatId, msg, { parse_mode: 'HTML' });
          sent++;
        } catch (e) {
          console.error(`  ⚠️ Va'da eslatmasi yuborib bo'lmadi (${sb.student.user.fullName}):`, e);
        }
      }

      // Ota-onaga ham xabar
      const parentUser = await prisma.user.findFirst({
        where: {
          role: 'PARENT',
          parentStudents: { some: { id: sb.student.id } },
          telegramChatId: { not: null },
        },
        select: { telegramChatId: true },
      });

      if (parentUser?.telegramChatId) {
        try {
          let msg = '';
          if (isToday) {
            msg = `⏰ <b>Farzandingiz to'lov va'dasi — Bugun</b>\n\n`;
            msg += `<b>${escapeHtml(sb.student.user.fullName)}</b> bugun to'lov qilishi kerak.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>\n`;
          } else if (isOverdue) {
            msg = `🚨 <b>Farzandingiz to'lov muddati o'tdi</b>\n\n`;
            msg += `<b>${escapeHtml(sb.student.user.fullName)}</b>ning ${promiseDateStr} dagi va'dasi o'tdi.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>\n`;
            msg += `🔴 Qarz: <b>${formatMoney(debt)}</b>`;
          } else {
            msg = `📅 <b>Farzandingiz to'lovi — Ertaga</b>\n\n`;
            msg += `<b>${escapeHtml(sb.student.user.fullName)}</b> ertaga to'lov qilishi kerak.\n`;
            msg += `💰 Summa: <b>${formatMoney(promiseAmount)}</b>`;
          }
          await bot.api.sendMessage(parentUser.telegramChatId, msg, { parse_mode: 'HTML' });
        } catch (e) {
          // ignore
        }
      }

      // Va'da o'tgan bo'lsa — admin uchun notification
      if (isOverdue) {
        await prisma.notification.create({
          data: {
            userId: sb.student.user.id,
            title: 'To\'lov va\'dasi o\'tdi',
            body: `${sb.student.user.fullName} ${promiseDateStr} dagi ${formatMoney(promiseAmount)} to'lov va'dasini bajarmadi.`,
            type: 'PAYMENT',
          },
        });
      }
    }

    console.log(`✅ [CRON] ${sent} ta va'da eslatmasi yuborildi`);
    return { sent };
  } catch (error) {
    console.error('❌ [CRON] Va\'da eslatma xatosi:', error);
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

  // Har kuni 09:00 — va'da sanasi eslatmalari
  cron.schedule('0 9 * * *', async () => {
    console.log('📅 [CRON] Va\'da eslatmalari...');
    try { await sendPromiseDateReminders(); } catch (err) { console.error('❌ [CRON]:', err); }
  }, { timezone: 'Asia/Tashkent' });

  console.log('📅 [CRON] Cron joblar ro\'yxatdan o\'tdi:');
  console.log('   1️⃣ Oylik qarz — har oy 1-kuni 00:01');
  console.log('   2️⃣ To\'lov eslatma — har oy 25-kuni 10:00');
  console.log('   3️⃣ Va\'da eslatma — har kuni 09:00');
}
