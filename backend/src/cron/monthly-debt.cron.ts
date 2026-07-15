process.env.TZ = 'Asia/Tashkent';

/**
 * Oylik qarzdorlik hisoblash — SODDALASHTIRILGAN
 *
 * Qoidalar:
 * 1. Qarz = monthlyPrice - discount (FAQAT shuncha, bayram yoki pro-rata yo'q)
 * 2. To'lov sanasi = o'quvchi guruhga qo'shilgan kun (joinedAt.getDate())
 *    Masalan: 15-iyunda kelgan → har oyning 15-sida to'laydi
 * 3. Telegram xabarlari TO'LIQ O'CHIRILDI
 *    Admin "Eslatmalar" sahifasidan o'zi xoxlaganda yuboradi
 * 4. Cron har kuni 00:01 da ishlaydi va "bugun to'lov kuni kelganlar"ni tekshiradi
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import bot from '../telegram/bot';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

function formatMoney(amount: number): string {
  return amount.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}

// ══════════════════════════════════════════════════════
//  KUNLIK QARZ TEKSHIRUVI
//  Har kuni 00:01 da ishlaydi
//  Bugun to'lov kuni kelgan o'quvchilar uchun qarz qo'shiladi
// ══════════════════════════════════════════════════════
export async function calculateMonthlyDebts() {
  const now = new Date();
  const today = now.getDate();           // Bugungi sana (1-31)
  const currentMonth = now.getMonth();   // Joriy oy (0-11)
  const currentYear = now.getFullYear();
  const monthName = MONTH_NAMES[currentMonth];
  const monthStart = new Date(currentYear, currentMonth, 1);

  console.log(`\n📊 [CRON] Kunlik qarz tekshiruvi — ${today}-${monthName} ${currentYear}`);

  try {
    const activeStudents = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { fullName: true, id: true } },
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

    for (const student of activeStudents) {
      if (!student.groupStudents.length) continue;

      // ── To'lov kunini aniqlash ──
      // Ustuvor: student.paymentDueDay (admin belgilagan)
      // Zaxira:  eng erta qo'shilgan guruhning joinedAt.getDate()
      const sortedGroups = [...student.groupStudents].sort(
        (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      );
      const paymentDayRaw: number =
        (student as any).paymentDueDay ?? new Date(sortedGroups[0].joinedAt).getDate();

      // Oyning oxiridagi kunlarni moslashtirish
      // (masalan, 31-yanvarda kelgan → Fevralda 28/29-da to'laydi)
      const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const effectivePaymentDay = Math.min(paymentDayRaw, daysInCurrentMonth);

      // Bugun to'lov kuni emas → o'tkazib yuborish
      if (today !== effectivePaymentDay) continue;

      // ── Shu oy allaqachon hisoblangan bo'lsa → o'tkazib yuborish ──
      const existingFee = await prisma.monthlyFee.findFirst({
        where: {
          studentId: student.id,
          month: { gte: monthStart, lt: new Date(currentYear, currentMonth + 1, 1) },
        },
      });
      if (existingFee) {
        console.log(`  ⏭️  ${student.user.fullName} — shu oy allaqachon hisoblangan`);
        continue;
      }

      // ── Oylik summa hisoblash: FAQAT monthlyPrice - discount ──
      let totalMonthly = 0;
      const courseNames: string[] = [];
      for (const gs of student.groupStudents) {
        totalMonthly += Number(gs.group.course.monthlyPrice);
        courseNames.push(gs.group.course.name);
      }
      if (totalMonthly === 0) continue;

      // Chegirma hisoblash
      let discount = 0;
      if (student.discountType && student.discountValue) {
        const discountVal = Number(student.discountValue);
        if (student.discountType === 'PERCENTAGE') {
          discount = Math.round(totalMonthly * discountVal / 100);
        } else if (student.discountType === 'FIXED_AMOUNT') {
          discount = Math.min(discountVal, totalMonthly);
        }
      }

      const monthlyFee = totalMonthly - discount; // ← Kelishilgan summa
      if (monthlyFee <= 0) continue;

      // ── MonthlyFee yozuvlarini yaratish (guruhlar bo'yicha) ──
      let discountDistributed = 0;
      for (let idx = 0; idx < student.groupStudents.length; idx++) {
        const gs = student.groupStudents[idx];
        const baseAmount = Number(gs.group.course.monthlyPrice);
        const discountPart =
          idx === student.groupStudents.length - 1
            ? discount - discountDistributed
            : Math.round(discount / student.groupStudents.length);
        discountDistributed += discountPart;
        const finalAmount = baseAmount - discountPart;

        try {
          // Faqat Prisma client bilgan maydonlar (regenerate kerak emas)
          await (prisma.monthlyFee as any).create({
            data: {
              studentId: student.id,
              groupId: gs.groupId,
              month: monthStart,
              baseAmount,
              discountAmount: discountPart,
              finalAmount,
            },
          });
        } catch (e: any) {
          // Unique constraint xatosi — allaqachon mavjud
          if (e.code !== 'P2002') console.error('  ⚠️ MonthlyFee yaratishda xato:', e.message);
        }
      }

      // ── Balansdan yechish yoki qarzga qo'shish ──
      const currentBalance = Math.round(Number(student.balance?.balance || 0));
      const currentDebt = Math.round(Number(student.balance?.debt || 0));

      let newBalance = currentBalance;
      let newDebt = currentDebt;

      if (currentBalance >= monthlyFee) {
        // Balans yetarli — to'liq yeching
        newBalance = currentBalance - monthlyFee;
      } else {
        // Balans yetmaydi — qoldiqni qarzga o'tkazing
        const shortfall = monthlyFee - currentBalance;
        newBalance = 0;
        newDebt = currentDebt + shortfall;
      }

      await prisma.studentBalance.upsert({
        where: { studentId: student.id },
        update: { balance: newBalance, debt: newDebt, lastUpdated: new Date() },
        create: { studentId: student.id, balance: 0, debt: monthlyFee, lastUpdated: new Date() },
      });

      // ── O'quvchiga tizim bildirishnomasi (Telegram YO'Q) ──
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: `${monthName} oyi to'lov`,
          body: newBalance < currentBalance
            ? `${monthName} oyi uchun ${formatMoney(monthlyFee)} balansdan yechildi.`
            : `${monthName} oyi uchun ${formatMoney(monthlyFee)} to'lov hisoblandi. Qarzingiz: ${formatMoney(newDebt)}`,
          type: 'PAYMENT',
        },
      });

      processed++;
      totalDebtAdded += Math.max(0, newDebt - currentDebt);

      console.log(
        `  ✅ ${student.user.fullName}: ${formatMoney(monthlyFee)} ` +
        `(balance: ${formatMoney(newBalance)}, debt: ${formatMoney(newDebt)})`
      );
    }

    // ── Admin xabarlari ──
    if (processed > 0) {
      // Admin Telegram (faqat admin uchun xulosa — o'quvchilarga emas)
      const adminChatId = process.env.TELEGRAM_ADMIN_ID;
      if (adminChatId) {
        try {
          const msg =
            `📊 <b>Oylik Qarz Hisoblash</b>\n\n` +
            `📅 <b>${today}-${monthName} ${currentYear}</b>\n` +
            `👥 Hisoblangan: <b>${processed}</b> ta o'quvchi\n` +
            `💰 Qo'shilgan qarz: <b>${formatMoney(totalDebtAdded)}</b>\n\n` +
            `✅ Muvaffaqiyatli\n` +
            `💡 Eslatmalarni "Eslatmalar" sahifasidan yuboring`;
          await bot.api.sendMessage(adminChatId, msg, { parse_mode: 'HTML' });
        } catch (e) {
          console.error('❌ Admin Telegram xatosi:', e);
        }
      }

      // Admin LMS notification
      try {
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admin) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: `${today}-${monthName} qarz hisoblash`,
              body: `${processed} ta o'quvchining oylik to'lovi hisoblandi. Jami: ${formatMoney(totalDebtAdded)}. "Eslatmalar" sahifasidan xabar yuboring.`,
              type: 'SYSTEM',
            },
          });
        }
      } catch (e) {
        console.error('❌ Admin notification xatosi:', e);
      }
    } else {
      console.log(`  ℹ️  Bugun to'lov kuni bo'lgan o'quvchilar yo'q (${today}-${monthName})`);
    }

    console.log(`✅ [CRON] Kunlik tekshiruv tugadi: ${processed} ta, +${formatMoney(totalDebtAdded)}`);
    return { processed, totalDebtAdded };
  } catch (error) {
    console.error('❌ [CRON] Xatolik:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  VA'DA SANASI ESLATMA (Har kuni 09:00)
//  Admin to'lov va'da sanasi belgilagan o'quvchilarga eslatma
// ══════════════════════════════════════════════════════
export async function sendPromiseDateReminders() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`\n🔔 [CRON] Va'da eslatmalari — ${today.toLocaleDateString('uz')}`);

  try {
    const studentsWithPromise = await (prisma.studentBalance as any).findMany({
      where: {
        promiseDate: { not: null, lte: tomorrow },
        debt: { gt: 0 },
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true } },
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
        user: { id: number; fullName: string };
      };
    }>;

    let notified = 0;

    for (const sb of studentsWithPromise) {
      const promiseDate = new Date(sb.promiseDate!);
      const isOverdue = promiseDate < today;
      const debt = Number(sb.debt);
      const promiseAmount = sb.promiseAmount ? Number(sb.promiseAmount) : debt;
      const promiseDateStr = promiseDate.toLocaleDateString('uz-UZ');

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
        notified++;
      }
      // Telegram — O'CHIRILDI. Admin o'zi "Eslatmalar" sahifasidan yuboradi.
    }

    console.log(`✅ [CRON] ${notified} ta va'da eslatmasi tizimga yozildi (Telegram yo'q)`);
    return { notified };
  } catch (error) {
    console.error('❌ [CRON] Va\'da eslatma xatosi:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  CRON JOBLARNI ISHGA TUSHIRISH
// ══════════════════════════════════════════════════════
export function startMonthlyDebtCron() {
  // Har kuni 00:01 — to'lov kuni kelgan o'quvchilar uchun qarz hisoblash
  cron.schedule('1 0 * * *', async () => {
    console.log('🔄 [CRON] Kunlik qarz tekshiruvi...');
    try { await calculateMonthlyDebts(); } catch (err) { console.error('❌ [CRON]:', err); }
  }, { timezone: 'Asia/Tashkent' });

  // Har kuni 09:00 — va'da sanasi eslatmalari (faqat DB, Telegram yo'q)
  cron.schedule('0 9 * * *', async () => {
    console.log('📅 [CRON] Va\'da eslatmalari...');
    try { await sendPromiseDateReminders(); } catch (err) { console.error('❌ [CRON]:', err); }
  }, { timezone: 'Asia/Tashkent' });

  console.log('📅 [CRON] Cron joblar ro\'yxatdan o\'tdi:');
  console.log('   1️⃣  Kunlik qarz — har kuni 00:01 (to\'lov kuni kelgan o\'quvchilar)');
  console.log('   2️⃣  Va\'da eslatma — har kuni 09:00 (faqat DB notification)');
}
